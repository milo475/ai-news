/**
 * Огнооны шалгалт — биед бичсэн огноо бүр ЭХ СУРВАЛЖИД байх ёстой (LLM-гүй, тесттэй).
 *
 * Яагаад: 2026-09-29-нд нийтлэгдсэн «Meta-ийн Muse … zero-day» мэдээний биед
 * «…илэрснийг 2026 оны 9-р сарын 21-нд мэдээллээ» гэж бичигдсэн байв. Эх
 * нийтлэлийн 7,996 тэмдэгтэд ямар ч огноо БАЙХГҮЙ — тэр огноо нь RSS-ийн
 * `pubDate`, өөрөөр хэлбэл **эх сурвалж хэзээ нийтэлсэн** нь болохоос судлаач
 * хэзээ мэдээлсэн биш. Загвар нийтлэлийн метадатаг баримт болгосон хэрэг.
 *
 * Дүрэм:
 *   1. RSS pubDate = эх сурвалжийн нийтэлсэн огноо. Үйл явдлын огноо БИШ.
 *   2. Биед байгаа огноо бүр sourceText-д ямар ч хэлбэрээр («Sept. 21»,
 *      «September 21st», «9/21», «Sunday») байх ёстой. Байхгүй бол хасах,
 *      эсвэл «<эх сурвалж> <огноо>-нд мэдээлснээр» гэж эх сурвалжид хамааруулах.
 */

/** Монгол сарын нэрс — «хоёрдугаар сар» = 2 */
export const MN_MONTH_WORDS: Record<string, number> = {
  "нэгдүгээр": 1, "хоёрдугаар": 2, "гуравдугаар": 3, "дөрөвдүгээр": 4,
  "тавдугаар": 5, "зургаадугаар": 6, "зургадугаар": 6, "долоодугаар": 7,
  "наймдугаар": 8, "есдүгээр": 9, "аравдугаар": 10,
  "арван нэгдүгээр": 11, "арван хоёрдугаар": 12,
};

/** Англи сарын нэр → дугаар (товчлолыг мөн хамруулна) */
export const EN_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Эх сурвалжид хайх англи хэлбэрүүд — «Sept.» гэх товчлол багтана */
const EN_ABBR: Record<number, string[]> = {
  1: ["jan"], 2: ["feb"], 3: ["mar"], 4: ["apr"], 5: ["may"], 6: ["jun"],
  7: ["jul"], 8: ["aug"], 9: ["sep", "sept"], 10: ["oct"], 11: ["nov"], 12: ["dec"],
};

const MN_WEEKDAYS = ["ням", "даваа", "мягмар", "лхагва", "пүрэв", "баасан", "бямба"];
const EN_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export interface MnDate {
  /** Түүхий хэллэг — засварлахад яг үүнийг олж солино */
  text: string;
  year: number | null;
  month: number;
  /** Зөвхөн сар дурдсан бол null («9-р сард») */
  day: number | null;
}

/**
 * «2026 оны 9-р сарын 21-нд», «9 дүгээр сарын 3-ны».
 *
 * Өдрийг ЗӨВХӨН «сарын» (харьяалахын тийн ялгал) -ын дараа авна: «9-р сард 30
 * настай …» гэсэн хэллэгт 30 нь өдөр БИШ, нас юм. Мөн өдрийн нөхцөлийг нарийн
 * заана — «н», «д» гэсэн ганц үсгийг зөвшөөрвөл ямар ч үг өдөр болж хувирна.
 */
const DAY_SUFFIX = "(?:-?\\s*(?:нд|ны|ний|наас|нээс)|-\\s*д)";
const NUMERIC_MONTH = new RegExp(
  `(?:(\\d{4})\\s*оны\\s*)?(\\d{1,2})\\s*-?\\s*(?:р|дугаар|дүгээр)\\s*сар(?:ын\\s*(\\d{1,2})${DAY_SUFFIX}|ын|д|ыг|аас)?`,
  "gu",
);

/** «2026 оны хоёрдугаар сарын 28-нд» */
const WORD_MONTH = new RegExp(
  `(?:(\\d{4})\\s*оны\\s*)?(${Object.keys(MN_MONTH_WORDS).join("|")})\\s*` +
    `сар(?:ын\\s*(\\d{1,2})${DAY_SUFFIX}|ын|д|ыг|аас)?`,
  "gu",
);

/** «2026-09-21» */
const ISO = /(\d{4})-(\d{2})-(\d{2})/gu;

function push(out: MnDate[], d: MnDate): void {
  if (d.month < 1 || d.month > 12) return;
  if (d.day !== null && (d.day < 1 || d.day > 31)) return;
  // Нэг хэллэгийг хоёр загвар барьж магадгүй — давхардлыг хасна
  if (out.some((x) => x.text === d.text)) return;
  out.push(d);
}

/** Монгол текстээс огнооны хэллэгүүдийг гаргана */
export function extractDates(text: string): MnDate[] {
  const out: MnDate[] = [];

  for (const m of text.matchAll(WORD_MONTH)) {
    push(out, {
      text: m[0].trim(),
      year: m[1] ? Number(m[1]) : null,
      month: MN_MONTH_WORDS[m[2]!.toLowerCase()]!,
      day: m[3] ? Number(m[3]) : null,
    });
  }
  for (const m of text.matchAll(NUMERIC_MONTH)) {
    push(out, {
      text: m[0].trim(),
      year: m[1] ? Number(m[1]) : null,
      month: Number(m[2]),
      day: m[3] ? Number(m[3]) : null,
    });
  }
  for (const m of text.matchAll(ISO)) {
    push(out, { text: m[0], year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
  }
  return out;
}

/** Огнооны 7 хоногийн нэр (он мэдэгдэж байвал) */
export function weekdayOf(d: MnDate): { mn: string; en: string } | null {
  if (d.year === null || d.day === null) return null;
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day));
  if (Number.isNaN(dt.getTime())) return null;
  const i = dt.getUTCDay();
  return { mn: MN_WEEKDAYS[i]!, en: EN_WEEKDAYS[i]! };
}

/**
 * Эх сурвалжид энэ огноо ямар ч хэлбэрээр дурдагдсан эсэх.
 *
 * Хайх хэлбэрүүд: «September 21», «Sept. 21», «Sep 21st», «21 September»,
 * «9/21», «2026-09-21», мөн тухайн өдрийн 7 хоногийн нэр («Sunday»).
 */
export function sourceHasDate(sourceText: string, d: MnDate): boolean {
  const s = sourceText.toLowerCase();
  const names = [
    Object.keys(EN_MONTHS).find((k) => EN_MONTHS[k] === d.month)!,
    ...(EN_ABBR[d.month] ?? []),
  ];

  if (d.day === null) {
    // Зөвхөн сар — сарын нэр таарвал хангалттай
    return names.some((n) => new RegExp(`(?<![a-z])${n}`, "u").test(s));
  }

  const day = d.day;
  for (const n of names) {
    // «september 21», «sept. 21st»
    if (new RegExp(`(?<![a-z])${n}[a-z]*\\.?\\s+${day}(?:st|nd|rd|th)?(?![\\d])`, "u").test(s)) return true;
    // «21 september», «21st of sept»
    if (new RegExp(`(?<![\\d])${day}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${n}`, "u").test(s)) return true;
  }
  // 9/21, 09/21, 2026-09-21
  const mm = String(d.month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  if (new RegExp(`(?<![\\d])${d.month}/${day}(?![\\d])`, "u").test(s)) return true;
  if (s.includes(`${mm}/${dd}`) || s.includes(`-${mm}-${dd}`)) return true;

  // 7 хоногийн нэр — эх сурвалж «on Sunday» гэж бичсэн бол огноо нь тодорхой
  const wd = weekdayOf(d);
  if (wd && new RegExp(`(?<![a-z])${wd.en}(?![a-z])`, "u").test(s)) return true;

  return false;
}

export type DateSeverity = "ноцтой" | "анхаарах";

export interface DateIssue {
  /** Биед бичигдсэн хэллэг */
  text: string;
  severity: DateSeverity;
  reason: string;
  /** Юу гэж засах вэ */
  suggestion: string;
}

/** Огноог эх сурвалжид хамааруулсан хэлбэр */
export function attributed(sourceName: string, phrase: string): string {
  return `${sourceName} ${phrase} мэдээлснээр`;
}

function sameDay(d: MnDate, at: Date | null): boolean {
  if (!at || d.day === null) return false;
  // publishedAtSource нь UTC — УБ руу шилжүүлэхгүй: эх сурвалжийн огноо нь өөрийнх нь бүсээр
  return at.getUTCMonth() + 1 === d.month && at.getUTCDate() === d.day &&
    (d.year === null || at.getUTCFullYear() === d.year);
}

/**
 * Биед бичсэн огноо бүрийг эх сурвалжтай тулгана.
 *
 * `publishedAtSource`-той яг таарч БАЙГАА атал эх текстэд байхгүй огноо нь хамгийн
 * ноцтой: энэ нь RSS-ийн метадата баримт болж хувирсан гэсэн үг.
 */
export function checkDates(a: {
  text: string;
  sourceText: string | null;
  publishedAtSource?: Date | null;
  sourceName?: string;
}): DateIssue[] {
  const source = a.sourceText ?? "";
  if (!source.trim()) return [];

  const out: DateIssue[] = [];
  for (const d of extractDates(a.text)) {
    if (sourceHasDate(source, d)) continue;

    const fromFeed = sameDay(d, a.publishedAtSource ?? null);
    out.push({
      text: d.text,
      severity: fromFeed ? "ноцтой" : "анхаарах",
      reason: fromFeed
        ? "эх нийтлэлд байхгүй огноо — энэ нь RSS-ийн нийтэлсэн огноо (pubDate) бөгөөд үйл явдлын огноо биш"
        : "эх нийтлэлд энэ огноо ямар ч хэлбэрээр байхгүй",
      suggestion: fromFeed
        ? `«${d.text}» -ийг хасах, эсвэл «${attributed(a.sourceName ?? "эх сурвалж", d.text)}» гэж эх сурвалжид хамааруулах`
        : `«${d.text}» -ийг хасах (эх сурвалжид байхгүй)`,
    });
  }
  return out;
}
