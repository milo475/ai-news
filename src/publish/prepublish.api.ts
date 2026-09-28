/**
 * Нийтлэхийн өмнөх шалгалт — LLM-гүй, зардалгүй.
 *
 * Яагаад publish алхамд дахин шалгах вэ: нийтлэл нь slot-оос 1–2 хоногийн ӨМНӨ
 * бэлдэгдэж, карт нь тэр үеийн дүрмээр үүсдэг. 2026-09-28-нд fidelity засвар
 * (fe6907e) гарахаас ӨМНӨ бэлдсэн карт «…сургалтаа зогсоолоо» гэсэн гарчигтай
 * хэвээр дараалалд хүлээж байсан — «түр» нь алга. Бэлэн картыг постлохын өмнө
 * ХЭЗЭЭ Ч дахин шалгадаггүй байсан нь цоорхой байв.
 */
import { dropsHedge, dropsRelay, hardensSpeculation } from "./fidelity.api";
import { jaccard, sharedCount, stemTokens } from "../lib/text.api";

// ---------- 1. Механик fidelity ----------

export type CheckedField = "гарчиг" | "картын гарчиг" | "FB текст";

export interface FieldIssue {
  field: CheckedField;
  /** Аль дүрэм барив */
  rule: "түр→бүрэн" | "дамжуулалт алга" | "таамаг→баталгаа";
  detail: string;
}

export interface PrePublishInput {
  titleMn: string | null;
  /** Урьдчилан бэлдсэн картын гарчиг */
  fbHook: string | null;
  fbText: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
}

/** Шүүгчид өгөх эх текстийн дээд урт */
export const SOURCE_CHARS = 2_000;

const RULES = [
  { rule: "түр→бүрэн" as const, fn: dropsHedge, why: "эх мэдээ нь ТҮР/хэсэгчилсэн үйлдлийг хэлж байтал эцсийн мэт бичсэн" },
  { rule: "дамжуулалт алга" as const, fn: dropsRelay, why: "дамжуулсан эх сурвалж («X-ийн мэдээлснээр») алга" },
  { rule: "таамаг→баталгаа" as const, fn: hardensSpeculation, why: "таамгийг баталгаажсан баримт мэт бичсэн" },
];

/**
 * Гурван талбарыг эх нийтлэлтэй нь тулгана.
 *
 * `dropsRelay` нь зөвхөн гарчиг/хураангуйг эх сурвалж болгож харна (биед «мэдээлэв»
 * гэдэг үг санамсаргүй тааралдвал бүх гарчгийг зөрчилтэй болгоно).
 */
export function checkBeforePublish(a: PrePublishInput): FieldIssue[] {
  const head = [a.titleMn, a.summaryMn].filter(Boolean).join(" ");
  const full = [head, (a.bodyMn ?? "").slice(0, SOURCE_CHARS)].join(" ");

  const fields: { field: CheckedField; text: string | null }[] = [
    { field: "гарчиг", text: a.titleMn },
    { field: "картын гарчиг", text: a.fbHook },
    { field: "FB текст", text: a.fbText },
  ];

  const issues: FieldIssue[] = [];
  for (const { field, text } of fields) {
    const value = (text ?? "").trim();
    if (!value) continue;
    // Гарчиг нь эх сурвалжийн нэг хэсэг тул өөртэйгөө тулгахгүй
    const source = field === "гарчиг" ? [a.summaryMn, (a.bodyMn ?? "").slice(0, SOURCE_CHARS)].filter(Boolean).join(" ") : full;
    const relaySource = field === "гарчиг" ? (a.summaryMn ?? "") : head;

    for (const r of RULES) {
      const src = r.rule === "дамжуулалт алга" ? relaySource : source;
      if (src && r.fn(value, src)) {
        issues.push({ field, rule: r.rule, detail: `${field}: ${r.why}` });
        break; // нэг талбарт нэг шалтгаан хангалттай
      }
    }
  }
  return issues;
}

/** Карт дахин үүсгэхэд утгатай эсэх — гарчиг өөрөө зөрчилтэй бол нэмэргүй */
export function canRepair(issues: FieldIssue[]): boolean {
  return issues.length > 0 && !issues.some((i) => i.field === "гарчиг");
}

// ---------- 2. Ижил үйл явдлын давхардал ----------

/** Сүүлийн хэдэн цагийн нийтлэлтэй харьцуулах вэ */
export const RECENT_HOURS = 48;

/** Зөвхөн үгийн давхцлаар шийдэх босго (компани таарахгүй үед) */
export const EVENT_JACCARD = 0.4;
/**
 * Ижил компани БА ижил ангилалтай үед хэдэн үндэс давхцвал нэг үйл явдал вэ.
 *
 * Монгол нөхцөлөөс болж түүхий Jaccard бага гардаг (бодит хосын оноо 0.19) тул
 * үндэслэсэн үгийн ТООГООР шийднэ. Буруу таних эрсдэлийг хоёр дахь шүүлт —
 * «шинэ баримт байна уу» — барина: баримттай бол алгасахгүй, «Шинэчлэл:» болно.
 */
export const EVENT_SHARED_STEMS = 4;

export interface RecentArticle {
  slug: string;
  titleMn: string;
  summaryMn: string;
  category: string;
  companies: string[];
}

export interface Candidate extends RecentArticle {
  id: string;
}

/** Хоёр нийтлэл нэг үйл явдлын тухай эсэх */
export function sameEvent(a: RecentArticle, b: RecentArticle): {
  same: boolean;
  score: number;
  shared: number;
} {
  const ta = stemTokens(`${a.titleMn} ${a.summaryMn}`);
  const tb = stemTokens(`${b.titleMn} ${b.summaryMn}`);
  const score = jaccard(ta, tb);
  const shared = sharedCount(ta, tb);

  const sameCompany = a.companies.some((c) => b.companies.includes(c));
  const same =
    score >= EVENT_JACCARD ||
    (sameCompany && a.category === b.category && shared >= EVENT_SHARED_STEMS);

  return { same, score: Math.round(score * 1000) / 1000, shared };
}

/** Тоо, хувь, огноо, латин нэр — «шинэ баримт» болж чадах тэмдэгтүүд */
const FACT_TOKEN = /(\d[\d.,]*\s*(?:%|хувь|сая|тэрбум|мянга|доллар|₮)?|[A-Z][A-Za-z0-9.-]{2,})/gu;

export function factTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(FACT_TOKEN)) {
    const t = m[0]
      .trim()
      .toLowerCase()
      // «OpenAI-ийн» → «openai»: монгол нөхцөл нь шинэ баримт биш
      .replace(/-[\p{Script=Cyrillic}]+$/u, "")
      .replace(/[.,\-]+$/u, "");
    // Нэг оронтой тоо нь баримт биш (жагсаалтын дугаар гэх мэт)
    if (/^\d$/.test(t)) continue;
    if (t.length >= 2) out.add(t);
  }
  return out;
}

/** Хэдэн шинэ баримт байвал «Шинэчлэл:» болгож нийтлэх вэ */
export const MIN_NEW_FACTS = 1;

/** Нэр дэвшигчид хуучин нийтлэлд байхгүй ямар баримт байна вэ */
export function newFactsVs(candidate: RecentArticle, older: RecentArticle): string[] {
  const mine = factTokens(`${candidate.titleMn} ${candidate.summaryMn}`);
  const theirs = factTokens(`${older.titleMn} ${older.summaryMn}`);
  return [...mine].filter((t) => !theirs.has(t));
}

export const UPDATE_PREFIX = "Шинэчлэл: ";

export function withUpdatePrefix(title: string): string {
  return title.startsWith(UPDATE_PREFIX) ? title : `${UPDATE_PREFIX}${title}`;
}

export type DuplicateAction = "publish" | "skip" | "update";

export interface DuplicateVerdict {
  action: DuplicateAction;
  /** Ижил үйл явдлын хамгийн ойрын нийтлэл */
  match: RecentArticle | null;
  score: number;
  newFacts: string[];
  reason: string;
}

/**
 * Нэр дэвшигчийг сүүлийн 48 цагийн нийтлэлүүдтэй тулгана.
 *
 * · ижил үйл явдал БА шинэ баримтгүй → **skip**
 * · ижил үйл явдал БА шинэ баримттай → **update** (гарчигт «Шинэчлэл:»)
 * · ижил үйл явдал олдоогүй → **publish**
 */
export function checkDuplicate(candidate: RecentArticle, recent: RecentArticle[]): DuplicateVerdict {
  let best: { a: RecentArticle; score: number } | null = null;
  for (const r of recent) {
    if (r.slug === candidate.slug) continue;
    const { same, score } = sameEvent(candidate, r);
    if (same && (!best || score > best.score)) best = { a: r, score };
  }

  if (!best) return { action: "publish", match: null, score: 0, newFacts: [], reason: "давхардал олдсонгүй" };

  const newFacts = newFactsVs(candidate, best.a);
  if (newFacts.length < MIN_NEW_FACTS) {
    return {
      action: "skip", match: best.a, score: best.score, newFacts,
      reason: `/medee/${best.a.slug} -тэй нэг үйл явдал (${best.score}), шинэ баримтгүй`,
    };
  }
  return {
    action: "update", match: best.a, score: best.score, newFacts,
    reason: `/medee/${best.a.slug} -ийн үргэлжлэл (${best.score}), шинэ: ${newFacts.slice(0, 4).join(", ")}`,
  };
}
