/**
 * Facebook постын текстийг тусдаа LLM дуудлагаар бичүүлнэ.
 *
 *   npx tsx src/publish/fbcopy.ts <slug|id>        # нэг нийтлэлд бичүүлж хэвлэнэ
 *   npx tsx src/publish/fbcopy.ts <slug> --dry     # DB-д хадгалахгүй
 *
 * Нийтлэлийн хураангуйг шууд хэрэглэхгүй: FB-д өөр хэв маяг, өөр бүтэц хэрэгтэй.
 * Гарчгийг карт дээр бичдэг тул (card.ts) текст нь түүнийг давтахгүй, тайлбарлана.
 * Хоёр хувилбар бичүүлээд санамсаргүй нэгийг нь постлож, нөгөөг fbTextAlt-д хадгална.
 */
import "dotenv/config";
import { chatJson } from "../agent/llm";
import { judgeFidelity } from "./fidelity";
import { CATEGORY_LABEL } from "../agent/category";
import { prisma } from "../db";
import { isEntry } from "../lib/cli";
import {
  assemblePost, bodyOf, CATEGORY_TONE, checkBody, checkQuestion, cleanTags, domainOf, fallbackVariant,
  FB_COPY_SCHEMA, FB_COPY_SYSTEM, sanitizeVariant, showSource, type CopyVariant,
} from "./fbcopy.api";

/** FB текст бичих модель — нийтлэл бичих моделиос тусад нь сольж болно */
const COPY_MODEL = process.env.FB_COPY_MODEL ?? process.env.WRITE_MODEL ?? "google/gemini-3.8-flash";

/** Prompt-д өгөх нийтлэлийн биетийн дээд урт */
const MAX_BODY_CHARS_PROMPT = 2_500;

type Chat = typeof chatJson;

export interface FbCopyResult {
  text: string;
  alt: string;
  /** LLM-ийн санал болгосон сэдвийн шошго (IG caption-д) */
  hashtags: string[];
  tokens: number;
  costUsd: number;
  /** Засаж чадаагүй үлдсэн зөрчлүүд — /admin дээр анхааруулга болгон харуулж болно */
  problems: string[];
}

interface CopyOut {
  variants: CopyVariant[];
  hashtags: string[];
}

function userPrompt(
  a: {
    titleMn: string | null; summaryMn: string | null; bodyMn: string | null; fbHook: string | null;
    category: keyof typeof CATEGORY_TONE; tags: string[];
    models: { name: string }[]; companies: { name: string }[];
  },
  feedback: string[],
): string {
  const lines = [
    `Ангилал: ${a.category} (${CATEGORY_LABEL[a.category]}) — ${CATEGORY_TONE[a.category]}`,
    `Зурган дээрх гарчиг (бүү давт): ${a.fbHook ?? a.titleMn ?? ""}`,
    `Нийтлэлийн гарчиг: ${a.titleMn ?? ""}`,
    `Хураангуй: ${a.summaryMn ?? ""}`,
    `Нийтлэл: ${(a.bodyMn ?? "").slice(0, MAX_BODY_CHARS_PROMPT)}`,
  ];
  const names = [...a.models.map((m) => m.name), ...a.companies.map((c) => c.name)];
  if (names.length) lines.push(`Дурдагдсан нэрс: ${names.join(", ")}`);
  if (a.tags.length) lines.push(`Шошго: ${a.tags.join(", ")}`);
  if (feedback.length) {
    lines.push("", "Өмнөх оролдлогын алдаа — давтаж болохгүй:", ...feedback.map((f) => `- ${f}`));
  }
  return lines.join("\n");
}

/**
 * Нэг нийтлэлд FB текст бичүүлнэ. Хоёр хувилбар — нэгийг нь постолж, нөгөөг A/B-д.
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
      id: true, slug: true, titleMn: true, summaryMn: true, bodyMn: true, category: true,
      tags: true, fbHook: true, sourceUrl: true,
      source: { select: { name: true } },
      models: { select: { name: true } },
      companies: { select: { name: true } },
    },
  });

  // Эх сурвалжийн нэрний үндсэн үг: "MIT Technology Review AI" → "MIT Technology Review"
  const forbidden = [a.source.name, a.source.name.replace(/\s+AI$/i, "")];
  const sourceDomain = showSource() ? domainOf(a.sourceUrl) : undefined;

  let tokens = 0;
  let costUsd = 0;
  let variants: CopyVariant[] = [];
  let hashtags: string[] = [];
  let problems: string[] = [];

  // Нэг удаа дахин оролдоно — алдааг нь хэлж өгөөд
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<CopyOut>({
      model: COPY_MODEL,
      system: FB_COPY_SYSTEM,
      user: userPrompt(a, attempt === 0 ? [] : problems),
      schema: FB_COPY_SCHEMA,
      // 2 хувилбар × (контекст + яагаад + асуулт) + hashtag — кириллээр токен идэмхий
      maxTokens: 4_500,
      temperature: 0.7,
      reasoning: false,
    });
    tokens += out.tokens;
    costUsd += out.costUsd;

    variants = (out.data.variants ?? []).slice(0, 2).map(sanitizeVariant);
    hashtags = out.data.hashtags ?? [];
    if (variants.length < 2) {
      problems = ["хоёр хувилбар ирсэнгүй"];
      continue;
    }
    problems = variants.flatMap((v) => checkBody(bodyOf(v), forbidden)).map((p) => p.detail);
    if (problems.length === 0) break;
  }

  if (variants.length === 0) throw new Error("FB текст үүссэнгүй");
  if (variants.length === 1) variants.push(variants[0]!);

  // A/B: санамсаргүй нэгийг постлоно, нөгөө нь нөөцөд
  const first = rand() < 0.5 ? 0 : 1;
  const order = [variants[first]!, variants[1 - first]!];

  // Үнэн зөв байдлын шүүгч — картын гарчгийн адил. FB текст нь картаас ч олон хүнд
  // хүрдэг: 2026-09-27-нд «түр зогсоосон»-ыг «БҮРЭН зогсоолоо» гэж бичсэн.
  let chosen = -1;
  for (let i = 0; i < order.length; i++) {
    const v = order[i]!;
    const verdict = await judgeFidelity(
      { hook: bodyOf(v), kind: "FB текст", titleMn: a.titleMn, summaryMn: a.summaryMn, bodyMn: a.bodyMn },
      { chat },
    );
    costUsd += verdict.costUsd;
    if (verdict.ok && verdict.faithful) { chosen = i; break; }
    const why = verdict.ok ? verdict.issues.join("; ") : "шүүгч ажиллсангүй";
    problems.push(`хувилбар ${i + 1} хүлээж авсангүй: ${why}`);
  }

  // fail-closed: аль ч хувилбар тэнцээгүй бол нийтлэлийн өөрийн өгүүлбэрээр бичнэ
  if (chosen === -1) {
    const fallback = fallbackVariant(a);
    if (!fallback) throw new Error("FB текст үнэн зөв байдлын шалгалтад тэнцсэнгүй, нөөц бие ч гарсангүй");
    console.warn("  ⚠ FB текст: хоёр хувилбар хоёулаа тэнцсэнгүй — нийтлэлийн эхний өгүүлбэрээр бичив");
    order.splice(0, order.length, fallback, fallback);
    chosen = 0;
  }

  const text = assemblePost({ variant: order[chosen]!, sourceDomain });
  const alt = assemblePost({ variant: order[1 - chosen] ?? order[chosen]!, sourceDomain });
  const raw = order[chosen]!.question ?? "";
  const { question, reason } = checkQuestion(raw);
  if (reason) {
    // Асуулт яагаад гараагүйг тодорхой хэл — LLM өгөөгүй юу, шүүлт хаясан уу
    console.warn(`  ⚠ уншигчийн асуулт гарсангүй: ${reason}${raw.trim() ? ` — «${raw.trim().slice(0, 90)}»` : ""}`);
  } else {
    console.log(`  асуулт: ${question}`);
  }

  if (!opts.dryRun) {
    await prisma.article.update({
      where: { id: a.id },
      data: {
        fbText: text, fbTextAlt: alt, fbQuestion: question,
        // IG-ийн 3 дахь давхаргад хэрэглэнэ (hashtag-ийн коммент)
        fbTags: cleanTags(hashtags),
        tokensUsed: { increment: tokens },
      },
    });
  }
  if (problems.length) console.warn(`  ⚠ FB текст: ${problems.join("; ")}`);
  return { text, alt, hashtags, tokens, costUsd, problems };
}

if (isEntry("fbcopy.ts")) {
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
  console.log(`\n=== ${found.titleMn} · ${r.tokens} токен · $${r.costUsd.toFixed(4)} ===\n`);
  console.log(r.text);
  console.log(`\n--- нөгөө хувилбар (fbTextAlt) ---\n`);
  console.log(r.alt);
  await prisma.$disconnect();
}
