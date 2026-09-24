/**
 * Facebook постын текстийг тусдаа LLM дуудлагаар бичүүлнэ.
 *
 *   npx tsx src/publish/fbcopy.ts <slug|id>        # нэг нийтлэлд бичүүлж хэвлэнэ
 *   npx tsx src/publish/fbcopy.ts <slug> --dry     # DB-д хадгалахгүй
 *
 * Нийтлэлийн хураангуйг шууд хэрэглэхгүй: FB-д өөр хэв маяг, өөр бүтэц хэрэгтэй.
 * Нэг нийтлэлд 2 хувилбар (өөр hook загвар) бичүүлээд санамсаргүй нэгийг нь постлож,
 * нөгөөг fbTextAlt-д хадгална — дараа нь аль загвар ажилладгийг харна.
 */
import "dotenv/config";
import { chatJson } from "../agent/llm";
import { CATEGORY_LABEL } from "../agent/category";
import { prisma } from "../db";
import { articleLink } from "./facebook.api";
import {
  assemblePost, CATEGORY_TONE, checkPost, FB_COPY_SCHEMA, FB_COPY_SYSTEM, HOOK_HINT,
  pickHookTypes, sanitizeVariant, type CopyVariant, type HookType,
} from "./fbcopy.api";

/** FB текст бичих модель — нийтлэл бичих моделиос тусад нь сольж болно */
const COPY_MODEL = process.env.FB_COPY_MODEL ?? process.env.WRITE_MODEL ?? "google/gemini-3.8-flash";

/** Prompt-д өгөх нийтлэлийн биетийн дээд урт */
const MAX_BODY_CHARS = 2_500;

type Chat = typeof chatJson;

export interface FbCopyResult {
  text: string;
  alt: string;
  hookType: string;
  tokens: number;
  /** Засаж чадаагүй үлдсэн зөрчлүүд — /admin дээр анхааруулга болгон харуулж болно */
  problems: string[];
}

interface CopyOut {
  variants: CopyVariant[];
}

/** Hook загварууд одоо хэр хэрэглэгдсэн бэ — жигд ээлжлүүлэхэд */
async function hookUsage(): Promise<Record<string, number>> {
  const rows = await prisma.article.groupBy({
    by: ["fbHookType"],
    where: { fbHookType: { not: null } },
    _count: true,
  });
  const usage: Record<string, number> = {};
  for (const r of rows) if (r.fbHookType) usage[r.fbHookType] = r._count;
  return usage;
}

function userPrompt(
  a: {
    titleMn: string | null; summaryMn: string | null; bodyMn: string | null;
    category: keyof typeof CATEGORY_TONE; tags: string[];
    models: { name: string }[]; companies: { name: string }[];
  },
  hooks: HookType[],
  feedback: string[],
): string {
  const lines = [
    `Ангилал: ${a.category} (${CATEGORY_LABEL[a.category]}) — ${CATEGORY_TONE[a.category]}`,
    `Гарчиг: ${a.titleMn ?? ""}`,
    `Хураангуй: ${a.summaryMn ?? ""}`,
    `Нийтлэл: ${(a.bodyMn ?? "").slice(0, MAX_BODY_CHARS)}`,
  ];
  const names = [...a.models.map((m) => m.name), ...a.companies.map((c) => c.name)];
  if (names.length) lines.push(`Дурдагдсан нэрс: ${names.join(", ")}`);
  if (a.tags.length) lines.push(`Шошго: ${a.tags.join(", ")}`);

  lines.push(
    "",
    "Хоёр хувилбар бич, hook нь өөр өөр загвартай байна:",
    `1) hookType="${hooks[0]}" — ${HOOK_HINT[hooks[0]!]}`,
    `2) hookType="${hooks[1]}" — ${HOOK_HINT[hooks[1]!]}`,
  );
  if (feedback.length) {
    lines.push("", "Өмнөх оролдлогын алдаа — давтаж болохгүй:", ...feedback.map((f) => `- ${f}`));
  }
  return lines.join("\n");
}

/**
 * Нэг нийтлэлд FB текст бичүүлнэ.
 * @param opts.chat  тест дээр LLM-ийг mock-оор солиход
 * @param opts.rand  аль хувилбарыг постлохыг сонгох (тестэд тогтмол)
 * @param opts.dryRun DB-д хадгалахгүй
 */
export async function generateFbCopy(
  articleId: string,
  opts: { chat?: Chat; rand?: () => number; dryRun?: boolean } = {},
): Promise<FbCopyResult> {
  const chat = opts.chat ?? chatJson;
  const rand = opts.rand ?? Math.random;

  const a = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    select: {
      id: true, slug: true, titleMn: true, summaryMn: true, bodyMn: true, category: true, tags: true,
      source: { select: { name: true } },
      models: { select: { name: true } },
      companies: { select: { name: true } },
    },
  });

  const link = articleLink(a.slug);
  // Эх сурвалжийн нэрний үндсэн үг: "MIT Technology Review AI" → "MIT Technology Review"
  const forbidden = [a.source.name, a.source.name.replace(/\s+AI$/i, "")];
  const hooks = pickHookTypes(await hookUsage(), rand);

  let tokens = 0;
  let variants: CopyVariant[] = [];
  let problems: string[] = [];

  // Нэг удаа дахин оролдоно — алдааг нь хэлж өгөөд
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<CopyOut>({
      model: COPY_MODEL,
      system: FB_COPY_SYSTEM,
      user: userPrompt(a, hooks, attempt === 0 ? [] : problems),
      schema: FB_COPY_SCHEMA,
      maxTokens: 3_000,
      temperature: 0.7,
      reasoning: false,
    });
    tokens += out.tokens;

    variants = (out.data.variants ?? []).slice(0, 2).map(sanitizeVariant);
    if (variants.length < 2) {
      problems = ["хоёр хувилбар ирсэнгүй"];
      continue;
    }
    problems = variants
      .flatMap((v) => checkPost(assemblePost(v, link), v.hook, forbidden))
      .map((p) => p.detail);
    if (problems.length === 0) break;
  }

  if (variants.length === 0) throw new Error("FB текст үүссэнгүй");
  if (variants.length === 1) variants.push(variants[0]!);

  // A/B: санамсаргүй нэгийг постлоно, нөгөө нь нөөцөд
  const first = rand() < 0.5 ? 0 : 1;
  const chosen = variants[first]!;
  const other = variants[1 - first]!;
  const text = assemblePost(chosen, link);
  const alt = assemblePost(other, link);

  if (!opts.dryRun) {
    await prisma.article.update({
      where: { id: a.id },
      data: { fbText: text, fbTextAlt: alt, fbHookType: chosen.hookType, tokensUsed: { increment: tokens } },
    });
  }
  if (problems.length) console.warn(`  ⚠ FB текст: ${problems.join("; ")}`);
  return { text, alt, hookType: chosen.hookType, tokens, problems };
}

if (process.argv[1]?.endsWith("fbcopy.ts")) {
  const key = process.argv[2];
  const dryRun = process.argv.includes("--dry");
  if (!key) {
    console.error("Хэрэглээ: npx tsx src/publish/fbcopy.ts <slug|id> [--dry]");
    process.exit(1);
  }
  const found = await prisma.article.findFirst({
    where: { OR: [{ slug: key }, { id: key }] },
    select: { id: true, titleMn: true },
  });
  if (!found) {
    console.error(`"${key}" нийтлэл олдсонгүй`);
    process.exit(1);
  }
  const r = await generateFbCopy(found.id, { dryRun });
  console.log(`\n=== ${found.titleMn} · hook=${r.hookType} · ${r.tokens} токен ===\n`);
  console.log(r.text);
  console.log(`\n--- нөгөө хувилбар (fbTextAlt) ---\n`);
  console.log(r.alt);
  await prisma.$disconnect();
}
