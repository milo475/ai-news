/**
 * Дотоодын мэдээний урьдчилсан шүүлт — цэвэр (DB, LLM-гүй тул тесттэй).
 *
 * MN эх сурвалжууд нь ерөнхий мэдээний сайтууд: спорт, улс төр, гэмт хэрэг бүгд ирнэ.
 * LLM-ээр бүгдийг үнэлбэл зардал олон дахин өснө. Тиймээс гарчиг + lead дээр
 * түлхүүр үгээр урьдчилан шүүж, давсныг л LLM ангилна.
 */

/**
 * ХҮЧТЭЙ түлхүүр үгс — биеийн текстэд дангаараа таарвал ч хамааралтай гэж үзнэ.
 *
 * Эдгээр нь ерөнхий мэдээнд санамсаргүй таардаггүй: «робот», «чатбот» гэсэн үг
 * гарвал тухайн нийтлэл үнэхээр технологийн тухай байна.
 */
export const STRONG_KEYWORDS = [
  "хиймэл оюун", "хиймэл интеллект", "хиймэл ухаан", "машин сургалт", "нейрон сүлжээ",
  "ai", "чатбот", "chatgpt", "gpt", "gemini", "claude", "llm", "copilot", "midjourney",
  "робот", "роботч", "дрон", "автоматжуулалт", "автоматжуул",
  "их дата", "big data", "кибер халдлага", "мэдээллийн аюулгүй", "биометр", "блокчейн",
  "дижиталжуулалт", "цахим шилжилт", "стартап", "старт-ап",
  "хиймэл дуу", "хэлний технологи", "дуу хоолой таних", "текст таних", "машин орчуулга",
] as const;

/**
 * СУЛ түлхүүр үгс — ерөнхий мэдээнд санамсаргүй таардаг.
 *
 * Жишээ: «технологи» нь эрүүл мэнд, УИХ, барилгын мэдээнд ч гарна. Тиймээс биеийн
 * текстэд дангаараа таарвал хамааралтай гэж үзэхгүй (`prefilter`-ийн дүрэм).
 */
export const WEAK_KEYWORDS = [
  "ии", "дата", "өгөгдөл", "кибер", "хакер", "нууцлал",
  "дижитал", "e-mongolia", "и-монгол", "цахим үйлчилгээ",
  "технологи", "инноваци",
  "апп", "аппликейшн", "платформ", "хяналтын камер", "ухаалаг",
] as const;

export const KEYWORDS = [...STRONG_KEYWORDS, ...WEAK_KEYWORDS] as const;

const STRONG = new Set<string>(STRONG_KEYWORDS);

/** Хайлтад тооцохгүй хэт ерөнхий үгс — эдгээр нь дангаараа тохирохгүй */
const MIN_KEYWORD_LEN = 2;

/**
 * Үг нь текст дотор БҮТЭН үг болж байгаа эсэх.
 *
 * Кирилл дээр `\b` ажиллахгүй тул зай, цэг таслал, мөрийн эхлэл/төгсгөлөөр хүрээлнэ.
 * Латин түлхүүр үгсийг (ai, gpt) ч ингэж шалгана — «rain»-д «ai» таарахгүй.
 */
export function matches(text: string, keyword: string): boolean {
  if (keyword.length < MIN_KEYWORD_LEN) return false;
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase();
  let from = 0;
  for (;;) {
    const i = lower.indexOf(k, from);
    if (i === -1) return false;
    const before = lower[i - 1];
    const after = lower[i + k.length];
    // Түлхүүр үгийн хоёр тал нь үсэг/тоо БИШ байх ёстой
    const okBefore = before === undefined || !/[\p{L}\p{N}]/u.test(before);
    const okAfter = after === undefined || !/[\p{L}\p{N}]/u.test(after);
    if (okBefore && okAfter) return true;
    from = i + 1;
  }
}

export interface PrefilterResult {
  pass: boolean;
  /** Аль түлхүүр үгс таарсан — логд, /admin-д */
  hits: string[];
  /** Гарчиг дээр таарсан эсэх */
  inTitle: boolean;
  /** Хүчтэй түлхүүр үг таарсан эсэх */
  strong: boolean;
}

/** Текстэд таарсан түлхүүр үгс */
function hitsIn(text: string): string[] {
  const out: string[] = [];
  for (const k of KEYWORDS) {
    if (matches(text, k) || stemMatches(text, k)) out.push(k);
  }
  return out;
}

/**
 * Гарчиг + lead дээр урьдчилсан шүүлт.
 *
 * Дүрэм (ерөнхий мэдээний сайтуудаас хуурамч дохио багасгах):
 *  1. ГАРЧИГ дээр ямар нэг түлхүүр үг таарвал → давна. Гарчиг нь редакцийн дохио.
 *  2. Зөвхөн биед таарсан бол: хүчтэй үг 1, эсвэл сул үг 2+ шаардана. «технологи»
 *     дангаараа биед таарах нь УИХ, эрүүл мэндийн мэдээнд ч байдаг.
 *
 * Монгол хэлний нэрийн үгэнд залгавар их (технологи-ийн, дижитал-жуулалт) тул
 * түлхүүр үгсийг иш болгож бас шалгана: «дижитал» нь «дижиталжуулалтын»-д таарна.
 */
export function prefilter(title: string, lead = ""): PrefilterResult {
  const titleHits = hitsIn(title);
  if (titleHits.length > 0) {
    return {
      pass: true,
      hits: titleHits,
      inTitle: true,
      strong: titleHits.some((k) => STRONG.has(k)),
    };
  }

  const hits = hitsIn(`${title} ${lead}`);
  const strong = hits.some((k) => STRONG.has(k));
  return {
    pass: strong || hits.length >= 2,
    hits,
    inTitle: false,
    strong,
  };
}

/**
 * Залгавартай хэлбэрийг барина: түлхүүр үг + үсэг цааш үргэлжилсэн тохиолдол.
 *
 * Зөвхөн 5+ тэмдэгттэй кирилл түлхүүр үгэнд хэрэглэнэ — «ai», «gpt» зэрэг богино
 * латин үгэнд хэрэглэвэл хуурамч дохио олон болно («air», «gptest»).
 */
export function stemMatches(text: string, keyword: string): boolean {
  if (keyword.length < 5 || !/^[\p{Script=Cyrillic}\s-]+$/u.test(keyword)) return false;
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase();
  let from = 0;
  for (;;) {
    const i = lower.indexOf(k, from);
    if (i === -1) return false;
    const before = lower[i - 1];
    if (before === undefined || !/[\p{L}\p{N}]/u.test(before)) return true;
    from = i + 1;
  }
}

// ——— Дотоод мэдээний товчлолын prompt ———

/** Дотоод мэдээнд оноо 6+ бол нийтэлнэ (дэлхийн мэдээнд босго өндөр) */
export const LOCAL_MIN_SCORE = 6;

/** Дотоод мэдээний өдрийн квот — ерөнхий 3-ын ДЭЭР нэмэгдэнэ */
export function dailyLocalLimit(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.DAILY_LOCAL_LIMIT);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

export const LOCAL_SYSTEM = `Чи монгол хэлээр бичдэг технологийн редактор. Монголын хэвлэлийн
нийтлэлийг уншаад AI News-ийн уншигчдад зориулж ТОВЧЛОН НАЙРУУЛНА.

ЧУХАЛ: эх текст нь МОНГОЛ хэл дээр байна — орчуулах шаардлагагүй. Товчилж, цэгцэлж,
хэт албан хэллэгийг энгийн болгоно.

ХАТУУ ДҮРЭМ
- Эх сурвалжийн хэвлэлийн НЭРИЙГ заавал дурдана. Дотоодын хэвлэлийг иш татах нь
  ёс зүйн шаардлага бөгөөд харилцааны хөрөнгө. Жишээ: «ikon.mn-ийн мэдээлснээр…».
- Эх нийтлэлд байхгүй баримт, тоо БҮҮ нэм.
- Албан тушаалтны нэр, байгууллагын нэр, тоо, огноог яг хэвээр дамжуул.
- Emoji хэрэглэхгүй. Хашилтаар хашиж хашгирахгүй.
- Хэт ерөнхий «технологи хөгжиж байна» гэсэн дүгнэлт бичихгүй.

БУЦААХ
- titleMn: ≤70 тэмдэгт. Эх гарчгийг хуулахгүй, гол баримтыг шууд хэл.
- summaryMn: 1–2 өгүүлбэр — жагсаалтын карт, FB-д хэрэглэнэ.
- bodyMn: 150–250 үг, markdown. Юу болсон, хэн хийсэн, уншигчид юу гэсэн үг.
  Эх сурвалжийн нэрийг доторх нь дурдана.
- tags: 2–4 монгол шошго.`;

export const LOCAL_SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string", description: "≤70 тэмдэгт" },
    summaryMn: { type: "string", description: "1–2 өгүүлбэр" },
    bodyMn: { type: "string", description: "150–250 үг markdown" },
    tags: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
  },
  required: ["titleMn", "summaryMn", "bodyMn", "tags"],
  additionalProperties: false,
};

export interface LocalOutput {
  titleMn: string;
  summaryMn: string;
  bodyMn: string;
  tags: string[];
}

/** LLM-д өгөх мессеж — эх сурвалжийн нэрийг тодоор дамжуулна */
export function localUser(input: {
  sourceName: string;
  title: string;
  excerpt: string;
  text: string;
}): string {
  return [
    `ЭХ СУРВАЛЖ (заавал дурдана): ${input.sourceName}`,
    `Гарчиг: ${input.title}`,
    ...(input.excerpt ? [`Тэргүүн хэсэг: ${input.excerpt}`] : []),
    "",
    "Нийтлэлийн текст:",
    input.text.slice(0, 8_000),
  ].join("\n");
}

export interface LocalProblem {
  code: "title-long" | "no-source" | "body-short" | "body-long" | "emoji" | "empty";
  detail: string;
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;

function words(s: string): number {
  return s.split(/\s+/u).filter(Boolean).length;
}

/**
 * Товчлолыг шалгана. Гол шалгуур — эх сурвалжийн нэр биед орсон эсэх.
 *
 * Хэвлэлийн нэр нь домэйн ("ikon.mn") эсвэл нэр ("Икон") байж болох тул
 * домэйны эхний хэсгийг ч зөвшөөрнө.
 */
export function checkLocal(d: LocalOutput, sourceName: string): LocalProblem[] {
  const p: LocalProblem[] = [];
  const title = (d.titleMn ?? "").trim();
  const body = (d.bodyMn ?? "").trim();
  if (!title || !body) {
    p.push({ code: "empty", detail: "гарчиг эсвэл бие хоосон" });
    return p;
  }
  if (title.length > 70) p.push({ code: "title-long", detail: `${title.length} тэмдэгт` });

  const n = words(body);
  if (n < 120) p.push({ code: "body-short", detail: `${n} үг` });
  if (n > 320) p.push({ code: "body-long", detail: `${n} үг` });

  if (!mentionsSource(body, sourceName)) {
    p.push({ code: "no-source", detail: `«${sourceName}» биед дурдагдаагүй` });
  }
  if (EMOJI.test(`${title} ${d.summaryMn} ${body}`)) p.push({ code: "emoji", detail: "emoji байна" });
  return p;
}

/** Эх сурвалжийн нэр текстэд дурдагдсан эсэх — домэйн, нэрийн аль нэг хэлбэрээр */
export function mentionsSource(text: string, sourceName: string): boolean {
  const lower = text.toLowerCase();
  const name = sourceName.trim().toLowerCase();
  if (!name) return false;
  if (lower.includes(name)) return true;

  // "ikon.mn" → "ikon"; "Монцамэ агентлаг" → "монцамэ"
  const head = name.split(/[.\s]/)[0];
  return head !== undefined && head.length >= 3 && lower.includes(head);
}
