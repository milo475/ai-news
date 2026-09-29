/**
 * Нийтлэхийн өмнөх шалгалт — LLM-гүй, зардалгүй.
 *
 * Яагаад publish алхамд дахин шалгах вэ: нийтлэл нь slot-оос 1–2 хоногийн ӨМНӨ
 * бэлдэгдэж, карт нь тэр үеийн дүрмээр үүсдэг. 2026-09-28-нд fidelity засвар
 * (fe6907e) гарахаас ӨМНӨ бэлдсэн карт «…сургалтаа зогсоолоо» гэсэн гарчигтай
 * хэвээр дараалалд хүлээж байсан — «түр» нь алга. Бэлэн картыг постлохын өмнө
 * ХЭЗЭЭ Ч дахин шалгадаггүй байсан нь цоорхой байв.
 */
import {
  dropsHedge, dropsModality, dropsRelay, dropsSourceRelay, hardensLegal, hardensSpeculation,
  relaySource,
} from "./fidelity.api";
import { checkDates } from "./dates.api";
import { jaccard, sharedCount, stemTokens } from "../lib/text.api";

// ---------- 1. Механик fidelity ----------

/**
 * Шалгагдах талбарууд.
 *
 * 2026-09-27-ны Пентагоны мэдээнд зөрчил нь гарчигт ч, **биед ч, «Гол баримт»-д
 * ч** байсан атал зөвхөн гарчиг, картын гарчиг, FB текст гурав шалгагддаг байв.
 * «Монголд юу гэсэн үг» хэсэг нь уншигчид хамгийн их санагддаг хэсэг тул мөн
 * шалгагдана. IG тайлбар нь `buildCaption(fbText)` — FB текстийн шалгалт шилжинэ.
 */
export type CheckedField =
  | "гарчиг" | "хураангуй" | "биет" | "Гол баримт" | "Монголд юу гэсэн үг"
  | "картын гарчиг" | "FB текст";

export type RuleName =
  | "түр→бүрэн" | "дамжуулалт алга" | "таамаг→баталгаа"
  | "модаль сулрав" | "хуулийн томьёолол хүчтэй болов" | "эх сурвалжид байхгүй огноо";

/** Нийтлэхийг зогсоох уу, эсвэл зөвхөн тайланд тэмдэглэх үү */
export type Severity = "ноцтой" | "анхаарах";

export interface FieldIssue {
  field: CheckedField;
  /** Аль дүрэм барив */
  rule: RuleName;
  severity: Severity;
  detail: string;
}

export interface PrePublishInput {
  titleMn: string | null;
  /** Урьдчилан бэлдсэн картын гарчиг */
  fbHook: string | null;
  fbText: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
  /**
   * Эх нийтлэлийн текст (ихэвчлэн англи). Байвал БҮХ талбарыг үүнтэй тулгана —
   * өөрийн хураангуйтайгаа тулгах нь зөвхөн дотоод зөрчлийг л олдог байв.
   */
  sourceText?: string | null;
  publishedAtSource?: Date | null;
  sourceName?: string | null;
}

/** Шүүгчид өгөх эх текстийн дээд урт */
export const SOURCE_CHARS = 2_000;

/**
 * Эх сурвалжтай тулгах дүрмүүд (англи эх текст → монгол гаргалт).
 *
 * `fields` нь дүрэм бүрийн хүрээ. Дамжуулалтыг («Bloomberg-ийн мэдээлснээр») биеийн
 * ХЭСЭГ БҮРТ шаардвал нэг нийтлэлээс 7 ижил зөрчил гарч тайлан уншигдахгүй болно:
 * дамжуулсан давхарга нь уншигчийг чиглүүлэх ёстой газартаа — гарчиг, хураангуй,
 * нийгмийн сүлжээний текстэд — байвал хангалттай. Эсрэгээр «түр→бүрэн» нь хаана ч
 * гарсан алдаа тул бүх талбарт шалгагдана.
 */
const ALL_FIELDS: CheckedField[] = [
  "гарчиг", "хураангуй", "биет", "Гол баримт", "Монголд юу гэсэн үг", "картын гарчиг", "FB текст",
];

const SOURCE_RULES: {
  rule: RuleName;
  severity: Severity;
  fn: (text: string, source: string) => boolean;
  why: string;
  fields: CheckedField[];
}[] = [
  {
    rule: "түр→бүрэн", severity: "ноцтой", fn: dropsHedge,
    why: "эх мэдээ нь ТҮР/хэсэгчилсэн үйлдлийг хэлж байтал эцсийн мэт бичсэн",
    fields: ALL_FIELDS,
  },
  {
    rule: "дамжуулалт алга", severity: "ноцтой", fn: dropsSourceRelay,
    why: "эх нийтлэл нэртэй хэвлэлээс дамжуулж байхад тэр давхаргыг хассан",
    fields: ["гарчиг", "хураангуй", "картын гарчиг", "FB текст"],
  },
  {
    rule: "таамаг→баталгаа", severity: "ноцтой", fn: hardensSpeculation,
    why: "таамгийг баталгаажсан баримт мэт бичсэн",
    fields: ALL_FIELDS,
  },
  {
    rule: "хуулийн томьёолол хүчтэй болов", severity: "ноцтой", fn: hardensLegal,
    why: "«reasonable grounds» зэрэг болзолт эрх зүйн томьёоллыг эргэлзээгүй мэт болгосон",
    fields: ALL_FIELDS,
  },
  {
    // Гарчиг товч байх ёстой тул модаль тэмдэглэгээг шаардахгүй — нарийн утга
    // нь биед хадгалагдах ёстой
    rule: "модаль сулрав", severity: "анхаарах", fn: dropsModality,
    why: "эх нийтлэлийн болгоомжлол (could, likely, suggested) манай текстэд үлдээгүй",
    fields: ["биет", "Гол баримт"],
  },
];

/** Эх текст байхгүй үеийн нөөц дүрмүүд — өөрийн хураангуйтайгаа тулгана */
const SELF_RULES = [
  { rule: "түр→бүрэн" as const, fn: dropsHedge, why: "эх мэдээ нь ТҮР/хэсэгчилсэн үйлдлийг хэлж байтал эцсийн мэт бичсэн" },
  { rule: "дамжуулалт алга" as const, fn: dropsRelay, why: "дамжуулсан эх сурвалж («X-ийн мэдээлснээр») алга" },
  { rule: "таамаг→баталгаа" as const, fn: hardensSpeculation, why: "таамгийг баталгаажсан баримт мэт бичсэн" },
];

/** Markdown биеийн «## Гарчиг» хэсгүүд */
export function mdSections(body: string): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = [];
  const parts = body.split(/^#{2,3}\s+(.+)$/mu);
  // parts[0] нь эхний гарчгийн өмнөх хэсэг (lead)
  for (let i = 1; i < parts.length; i += 2) {
    out.push({ heading: parts[i]!.trim(), text: (parts[i + 1] ?? "").trim() });
  }
  return out;
}

/** Гарчгаар нь хэсэг олно — «Гол баримт», «Гол баримтууд» хоёулаа таарна */
export function sectionText(body: string, heading: string): string | null {
  const want = heading.toLowerCase();
  return mdSections(body).find((s) => s.heading.toLowerCase().startsWith(want))?.text ?? null;
}

/** Биеийн нэрлэсэн хэсгүүдээс бусад хэсэг — давхар мэдээлэхгүйн тулд */
export function bodyWithoutSections(body: string, headings: string[]): string {
  let rest = body;
  for (const h of headings) {
    const text = sectionText(body, h);
    if (text) rest = rest.replace(text, " ");
  }
  return rest;
}

/** Биеэс тусад нь шалгагдах хэсгүүд */
export const NAMED_SECTIONS: { field: CheckedField; heading: string }[] = [
  { field: "Гол баримт", heading: "Гол баримт" },
  { field: "Монголд юу гэсэн үг", heading: "Монголд юу гэсэн үг" },
];

/**
 * Бүх текстийг эх нийтлэлтэй нь тулгана.
 *
 * `sourceText` байвал тэр нь үнэний эх үүсвэр: гарчиг, хураангуй, биет, нэрлэсэн
 * хэсгүүд, картын гарчиг, FB текст бүгд түүнтэй тулгагдана. Байхгүй бол (DIGEST,
 * хуучин мөрүүд) өмнөх зан төлөв — өөрийн хураангуйтайгаа тулгах — хэвээр.
 */
export function checkBeforePublish(a: PrePublishInput): FieldIssue[] {
  const source = (a.sourceText ?? "").trim();
  const body = a.bodyMn ?? "";
  const headings = NAMED_SECTIONS.map((s) => s.heading);

  const fields: { field: CheckedField; text: string | null }[] = [
    { field: "гарчиг", text: a.titleMn },
    { field: "хураангуй", text: a.summaryMn },
    { field: "биет", text: body ? bodyWithoutSections(body, headings) : null },
    ...NAMED_SECTIONS.map((s) => ({ field: s.field, text: body ? sectionText(body, s.heading) : null })),
    { field: "картын гарчиг", text: a.fbHook },
    { field: "FB текст", text: a.fbText },
  ];

  const issues: FieldIssue[] = [];

  if (source) {
    const src = source.slice(0, 8_000);
    for (const { field, text } of fields) {
      const value = (text ?? "").trim();
      if (!value) continue;
      for (const r of SOURCE_RULES) {
        if (!r.fields.includes(field)) continue;
        if (!r.fn(value, src)) continue;
        const outlet = r.rule === "дамжуулалт алга" ? relaySource(src) : null;
        issues.push({
          field, rule: r.rule, severity: r.severity,
          detail: `${field}: ${r.why}${outlet ? ` — «${outlet}»` : ""}`,
        });
        // Нэг талбарт ХЭД ХЭДЭН дүрэм барьж болно: Пентагоны мэдээний биед
        // «таамаг→баталгаа» ба «хуулийн томьёолол» хоёулаа байсан атал эхнийх
        // дээр таслаад хоёр дахийг нь алддаг байв. Тайланд дүрмээр бүлэглэгдэнэ.
      }
    }

    // Огноо: биеийн бүх хэсгийг нэг дор (нэг огноо хоёр газар байвал нэг л удаа)
    for (const d of checkDates({
      text: [a.titleMn, a.summaryMn, body].filter(Boolean).join("\n"),
      sourceText: src,
      publishedAtSource: a.publishedAtSource ?? null,
      sourceName: a.sourceName ?? undefined,
    })) {
      issues.push({
        field: "биет",
        rule: "эх сурвалжид байхгүй огноо",
        severity: d.severity,
        detail: `огноо «${d.text}»: ${d.reason}. ${d.suggestion}`,
      });
    }
    return issues;
  }

  // ——— Эх текстгүй: хуучин зан төлөв ———
  const head = [a.titleMn, a.summaryMn].filter(Boolean).join(" ");
  const full = [head, body.slice(0, SOURCE_CHARS)].join(" ");
  for (const { field, text } of [
    { field: "гарчиг" as const, text: a.titleMn },
    { field: "картын гарчиг" as const, text: a.fbHook },
    { field: "FB текст" as const, text: a.fbText },
  ]) {
    const value = (text ?? "").trim();
    if (!value) continue;
    // Гарчиг нь эх сурвалжийн нэг хэсэг тул өөртэйгөө тулгахгүй
    const self = field === "гарчиг"
      ? [a.summaryMn, body.slice(0, SOURCE_CHARS)].filter(Boolean).join(" ")
      : full;
    const relayFrom = field === "гарчиг" ? (a.summaryMn ?? "") : head;

    for (const r of SELF_RULES) {
      const s = r.rule === "дамжуулалт алга" ? relayFrom : self;
      if (s && r.fn(value, s)) {
        issues.push({ field, rule: r.rule, severity: "ноцтой", detail: `${field}: ${r.why}` });
        break;
      }
    }
  }
  return issues;
}

/** Нийтлэхийг зогсоох зөрчлүүд */
export function blocking(issues: FieldIssue[]): FieldIssue[] {
  return issues.filter((i) => i.severity === "ноцтой");
}

/** Карт/FB текстийг дахин үүсгэхэд засагддаг талбарууд */
const REPAIRABLE = new Set<CheckedField>(["картын гарчиг", "FB текст"]);

/**
 * Карт дахин үүсгэхэд утгатай эсэх — нийтлэлийн ӨӨРИЙН текст зөрчилтэй бол нэмэргүй.
 * Тэр тохиолдолд `article:fix` ажиллуулах хэрэгтэй.
 */
export function canRepair(issues: FieldIssue[]): boolean {
  const bad = blocking(issues);
  return bad.length > 0 && bad.every((i) => REPAIRABLE.has(i.field));
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


// ---------- 3. Хуучирсан мэдээ ----------

/**
 * Эх сурвалжийн нийтэлсэн огноо үүнээс хуучин бол нийтлэхгүй.
 *
 * 2026-09-29-нд 120 цаг байсныг 72 болгов. Дарааллыг засахаас ӨМНӨ 72 цаг нь
 * гаралтын 47%-ийг хаах байсан тул 120-оор эхэлсэн юм. Одоо дараалал өөрөө
 * засагдсан — RSS 48 цагийн цонх, шинэлэг байдлын жин, LLM зарцуулахаас өмнөх
 * насны шүүлт:
 *
 *   14 хоногийн өгөгдөл дээрх симуляц (npm run publish:sim)
 *     бодит production   p50  65ц   p90 239.5ц
 *     одоогийн дүрэм     p50 30.3ц  p90   115ц
 *     шинэ дүрэм         p50  7.3ц  p90  63.7ц   ← хоосон үлдэх slot 0
 *
 * p90 нь 72-оос доош буусан тул энэ босго одоо гаралтыг бараг хаахгүй.
 */
export const DEFAULT_NEWS_MAX_AGE_H = 72;

export function newsMaxAgeHours(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.NEWS_MAX_AGE_H);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_NEWS_MAX_AGE_H;
}

/**
 * Хугацаа хамаарахгүй ангиллууд.
 *
 * HOWTO (заавар) ба FACT (тайлбар) нь үйл явдалд бус мэдлэгт суурилдаг —
 * долоо хоногийн дараа ч адил үнэ цэнэтэй.
 */
export const TIMELESS_CATEGORIES = new Set(["HOWTO", "FACT"]);

export interface AgeVerdict {
  stale: boolean;
  hours: number | null;
  reason: string | null;
}

/** Эх сурвалжийн нас — хуучирсан эсэх */
export function checkAge(a: {
  category: string;
  publishedAtSource: Date | null;
  now: Date;
  maxAgeH?: number;
}): AgeVerdict {
  if (TIMELESS_CATEGORIES.has(a.category)) {
    return { stale: false, hours: null, reason: null };
  }
  if (!a.publishedAtSource) {
    // Огноо мэдэгдэхгүй бол хаахгүй — «мэдэхгүй» нь «хуучин» гэсэн үг биш
    return { stale: false, hours: null, reason: null };
  }

  const max = a.maxAgeH ?? DEFAULT_NEWS_MAX_AGE_H;
  const hours = Math.round(((a.now.getTime() - a.publishedAtSource.getTime()) / 3_600_000) * 10) / 10;
  if (hours <= max) return { stale: false, hours, reason: null };

  return {
    stale: true,
    hours,
    reason: `эх сурвалж ${Math.round(hours)}ц (${Math.round(hours / 24)} хоног) хуучин — хязгаар ${max}ц`,
  };
}
