/**
 * Мэдээний agent — 2-р шат: RAW нийтлэлийг LLM-ээр үнэлж, монголоор бичиж DRAFT болгоно.
 *
 *   npx tsx src/agent/process.ts --limit 10   # default: AGENT_BATCH, дарааллаас хамаарч буурна
 *
 * Cron: RSS цуглуулагчийн дараа.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../db";
import { ubDayRange } from "../jobs/day";
import { jobRunMeta } from "../jobs/meta";
import type { ArticleCategory } from "../generated/prisma/enums";
import { categoryPromptBlock, toCategory } from "./category";
import {
  checkLocal, LOCAL_MIN_SCORE, LOCAL_SCHEMA, LOCAL_SYSTEM, localUser, type LocalOutput,
} from "../mongol/filter.api";
import { relaxedScore } from "./quota.api";
import { closeBrowser, fetchFullText } from "../fetchers/fulltext.api";
import { chatJson } from "./llm";
import { adaptiveBatch, agentBatch, agentDailyBudget, budgetExhausted } from "./budget.api";
import { pruneStaleRaw } from "./prune";
import { DIVERSE_CATEGORIES, HIGH_WEIGHT_MIN, mixRawBatch, splitSizes, staleBefore } from "./raw.api";
import { slugify } from "./slug";

const SCORE_MODEL = process.env.SCORE_MODEL ?? "deepseek/deepseek-v4.1-flash";
const WRITE_MODEL = process.env.WRITE_MODEL ?? "google/gemini-3.8-flash";
/** Ерөнхий босго. PROJECT/HOWTO-д CATEGORY_MIN_SCORE-оор сулруулна (quota.api.ts) */
const THRESHOLD = Number(process.env.RELEVANCE_THRESHOLD ?? 7);

// cwd-ээс уншина: CLI (npm script) ба Next.js server action хоёулаа төслийн үндсээс ажилладаг.
// import.meta.url нь Next-ийн bundle дотор .next/server/... руу заадаг тул тохирохгүй.
const GLOSSARY = readFileSync(join(process.cwd(), "src/agent/glossary.md"), "utf8");

const SCORE_SYSTEM = `Чи монгол уншигчдад зориулсан AI мэдээний сайтын редактор. Өгөгдсөн нийтлэлийг 1–10 оноогоор үнэлж, ангиллыг нь тодорхойл.

ГОЛ ШАЛГУУР: монгол уншигчид үүнийг ойлгох, хэрэгжүүлэх, эсвэл гайхах боломжтой юу? Ганц компанийн PR, зарлал бол бага оноо. Хүний амьдрал, ажил, мөнгөнд нөлөөлөх бол өндөр оноо.

Өндөр оноо (8–10): хүний ажил, мөнгө, аюулгүй байдалд шууд нөлөөлөх; шинэ модель, бүтээгдэхүүн, боломж гаргасан; хэн ч давтаж хийж болох төсөл, орлогын жишээ; гайхалтай судалгааны үр дүн; засгийн газрын зохицуулалт, хууль, шүүхийн шийдвэр; 100 сая ам.доллараас дээш хөрөнгө оруулалт.
Дунд (5–7): бага зэргийн шинэчлэл, салбарын дүн шинжилгээ, чухал хүний ярилцлага, ажлын байрны өөрчлөлт.
Бага (1–4): ганц компанийн PR, спонсорын контент, хямдралын зар, бүтээгдэхүүний review, AI-тай сул холбоотой, эсвэл монгол уншигчид огт хамаагүй орон нутгийн жижиг мэдээ.
Хувийн блогийн хэрэгслийн шинэчлэл, release note-ыг 4-өөс дээш бүү үнэл.

Ангилал (category) — агуулгад нь хамгийн тохирохыг сонго:
${categoryPromptBlock()}

Зөвхөн JSON буцаа.`;

const WRITE_SYSTEM = `Чи монгол хэлээр хиймэл оюуны мэдээ бичдэг сэтгүүлч. Доорх эх мэдээллийг уншаад монгол уншигчдад зориулж ӨӨРИЙН ҮГЭЭР мэдээ бич.

БИЕТИЙН БҮТЭЦ (bodyMn, markdown, нийт 250–400 үг):
1. Нэг өгүүлбэрийн lead — хэн, юу, хэзээ. Гарчигтай ижил санаа, өөр үгээр.
2. "## Гол баримт" — 2–3 bullet, тус бүр нь ТООТОЙ (хувь, доллар, хугацаа, тоо хэмжээ).
3. Дэд гарчигтай (## ...) 3–5 богино догол мөр. Догол мөр бүр 3-аас илүүгүй өгүүлбэр.
4. "## Монголд юу гэсэн үг" — нэг догол мөр: монгол уншигчид, бизнес, ажилд юу нөлөөлөх вэ.

Ерөнхий, давтсан, юу ч хэлээгүй өгүүлбэр бүү бич — баримт бүхэн шинэ мэдээлэл өгөх ёстой. Эх нийтлэлийн өгүүлбэрийг орчуулж бүү хуул. Эх мэдээлэлд байхгүй баримт, тоо, ишлэл бүү нэм. Хэрэв эх мэдээлэл дутуу бол мэдэгдэж байгаа зүйлээ л бич, таамаглахгүй. Хэрэв зөвхөн хураангуй өгөгдсөн бол богино (100–150 үг) бич, дэлгэрүүлж бүү таамагла. Эх мэдээлэл дутуу, хураангуй, бүтэн текст байхгүй гэх мэт ажлын явцын тайлбарыг нийтлэлд хэзээ ч бүү бич — уншигч үүнийг мэдэх ёсгүй. Доорх толь бичиг, дүрмийг заавал мөрд.
--- ТОЛЬ БИЧИГ, ДҮРЭМ ---
${GLOSSARY}`;

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 1, maximum: 10 },
    reason: { type: "string", description: "Нэг богино өгүүлбэр шалтгаан, 200 тэмдэгтээс хэтрэхгүй" },
    category: {
      type: "string",
      enum: ["NEWS", "PROJECT", "BUSINESS", "FACT", "RISK", "HOWTO"],
      description: "Агуулгын ангилал",
    },
  },
  required: ["score", "reason", "category"],
  additionalProperties: false,
};

const WRITE_SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string", description: "Монгол гарчиг, 60 тэмдэгтээс богино, кликбейтгүй, баримттай" },
    summaryMn: { type: "string", description: "1–2 өгүүлбэр, 200 тэмдэгт хүртэл; мэдээний жагсаалт, Facebook пост дээр харагдана" },
    bodyMn: { type: "string", description: "250–400 үг, markdown. Бүтэц: 1 өгүүлбэрийн lead → «## Гол баримт» (2–3 bullet, тоотой) → дэд гарчигтай 3–5 богино догол мөр → «## Монголд юу гэсэн үг». Гарчиг (h1), hashtag, эх хаяг оруулахгүй" },
    tags: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5, description: "Монголоор, жижиг үсгээр, 1–2 үг. Жишээ: модель, хөрөнгө оруулалт, зохицуулалт, судалгаа, нээлттэй жин, openai" },
    mentionedCompanies: { type: "array", items: { type: "string" }, description: "Нийтлэлд дурдсан AI компаниудын АНГЛИ нэр (OpenAI, Google, Anthropic ...)" },
    mentionedModels: { type: "array", items: { type: "string" }, description: "Дурдсан AI моделиудын АНГЛИ нэр (GPT-6 Astra, Claude Fable 5.1 ...)" },
  },
  required: ["titleMn", "summaryMn", "bodyMn", "tags", "mentionedCompanies", "mentionedModels"],
  additionalProperties: false,
};

interface ScoreOut { score: number; reason: string; category: string }
interface WriteOut {
  titleMn: string; summaryMn: string; bodyMn: string; tags: string[];
  mentionedCompanies: string[]; mentionedModels: string[];
}

/** Каталогийн нэр LLM-ийн бичсэн нэртэй таарахгүй байдаг тохиолдлууд */
const COMPANY_ALIAS: Record<string, string> = {
  "google deepmind": "google", deepmind: "google", "x.ai": "x-ai", xai: "x-ai",
  "meta ai": "meta", alibaba: "qwen", zhipu: "z-ai", "zhipu ai": "z-ai",
};

interface Named { id: string; name: string; slug: string }

function matchCompanies(mentioned: string[], all: Named[]): string[] {
  const ids = new Set<string>();
  for (const raw of mentioned) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const alias = COMPANY_ALIAS[key];
    const hit = all.find(
      (c) =>
        c.name.toLowerCase() === key || c.slug === key ||
        (alias !== undefined && (c.name.toLowerCase() === alias || c.slug === alias)),
    );
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}

/** Зөвхөн яг таарах нэр — хэсэгчилсэн таарал хуурамч холбоос үүсгэдэг байсан */
function matchModels(mentioned: string[], all: Named[]): string[] {
  const ids = new Set<string>();
  for (const raw of mentioned) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const hit = all.find((m) => m.name.trim().toLowerCase() === key);
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}

/** Ижил slug байвал -2, -3 ... залгана */
async function uniqueSlug(base: string, articleId: string): Promise<string> {
  for (let n = 2; ; n++) {
    const taken = await prisma.article.findUnique({ where: { slug: base }, select: { id: true } });
    if (!taken || taken.id === articleId) return base;
    base = `${base.replace(/-\d+$/, "")}-${n}`;
  }
}

/** trim, lowercase, давхардал/хоосныг хас, дээд тал нь 5 */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const t of tags) {
    const tag = t.trim().toLowerCase();
    if (tag) seen.add(tag);
    if (seen.size === 5) break;
  }
  return [...seen];
}

function short(s: string, max = 60): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface Catalog {
  companies: Named[];
  models: Named[];
}

/** Компани/моделийн каталог — олон нийтлэл боловсруулахад нэг удаа ачаална */
export async function loadCatalog(): Promise<Catalog> {
  const [companies, models] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.aiModel.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true } }),
  ]);
  return { companies, models };
}

export interface ProcessResult {
  /** Нийтлэх шийдвэр энд гарахгүй — квотын алхам (quota.ts) DRAFT-уудаас сонгоно */
  status: "DRAFT" | "REJECTED";
  /** Үнэлгээг алгассан бол false */
  scored: boolean;
  score: number;
  reason: string;
  category: ArticleCategory;
  titleMn?: string;
  slug?: string;
  companies: number;
  models: number;
  hadText: boolean;
  tokens: number;
}

/**
 * Нэг RAW нийтлэлийг үнэлж, босго давбал монголоор бичнэ.
 * skipScore: үнэлгээг алгасаж шууд бичнэ (relevance хэвээр) — admin-ы «Дахин бичүүлэх».
 * Алдаа гарвал throw — дуудагч нь нийтлэлийг RAW хэвээр үлдээнэ.
 */
/**
 * Дотоодын нийтлэлийг товчлон найруулна.
 *
 * Шалгуур давахгүй бол нэг удаа дахин бичүүлнэ (гол шалгуур — эх сурвалжийн нэр биед
 * дурдагдсан эсэх). Хоёр дахь удаад ч давахгүй бол хэвээр хадгалж админд үлдээнэ —
 * контент нь байгаа, зөвхөн иш татах нь дутуу.
 */
async function writeLocal(
  a: { sourceTitle: string; sourceExcerpt: string | null; sourceText: string | null; source: { name: string } },
  addTokens: (model: string, tokens: number) => void,
  addCost: (usd: number) => void,
): Promise<{ data: WriteOut; tokens: number; costUsd: number }> {
  const user = localUser({
    sourceName: a.source.name,
    title: a.sourceTitle,
    excerpt: a.sourceExcerpt ?? "",
    text: a.sourceText ?? a.sourceExcerpt ?? "",
  });

  let last: { data: LocalOutput; tokens: number; costUsd: number } | null = null;
  let problems: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chatJson<LocalOutput>({
      model: WRITE_MODEL,
      system: LOCAL_SYSTEM,
      user: attempt === 0 ? user : `${user}\n\nӨмнөх оролдлого амжилтгүй: ${problems.join("; ")}`,
      schema: LOCAL_SCHEMA,
      maxTokens: 4_000,
      temperature: attempt === 0 ? 0.4 : 0.6,
      reasoning: false,
    });
    addTokens(WRITE_MODEL, out.tokens);
    addCost(out.costUsd);
    last = out;

    const found = checkLocal(out.data, a.source.name);
    if (found.length === 0) break;
    problems = found.map((f) => f.detail);
    console.warn(`  ⚠ дотоод товчлол: ${problems.join("; ")}`);
  }

  const data = last!.data;
  return {
    data: {
      titleMn: data.titleMn,
      summaryMn: data.summaryMn,
      bodyMn: data.bodyMn,
      tags: data.tags,
      mentionedCompanies: [],
      mentionedModels: [],
    },
    tokens: last!.tokens,
    costUsd: last!.costUsd,
  };
}

export async function processOne(
  articleId: string,
  opts: {
    catalog?: Catalog;
    onTokens?: (model: string, tokens: number) => void;
    onCost?: (usd: number) => void;
    skipScore?: boolean;
  } = {},
): Promise<ProcessResult> {
  let a = await prisma.article.findUniqueOrThrow({ where: { id: articleId }, include: { source: true } });
  const { companies, models } = opts.catalog ?? (await loadCatalog());
  const addTokens = opts.onTokens ?? (() => {});
  const addCost = opts.onCost ?? (() => {});

  // rss үед сүлжээний түр алдаа байсан байж болно — нэг удаа дахин оролдоно
  if (!a.sourceText) {
    const full = await fetchFullText(a.sourceUrl, { browser: a.source.needsBrowser });
    if (full) {
      a = { ...a, sourceText: full.text };
      await prisma.article.update({ where: { id: a.id }, data: { sourceText: full.text } });
    }
  }

  const base = [
    `Эх сурвалж: ${a.source.name}`,
    `Гарчиг: ${a.sourceTitle}`,
    `Огноо: ${a.publishedAtSource ? a.publishedAtSource.toISOString() : "тодорхойгүй"}`,
  ];
  // Бүтэн текст олдоогүйг бичих моделд мэдэгдэнэ — богино бичиж, таамаглахгүйн тулд
  const content = a.sourceText
    ? `Бүтэн текст: ${a.sourceText}`
    : `Хураангуй (бүтэн текст олдсонгүй): ${a.sourceExcerpt || "(хоосон)"}`;
  const scoreUser = [
    ...base,
    `Эх сурвалжийн найдвартай байдал: ${a.source.weight}/10 (хувийн блог 4, хэвлэл 7, компанийн албан ёсны 9)`,
    content,
  ].join("\n");

  let scoreTokens = 0;
  let scoreValue = a.relevance;
  let scoreReason = a.scoreReason ?? "";
  let category = a.category;

  if (!opts.skipScore) {
    const score = await chatJson<ScoreOut>({
      model: SCORE_MODEL, system: SCORE_SYSTEM, user: scoreUser, schema: SCORE_SCHEMA,
      // Кирилл текст токен идэмхий: 300 нь урт тайлбарт хүрэлцэхгүй байж нийтлэл унадаг байв
      maxTokens: 600, temperature: 0.1, reasoning: false,
    });
    addTokens(SCORE_MODEL, score.tokens);
    addCost(score.costUsd);
    scoreTokens = score.tokens;
    scoreValue = score.data.score;
    scoreReason = score.data.reason;
    // LLM танигдахгүй утга буцаавал эх сурвалжийн анхдагч ангилал
    category = toCategory(score.data.category, a.source.defaultCategory);
    await prisma.article.update({
      where: { id: a.id },
      data: {
        relevance: scoreValue,
        scoreReason,
        category,
        scoreModel: SCORE_MODEL,
        tokensUsed: { increment: score.tokens },
      },
    });

    // Дотоодын мэдээнд босго бага (LOCAL_MIN_SCORE) — Монголын AI мэдээ өөрөө хомс,
    // дэлхийн мэдээтэй ижил босгоор шүүвэл /mongol үүрд хоосон байна.
    const threshold = a.isLocal
      ? LOCAL_MIN_SCORE
      : relaxedScore(THRESHOLD, category);
    if (scoreValue < threshold) {
      await prisma.article.update({ where: { id: a.id }, data: { status: "REJECTED" } });
      return {
        status: "REJECTED", scored: true, score: scoreValue, reason: scoreReason, category,
        companies: 0, models: 0, hadText: Boolean(a.sourceText), tokens: score.tokens,
      };
    }
  }

  // Дотоодын нийтлэл нь МОНГОЛ хэл дээр байна — орчуулах биш, товчлон найруулна.
  // Эх сурвалжийн хэвлэлийн нэрийг заавал дурдана (ёс зүй + харилцаа).
  const local = a.isLocal;
  const write = local
    ? await writeLocal(a, addTokens, addCost)
    : await chatJson<WriteOut>({
        model: WRITE_MODEL, system: WRITE_SYSTEM,
        user: [...base, content, `Эх хаяг: ${a.sourceUrl}`].join("\n"),
        schema: WRITE_SCHEMA, maxTokens: 6000, temperature: 0.4, reasoning: false,
      });
  addTokens(WRITE_MODEL, write.tokens);
  addCost(write.costUsd);

  const companyIds = matchCompanies(write.data.mentionedCompanies ?? [], companies);
  const modelIds = matchModels(write.data.mentionedModels ?? [], models);
  const slug = await uniqueSlug(slugify(write.data.titleMn) || a.slug, a.id);

  await prisma.article.update({
    where: { id: a.id },
    data: {
      status: "DRAFT",
      slug,
      titleMn: write.data.titleMn,
      summaryMn: write.data.summaryMn,
      bodyMn: write.data.bodyMn,
      tags: cleanTags(write.data.tags),
      writeModel: WRITE_MODEL,
      tokensUsed: { increment: write.tokens },
      companies: { connect: companyIds.map((id) => ({ id })) },
      models: { connect: modelIds.map((id) => ({ id })) },
    },
  });

  return {
    status: "DRAFT", scored: !opts.skipScore, score: scoreValue, reason: scoreReason, category,
    titleMn: write.data.titleMn, slug,
    companies: companyIds.length, models: modelIds.length,
    hadText: Boolean(a.sourceText), tokens: scoreTokens + write.tokens,
  };
}

export interface RawPick {
  id: string;
  sourceTitle: string;
}

/**
 * Багцыг хоёр бүлгээс холино (raw.api.ts): жин өндөртэй эх сурвалжаас хагас,
 * PROJECT/BUSINESS/FACT/HOWTO эх сурвалжаас хагас. Бүлэг дотроо эх сурвалжийн
 * огноогоор шинэ нь түрүүлнэ. Аль нэг нь хүрэлцэхгүй бол нөгөөгөөр нөхнө.
 */
export async function selectRawBatch(limit: number, now = new Date()): Promise<RawPick[]> {
  const fresh = {
    status: "RAW" as const,
    OR: [
      { publishedAtSource: { gte: staleBefore(now) } },
      { publishedAtSource: null, createdAt: { gte: staleBefore(now) } },
    ],
  };
  const order = [{ publishedAtSource: "desc" as const }, { createdAt: "desc" as const }];
  const select = { id: true, sourceTitle: true };
  const size = splitSizes(limit);

  const [high, diverse] = await Promise.all([
    prisma.article.findMany({
      where: { ...fresh, source: { weight: { gte: HIGH_WEIGHT_MIN } } },
      orderBy: order,
      take: limit,          // нөгөө бүлэг дутвал эндээс нөхнө
      select,
    }),
    prisma.article.findMany({
      where: { ...fresh, source: { defaultCategory: { in: DIVERSE_CATEGORIES } } },
      orderBy: order,
      take: limit,
      select,
    }),
  ]);

  const picked = mixRawBatch(high, diverse, limit);
  console.log(
    `Багц ${picked.length}/${limit}: жин ≥${HIGH_WEIGHT_MIN} бүлгээс ${size.high}, ` +
      `${DIVERSE_CATEGORIES.join("/")} бүлгээс ${size.diverse} (боломжит ${high.length} / ${diverse.length})`,
  );
  return picked;
}

/** УБ цагаар өнөөдөр LLM-д төлсөн нийт дүн (бүх job) */
export async function spentTodayUsd(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  const sum = await prisma.jobRun.aggregate({
    where: { startedAt: { gte: start, lt: end } },
    _sum: { costUsd: true },
  });
  return Number(sum._sum.costUsd ?? 0);
}

/**
 * Pipeline болон CLI хоёулаа үүнийг дуудна.
 * @param explicitLimit гараар өгсөн тоо. Хоосон бол AGENT_BATCH + дарааллын уртаас хамаарна.
 */
export async function runAgent(
  explicitLimit?: number,
): Promise<{ scored: number; drafted: number; failed: number; costUsd: number; skipped?: string }> {
  // Өдрийн LLM төсөв дүүрсэн бол шинэ нийтлэл боловсруулахгүй — бэлэн DRAFT-ууд хүлээж байна
  const budget = agentDailyBudget();
  const spent = await spentTodayUsd();
  if (budgetExhausted(spent, budget)) {
    const msg = `өдрийн төсөв дүүрсэн ($${spent.toFixed(2)}/$${budget.toFixed(2)})`;
    console.log(`Agent алгасав: ${msg}`);
    return { scored: 0, drafted: 0, failed: 0, costUsd: 0, skipped: msg };
  }

  const run = await prisma.jobRun.create({ data: { job: "agent", ...jobRunMeta() } });
  const tokensByModel = new Map<string, number>();
  const onTokens = (model: string, n: number) => tokensByModel.set(model, (tokensByModel.get(model) ?? 0) + n);
  let costUsd = 0;
  const onCost = (usd: number) => { costUsd += usd; };

  try {
    // Хуучирсан RAW-ууд дараалал эзлэхгүй — LLM дуудалгүй SKIPPED болгоно
    const pruned = await pruneStaleRaw();
    if (pruned.skipped > 0) console.log(`${pruned.skipped} хоцрогдсон RAW → SKIPPED`);

    // Дараалал богино бол багцаа багасгана (adaptive) — хуримтлал байхгүй бол яарах шаардлагагүй
    const rawQueue = await prisma.article.count({ where: { status: "RAW" } });
    const limit = explicitLimit ?? adaptiveBatch(agentBatch(), rawQueue);
    if (limit === 0) {
      await prisma.jobRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: true, error: null },
      });
      return { scored: 0, drafted: 0, failed: 0, costUsd: 0, skipped: "AGENT_BATCH=0" };
    }
    if (explicitLimit === undefined && limit !== agentBatch()) {
      console.log(`RAW дараалал ${rawQueue} — багц ${agentBatch()} → ${limit}`);
    }

    const articles = await selectRawBatch(limit);
    const catalog = await loadCatalog();

    let drafted = 0, rejected = 0, failed = 0;

    for (const [i, a] of articles.entries()) {
      const head = `[${i + 1}/${articles.length}]`;
      try {
        const r = await processOne(a.id, { catalog, onTokens, onCost });
        if (r.status === "REJECTED") {
          rejected++;
          console.log(`${head} score=${r.score} → REJECTED "${short(a.sourceTitle)}" (${r.reason})`);
        } else {
          drafted++;
          console.log(
            `${head} score=${r.score} ${r.category} → ${r.status} "${r.titleMn}" slug=${r.slug} ` +
              `companies=${r.companies} models=${r.models} ` +
              `text=${r.hadText ? "бүтэн" : "хураангуй"} (${r.tokens} tok)`,
          );
        }
      } catch (e) {
        // Нийтлэл RAW хэвээр үлдэнэ — дараагийн ажиллалтад дахин орно
        failed++;
        console.error(`${head} АЛДАА "${short(a.sourceTitle)}": ${(e as Error).message}`);
      }
    }

    const totalTokens = [...tokensByModel.values()].reduce((a, b) => a + b, 0);
    console.log(
      `\nҮнэлсэн ${articles.length}: DRAFT ${drafted}, REJECTED ${rejected}, алдаа ${failed}. ` +
        `${totalTokens} токен, зардал $${costUsd.toFixed(4)} ` +
        `(өдрийн нийт $${(spent + costUsd).toFixed(2)}/$${budget.toFixed(2)}).`,
    );

    // Нийтлэл бүр унасан бол лог дээр ч ногоон харагдах ёсгүй
    const allFailed = articles.length > 0 && failed === articles.length;
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: !allFailed,
        itemsIn: articles.length,
        itemsOut: drafted,
        attempted: articles.length,
        failed,
        costUsd,
        error: allFailed ? `${failed}/${articles.length} нийтлэл боловсруулагдаагүй` : null,
      },
    });
    return { scored: articles.length, drafted, failed, costUsd };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e), costUsd },
    });
    throw e;
  } finally {
    await closeBrowser();
  }
}

if (process.argv[1]?.endsWith("process.ts")) {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : undefined;
  runAgent(limit)
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
