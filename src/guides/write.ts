/**
 * Заавар бичүүлэх — LLM дуудлага + DB.
 *
 *   npx tsx src/guides/write.ts "ChatGPT-г монголоор хэрхэн ашиглах" --audience оюутан
 */
import "dotenv/config";
import { chatJson } from "../agent/llm";
import { prisma } from "../db";
import { slugify } from "../agent/slug";
import { buildHero } from "../publish/card";
import { readMinutes } from "./markdown.api";
import {
  checkGuide, GUIDE_SCHEMA, GUIDE_SYSTEM, guidePrompt, sanitizeDraft, toMarkdown,
  type GuideDraft,
} from "./write.api";
import type { GuideLevel } from "../generated/prisma/enums";

type Chat = typeof chatJson;

export interface WriteResult {
  draft: GuideDraft;
  bodyMd: string;
  costUsd: number;
}

/** Сэдвээс бүтэн заавар бичүүлнэ. Шалгуур давахгүй бол нэг удаа дахин оролдоно. */
export async function writeGuide(
  topic: string,
  audience: string,
  level: GuideLevel,
  opts: { chat?: Chat } = {},
): Promise<WriteResult> {
  const chat = opts.chat ?? chatJson;
  let costUsd = 0;
  let problems: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<GuideDraft>({
      model: process.env.WRITE_MODEL ?? "google/gemini-3.8-flash",
      system: GUIDE_SYSTEM,
      user: [
        guidePrompt(topic, audience, level),
        ...(attempt === 0 ? [] : ["", `Өмнөх оролдлого амжилтгүй: ${problems.join("; ")}`]),
      ].join("\n"),
      schema: GUIDE_SCHEMA,
      maxTokens: 8_000,
      temperature: attempt === 0 ? 0.6 : 0.8,
      reasoning: false,
    });
    costUsd += out.costUsd;

    const draft = sanitizeDraft(out.data);
    const found = checkGuide(draft);
    if (found.length === 0) return { draft, bodyMd: toMarkdown(draft), costUsd };

    problems = found.map((f) => f.detail);
    console.warn(`  ⚠ заавар шалгуур давсангүй: ${problems.slice(0, 4).join("; ")}`);
  }
  throw new Error(`Заавар бичигдсэнгүй: ${problems.slice(0, 4).join("; ")}`);
}

/** Давхардвал -2, -3 ... залгана */
async function uniqueSlug(base: string, guideId?: string): Promise<string> {
  let slug = base || "zaavar";
  for (let n = 2; ; n++) {
    const taken = await prisma.guide.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === guideId) return slug;
    slug = `${base.replace(/-\d+$/, "")}-${n}`;
  }
}

export interface CreateOptions {
  topic: string;
  audience: string;
  level: GuideLevel;
  usecaseSlug?: string | null;
  /** Зураггүй үүсгэх (seed-ийн зардал хэмнэх) */
  withHero?: boolean;
  chat?: Chat;
}

/** Заавар бичүүлээд DRAFT-аар хадгална. Автомат нийтлэхгүй. */
export async function createGuide(o: CreateOptions): Promise<{ id: string; slug: string; costUsd: number }> {
  const { draft, bodyMd, costUsd: writeCost } = await writeGuide(o.topic, o.audience, o.level, { chat: o.chat });
  let costUsd = writeCost;

  const slug = await uniqueSlug(slugify(draft.title));
  const guide = await prisma.guide.create({
    data: {
      slug,
      topic: o.topic,
      title: draft.title,
      lead: draft.lead,
      bodyMd,
      level: o.level,
      audience: draft.audience,
      tools: draft.tools,
      usecaseSlug: o.usecaseSlug ?? null,
      readMinutes: readMinutes(bodyMd),
      faq: draft.faq,
      status: "DRAFT",
      costUsd,
    },
    select: { id: true, slug: true },
  });

  if (o.withHero !== false) {
    try {
      costUsd += await addHero(guide.id);
    } catch (e) {
      // Зураг дутуу байсан ч заавар өөрөө үлдэнэ — админ дараа нь дахин үүсгэж болно
      console.warn(`  ⚠ hero зураг гарсангүй: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  return { ...guide, costUsd };
}

/**
 * Зааварт тексгүй суурь зураг үүсгэнэ.
 *
 * card.ts-ийн scene урсгалыг HOWTO ангиллаар дууддаг тул лаборатори, микроскоп зурагдахгүй —
 * оронд нь тухайн зүйлийг өдөр тутамдаа хийж буй энгийн хүн гарна.
 */
export async function addHero(guideId: string): Promise<number> {
  const g = await prisma.guide.findUniqueOrThrow({
    where: { id: guideId },
    select: { id: true, title: true, lead: true, bodyMd: true },
  });
  const { recentImagePrompts } = await import("../publish/fbimage");

  const { hero, prompt, costUsd } = await buildHero(
    { id: g.id, titleMn: g.title, summaryMn: g.lead, bodyMn: g.bodyMd.slice(0, 1_500), category: "HOWTO" },
    { recentPrompts: await recentImagePrompts() },
  );

  await prisma.guide.update({
    where: { id: guideId },
    data: {
      heroImageData: new Uint8Array(hero),
      heroImagePrompt: prompt,
      heroImageAt: new Date(),
      costUsd: { increment: costUsd },
    },
  });
  return costUsd;
}

if (process.argv[1]?.endsWith("write.ts") && process.argv[1]?.includes("guides")) {
  const topic = process.argv[2];
  if (!topic) {
    console.error('Хэрэглээ: npx tsx src/guides/write.ts "<сэдэв>" [--audience оюутан] [--level BEGINNER]');
    process.exit(1);
  }
  const arg = (name: string, fallback: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? (process.argv[i + 1] ?? fallback) : fallback;
  };
  const r = await createGuide({
    topic,
    audience: arg("audience", "ажилтан"),
    level: arg("level", "BEGINNER") as GuideLevel,
    withHero: !process.argv.includes("--no-hero"),
  });
  console.log(`✓ /zaavar/${r.slug} (DRAFT) — $${r.costUsd.toFixed(4)}`);
  await prisma.$disconnect();
}
