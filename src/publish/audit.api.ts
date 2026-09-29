/**
 * Нийтлэгдсэн мэдээний fidelity аудит — цэвэр хэсэг (DB-гүй, сүлжээгүй, тесттэй).
 *
 * Яагаад: механик шалгалт (prepublish) нь 2026-09-28-нд л орсон. Түүнээс ӨМНӨ
 * нийтлэгдсэн бүх мэдээ шалгагдаагүй үлдсэн — тэдний дунд Пентагоны мэдээ шиг
 * дөрвөн зөрчилтэй нийтлэл бий. Энэ модуль нь аль нийтлэлийг LLM шүүгчээр
 * шалгах вэ гэдгийг ($ хэмнэх үүднээс) шийдэж, тайлангийн мөрийг бүрдүүлнэ.
 */
import type { FieldIssue, Severity } from "./prepublish.api";

// ---------- Өндөр эрсдэлтэй сэдэв ----------

/**
 * Эдгээр сэдвүүдэд буруу бичсэн нэг үг нь хүнийг гүтгэх, олон нийтийг
 * төөрөгдүүлэх үр дагавартай — механик шалгалт цэвэр ч LLM шүүгчээр дамжина.
 */
export const RISK_TOPICS: { topic: string; words: string[] }[] = [
  {
    topic: "үхэл, гэмтэл",
    words: [
      "амь үрэгд", "нас бар", "амиа алд", "аминд хүр", "хохирогч", "амь насаа",
      "шархад", "гэмтэж", "оршуулга", "цогцос", "нас нөгчс",
    ],
  },
  {
    topic: "цэрэг, дайн",
    words: [
      "арми", "цэрэг", "дайн", "зэвсэг", "пентагон", "батлан хамгаалах", "нато",
      "агаарын цохилт", "бөмбөгд", "пуужин", "дрон", "нисгэгчгүй", "мөргөлдөөн",
      "онилох систем", "дайны гэмт хэрэг", "зэвсэгт хүчин",
    ],
  },
  {
    topic: "гэмт хэрэг, шүүх",
    words: [
      "гэмт хэрэг", "шүүхэд", "шүүх хурал", "цагдаа", "баривчил", "яллах", "ял ",
      "мөрдөн шалга", "нэхэмжлэл", "залилан", "хулгай", "буруутга", "прокурор",
      "хорих", "торгууль",
    ],
  },
  {
    topic: "нэртэй улс төрч",
    words: [
      "трамп", "байден", "си цзиньпин", "путин", "макрон", "ким жон ун",
      "нетаньяху", "зеленский", "моди", "эрдоган", "ерөнхийлөгч", "ерөнхий сайд",
      "сенатор", "конгресс", "парламент",
    ],
  },
  {
    topic: "эрүүл мэнд",
    words: [
      "эмчилгээ", "өвчин", "вакцин", "оношил", "эрүүл мэнд", "хорт хавдар",
      "сэтгэцийн", "амиа хорло", "эмнэлэг", "эмийн", "эмч", "тархины",
    ],
  },
];

/** Нийтлэлд ямар өндөр эрсдэлтэй сэдэв байна вэ */
export function riskTopics(text: string): string[] {
  const t = text.toLowerCase();
  return RISK_TOPICS.filter((r) => r.words.some((w) => t.includes(w))).map((r) => r.topic);
}

export interface AuditCandidate {
  slug: string;
  text: string;
  issues: FieldIssue[];
}

/**
 * LLM шүүгчээр шалгах ёстой юу.
 *
 * Хоёр шалтгаан: (1) механик шалгалтад унасан — юу нь буруу болохыг тайлбарлуулна;
 * (2) өндөр эрсдэлтэй сэдэв — механик шалгалт цэвэр ч нарийн зөрчил үлдэж болно.
 */
export function needsJudge(a: AuditCandidate): { judge: boolean; why: string } {
  const topics = riskTopics(a.text);
  if (a.issues.length > 0) {
    return { judge: true, why: `механик шалгалт: ${a.issues.length} зөрчил` };
  }
  if (topics.length > 0) return { judge: true, why: `өндөр эрсдэлтэй сэдэв: ${topics.join(", ")}` };
  return { judge: false, why: "механик шалгалт цэвэр, эрсдэлтэй сэдэвгүй" };
}

// ---------- Эрэмбэ ----------

const SEVERITY_RANK: Record<Severity, number> = { "ноцтой": 0, "анхаарах": 1 };

export interface AuditRow {
  slug: string;
  titleMn: string;
  publishedAt: Date | null;
  sourceName: string;
  sourceUrl: string;
  topics: string[];
  issues: FieldIssue[];
  /** LLM шүүгчийн олсон claim-ийн зөрчлүүд */
  claims: ClaimIssue[];
  costUsd: number;
}

export interface ClaimIssue {
  /** Манай текстийн мэдэгдэл */
  claim: string;
  /** Эх сурвалж дээр юу байсан (байхгүй бол хоосон) */
  source: string;
  problem: string;
  severity: Severity;
}

/** Нийтлэлийн хамгийн ноцтой зөрчлийн зэрэг */
export function worstSeverity(r: AuditRow): Severity | null {
  const all: Severity[] = [...r.issues.map((i) => i.severity), ...r.claims.map((c) => c.severity)];
  if (all.length === 0) return null;
  return all.sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b])[0]!;
}

/** Ноцтой нь дээр, дотроо зөрчлийн тоогоор */
export function rankRows(rows: AuditRow[]): AuditRow[] {
  const score = (r: AuditRow) => {
    const bad = [...r.issues, ...r.claims].filter((x) => x.severity === "ноцтой").length;
    const warn = [...r.issues, ...r.claims].filter((x) => x.severity === "анхаарах").length;
    return bad * 100 + warn;
  };
  return [...rows].filter((r) => score(r) > 0).sort((a, b) => score(b) - score(a));
}

// ---------- Эх сурвалжийн ишлэл ----------

/** Өгүүлбэрт хуваана — эх текст англи, монгол аль ч байж болно */
export function splitSentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
}

/** Тухайн хэллэгийг агуулсан өгүүлбэрийг эх текстээс олно */
export function evidence(sourceText: string, needles: string[]): string | null {
  const sentences = splitSentences(sourceText);
  for (const n of needles) {
    const hit = sentences.find((s) => s.toLowerCase().includes(n.toLowerCase()));
    if (hit) return hit.length > 320 ? `${hit.slice(0, 320)}…` : hit;
  }
  return null;
}

/** Дүрэм тус бүрт эх сурвалжаас юу харуулах вэ */
export const RULE_EVIDENCE: Record<string, string[]> = {
  "дамжуулалт алга": ["according to", "reported by", "reporting by", "interviewed by", "sources told"],
  "түр→бүрэн": ["pause", "temporar", "partial", "suspend"],
  "таамаг→баталгаа": ["could have", "may have", "might", "suggested", "alleged", "possibly"],
  "хуулийн томьёолол хүчтэй болов": ["reasonable grounds", "probable cause", "alleged", "amount to"],
  "модаль сулрав": ["likely", "appears to", "seems to", "reportedly", "probably"],
  "эх сурвалжид байхгүй огноо": [],
};

// ---------- LLM шүүгч: claim тус бүрээр ----------

export const CLAIMS_SYSTEM = `Чи баримт шалгагч. МАНАЙ НИЙТЛЭЛ-ийн мэдэгдэл бүрийг ЭХ НИЙТЛЭЛ-тэй тулгана.

Мэдэгдэл (claim) гэдэг нь бодит байдлын тухай шалгаж болох өгүүлбэр. Санал, ерөнхий
дүгнэлт, «Монголд юу гэсэн үг» хэсгийн зөвлөмж нь claim БИШ — тэднийг алгас.

Дараах бол ЗӨРЧИЛ:
1. НЭМСЭН БАРИМТ — эх нийтлэлд огт байхгүй тоо, нэр, огноо, тодотгол.
2. ДАМЖУУЛАЛТ АЛГА — эх нь «According to Bloomberg…» гэж байтал манай текст
   шууд мэдсэн мэт бичсэн. Тайлан нийтлэгдээгүй, шалгалт үргэлжилж байхад
   «тогтоов» гэж бичих нь ноцтой.
3. ТААМАГ → БАТАЛГАА — «could have / suggested / likely / downplayed» гэснийг
   «мэдэгдсэн / тогтоов / үгүйсгэв» болгосон.
4. МОДАЛЬ САЛСАН — эх нь «likely similar» гэж байтал манай текст «төстэй» гэж
   баттай бичсэн.
5. ХУУЛИЙН ТОМЬЁОЛОЛ ХҮЧТЭЙ БОЛСОН — «reasonable grounds» (мөрдөн шалгах болзол)
   гэснийг «бүрэн үндэслэлтэй» (тогтоогдсон) болгосон.
6. ТҮР → БҮРЭН, эсвэл эсрэгээр зөөлрүүлсэн.
7. ХАМРАХ ХҮРЭЭ, ТООГ КОНТЕКСТООС САЛГАСАН.
8. ОГНОО ЗОХИОСОН — эх нийтлэлд байхгүй огноог баримт болгосон. RSS-ийн нийтэлсэн
   огноог үйл явдлын огноо болгох нь ноцтой.

ЗӨРЧИЛ БИШ: товчилсон, өөр үгээр хэлсэн, бөөрөнхийлсөн, эх нийтлэлийн ӨӨР ХЭСЭГТ
байгаа баримтыг ашигласан.

Зөрчил бүрт:
- claim: манай текстийн өгүүлбэрийг ЯГ хуулж бич (богиносгохгүй).
- source: эх нийтлэлээс холбогдох хэсгийг хуулж бич. Огт байхгүй бол хоосон мөр.
- problem: юу нь буруу, ямар байвал зөв болохыг НЭГ өгүүлбэрээр.
- severity: «ноцтой» (уншигч буруу баримтад итгэнэ) эсвэл «анхаарах» (өнгө аяс).

Зөрчилгүй бол claims хоосон массив. Зөвхөн JSON.`;

export const CLAIMS_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          source: { type: "string" },
          problem: { type: "string" },
          severity: { type: "string", enum: ["ноцтой", "анхаарах"] },
        },
        required: ["claim", "source", "problem", "severity"],
        additionalProperties: false,
      },
    },
  },
  required: ["claims"],
  additionalProperties: false,
} as const;

/** Шүүгчид өгөх эх текстийн дээд урт — зардлыг барина */
export const AUDIT_SOURCE_CHARS = 6_000;
export const AUDIT_BODY_CHARS = 4_000;

export function claimsUser(a: {
  titleMn: string;
  summaryMn: string;
  bodyMn: string;
  sourceText: string;
}): string {
  return [
    "--- МАНАЙ НИЙТЛЭЛ ---",
    `Гарчиг: ${a.titleMn}`,
    `Хураангуй: ${a.summaryMn}`,
    a.bodyMn.slice(0, AUDIT_BODY_CHARS),
    "",
    "--- ЭХ НИЙТЛЭЛ ---",
    a.sourceText.slice(0, AUDIT_SOURCE_CHARS),
  ].join("\n");
}

/** Шүүгчийн хариуг цэгцэлнэ — хоосон мөр, буруу severity-г шүүнэ */
export function normalizeClaims(raw: { claims?: Partial<ClaimIssue>[] } | null): ClaimIssue[] {
  return (raw?.claims ?? [])
    .map((c) => ({
      claim: String(c.claim ?? "").trim(),
      source: String(c.source ?? "").trim(),
      problem: String(c.problem ?? "").trim(),
      severity: (c.severity === "анхаарах" ? "анхаарах" : "ноцтой") as Severity,
    }))
    .filter((c) => c.claim && c.problem)
    .slice(0, 8);
}

/**
 * Нэг дүрэм олон талбарт барьсныг НЭГ мөр болгоно.
 *
 * Пентагоны мэдээнд «дамжуулалт алга» нь 7 талбарт барьж, тайлан нь нэг зөрчлийг
 * долоон удаа давтаж байв. Дүрэм нэг, талбарууд нь жагсаалт.
 */
export interface GroupedIssue {
  rule: string;
  severity: Severity;
  fields: string[];
  detail: string;
}

export function groupIssues(issues: FieldIssue[]): GroupedIssue[] {
  const by = new Map<string, GroupedIssue>();
  for (const i of issues) {
    const key = `${i.rule}|${i.severity}`;
    const seen = by.get(key);
    if (seen) { seen.fields.push(i.field); continue; }
    // «гарчиг: эх нийтлэл …» -ээс талбарын нэрийг тайрч, шалтгааныг нь үлдээнэ
    by.set(key, {
      rule: i.rule,
      severity: i.severity,
      fields: [i.field],
      detail: i.detail.replace(new RegExp(`^${i.field}: `), ""),
    });
  }
  return [...by.values()].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// ---------- Давхардсан нийтлэл ----------

/**
 * Нэг үйл явдлыг ХОЁР УДАА нийтэлсэн эсэх.
 *
 * 2026-09-25 ба 09-26-нд «OpenAI GPT-6 Sol болон Luna» гэсэн хоёр нийтлэл өөр
 * эх сурвалжаас (TechCrunch, OpenAI Blog) гарсан — нийтлэхийн өмнөх давхардлын
 * шалгалт 2026-09-28-нд л орсон тул түүнээс өмнөх давхардлууд сайт дээр үлдсэн.
 * Аудит нь нийтлэгдсэн хосуудыг эргэж хардаг.
 */
export interface DuplicatePair {
  a: { slug: string; titleMn: string; publishedAt: Date | null };
  b: { slug: string; titleMn: string; publishedAt: Date | null };
  score: number;
  shared: number;
  /** Хожим гарсан нь — ихэвчлэн үүнийг нуух эсвэл нэгтгэх */
  later: string;
}

export interface DuplicateInput {
  slug: string;
  titleMn: string;
  summaryMn: string;
  category: string;
  companies: string[];
  publishedAt: Date | null;
}

/**
 * Аудитын давхцлын доод босго.
 *
 * `sameEvent` нь НИЙТЛЭХИЙН ӨМНӨХ 48 цагийн цонхонд тохируулагдсан: тэнд ижил
 * компани + ижил ангилал + 4 ижил үндэс нь бараг үргэлж нэг үйл явдал байдаг.
 * 30 хоногийн цонхонд энэ нь хэт сул — «OpenAI сургалтаа зогсоов» ба «OpenAI-ийн
 * агент Австралид нэвтэрсэн» хоёрыг нэг үйл явдал гэж барьж байв. Тиймээс
 * аудитад үгийн бодит давхцлыг шаардана.
 */
export const AUDIT_DUP_MIN_SCORE = 0.25;

/** Бүх хосыг тулгаж, нэг үйл явдлынхыг буцаана */
export function duplicatePairs(
  rows: DuplicateInput[],
  same: (a: DuplicateInput, b: DuplicateInput) => { same: boolean; score: number; shared: number },
  minScore = AUDIT_DUP_MIN_SCORE,
): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      const v = same(a, b);
      if (!v.same || v.score < minScore) continue;
      const at = a.publishedAt?.getTime() ?? 0;
      const bt = b.publishedAt?.getTime() ?? 0;
      out.push({
        a: { slug: a.slug, titleMn: a.titleMn, publishedAt: a.publishedAt },
        b: { slug: b.slug, titleMn: b.titleMn, publishedAt: b.publishedAt },
        score: v.score,
        shared: v.shared,
        later: at >= bt ? a.slug : b.slug,
      });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
