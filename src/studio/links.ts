/**
 * Студийн гаргалтыг сайтын бусад хэсэгтэй холбоно.
 *
 * Хэрэглэгч промптоо авсны дараа «энэ хэрэгсэл юу вэ», «яаж эхлэх вэ» гэдгийг
 * манай сайтаас уншина — гадагш алдахгүй.
 */
import { prisma } from "../db";
import { memoTtl, TTL } from "../lib/cache.api";
import { toolById, type StudioTool } from "./studio.api";

export interface StudioLink {
  label: string;
  href: string;
}

/** Каталог дахь нэрийн хувилбарууд — студийн id-г Tool.name-тэй тааруулна */
const ALIASES: Record<string, string[]> = {
  chatgpt: ["ChatGPT", "OpenAI ChatGPT"],
  gemini: ["Gemini", "Google Gemini", "Nano Banana"],
  midjourney: ["Midjourney"],
  ideogram: ["Ideogram"],
  canva: ["Canva"],
  capcut: ["CapCut"],
  runway: ["Runway", "RunwayML", "Runway ML"],
  kling: ["Kling", "Kling AI"],
  veo: ["Veo", "Google Veo", "Veo 3"],
  pika: ["Pika", "Pika Labs"],
  heygen: ["HeyGen"],
  suno: ["Suno"],
  sora: ["Sora"],
};

async function catalogUncached(): Promise<{ slug: string; name: string }[]> {
  return prisma.tool.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, name: true },
  });
}

const catalog: typeof catalogUncached = memoTtl(catalogUncached, {
  name: "studio-tool-catalog",
  ttlMs: TTL.list,
});

function matches(name: string, aliases: string[]): boolean {
  const n = name.toLowerCase();
  return aliases.some((a) => n === a.toLowerCase() || n.startsWith(`${a.toLowerCase()} `));
}

/**
 * Хэрэгслүүдэд харгалзах /hereglel холбоосууд. Каталогт байхгүй хэрэгслийг
 * алгасна — эвдэрсэн холбоос өгөхгүй.
 */
export async function toolLinks(toolIds: string[]): Promise<StudioLink[]> {
  const rows = await catalog();
  const out: StudioLink[] = [];
  for (const id of toolIds) {
    const tool = toolById(id);
    if (!tool) continue;
    const aliases = ALIASES[id] ?? [tool.name];
    const hit = rows.find((r) => matches(r.name, aliases));
    if (hit) out.push({ label: hit.name, href: `/hereglel/${hit.slug}` });
  }
  return out;
}

async function guidesUncached(): Promise<{ slug: string; title: string }[]> {
  return prisma.guide.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

const guides: typeof guidesUncached = memoTtl(guidesUncached, {
  name: "studio-guide-titles",
  ttlMs: TTL.guide,
});

/**
 * Хэрэгслийн нэр гарчигт нь орсон зааврууд. Нэг хэрэгсэлд нэгээс илүүг өгөхгүй —
 * хэрэглэгчийг сонголтоор бүү дар.
 */
export async function guideLinks(toolIds: string[], limit = 3): Promise<StudioLink[]> {
  const rows = await guides();
  const out: StudioLink[] = [];
  for (const id of toolIds) {
    const tool = toolById(id);
    if (!tool) continue;
    const aliases = ALIASES[id] ?? [tool.name];
    const hit = rows.find((g) => aliases.some((a) => g.title.toLowerCase().includes(a.toLowerCase())));
    if (hit && !out.some((x) => x.href === `/zaavar/${hit.slug}`)) {
      out.push({ label: hit.title, href: `/zaavar/${hit.slug}` });
    }
    if (out.length >= limit) break;
  }
  return out;
}

export async function studioLinks(tools: StudioTool[]): Promise<{ tools: StudioLink[]; guides: StudioLink[] }> {
  const ids = tools.map((t) => t.id);
  const [toolsL, guidesL] = await Promise.all([toolLinks(ids), guideLinks(ids)]);
  return { tools: toolsL, guides: guidesL };
}
