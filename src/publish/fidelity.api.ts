/**
 * Гарчгийн үнэн зөв байдлын шалгуур — цэвэр хэсэг (LLM-гүй, DB-гүй, тесттэй).
 *
 * Яагаад хэрэгтэй: 2026-09-27-нд картын гарчиг эх мэдээг хэтрүүлж байв —
 *   · «муж OpenAI-г шүүхэд өгчээ» → «чатбот халдлагад нөлөөлжээ» (буруутгал → баримт)
 *   · «Anthropic шинэ ферментийн систем илрүүлснээ зарлав» → «эрдэмтдийн оронд 950 AI»
 *   · «1,500 оролцогчтой шалгаруулалтын нэг төрөлд дэд байр» → «1,500 төслөөс хоёрт»
 *
 * Хоёр давхар хамгаалалт:
 *   1. Механик (энд): эх сурвалж нь буруутгал/мэдэгдэл бол гарчигт ишлэл үлдсэн эсэх.
 *   2. LLM шүүгч (fidelity.ts): гарчиг ба нийтлэлийг харьцуулж {faithful, issues}.
 */

/** Нийтлэл дэх «энэ бол хэн нэгний үг, тогтсон үнэн биш» шинжүүд */
const ATTRIBUTION_SOURCE = [
  "буруутга", "шүүхэд", "нэхэмжлэл", "шүүх хурал", "гэж үзэж", "гэж үзэн", "гэж мэдэгд",
  "мэдэгдэв", "мэдэгдлээ", "зарлав", "зарлалаа", "танилцуул", "судалгаагаар", "судалгаанд",
  "тайлагнав", "хэмээн", "таамагла", "гэж үзсэн", "гэж хэлэв", "гэж буруутгав",
];

/** Гарчигт ишлэл үлдсэн болохыг илтгэх шинжүүд */
const ATTRIBUTION_HOOK = [
  "гэж ", "гэв", "хэмээн", "буруутга", "шүүхэд", "нэхэмжлэл", "мэдэгд", "зарла",
  "судалгаагаар", "судалгаанд", "таамагла", "гэсэн", "тайлагна", "үзэж байна",
];

function hasAny(text: string, needles: string[]): boolean {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n));
}

/** Эх мэдээ нь буруутгал/мэдэгдэл/судалгаа мөн үү — тийм бол гарчигт эх сурвалж үлдэх ёстой */
export function needsAttribution(sourceText: string): boolean {
  return hasAny(sourceText, ATTRIBUTION_SOURCE);
}

/** Гарчигт ишлэл байна уу */
export function hasAttribution(hook: string): boolean {
  return hasAny(hook, ATTRIBUTION_HOOK);
}

/**
 * Буруутгалыг баримт болгосон эсэх — механик шалгалт.
 * Эх мэдээ нь ишлэлтэй атал гарчиг нь шууд батлан хэлж байвал зөрчил.
 */
export function dropsAttribution(hook: string, sourceText: string): boolean {
  return needsAttribution(sourceText) && !hasAttribution(hook);
}

/**
 * «Түр зогсоосон» → «зогсоолоо» төрлийн зөрчил.
 *
 * 2026-09-27-ны production алдаа: эх мэдээ «OpenAI pauses training» (ТҮР зогсоосон)
 * байсан атал improve алхам гарчгаас «түр»-ийг хасаж «…сургалтыг зогсоолоо» болгосон;
 * FB/IG текст бүр «БҮРЭН зогсоолоо» гэж өргөжсөн. Хэсэгчилсэн, буцаагдах боломжтой
 * үйлдлийг эцсийн шийдвэр мэт харуулах нь хамгийн ноцтой гуйвуулалтуудын нэг.
 */
const HEDGE_WORDS = [
  "түр", "хэсэгчилсэн", "хэсэгчлэн", "зарим", "хойшлуул", "түдгэлзүү", "завсарла",
  "түтгэлзүү", "зогсоолттой", "pause", "temporar", "partial", "suspend",
];

/**
 * Эцсийн, буцаахгүй мэт сонсогдох үйл үг.
 *
 * «бүрэн», «бүхэлд» гэх ЧАНГАРУУЛАГЧ үгс дангаараа энд ОРОХГҮЙ: «дэвшилтэт
 * хяналтын систем дангаараа аюулгүй байдлыг БҮРЭН шийдэж чадахгүй» гэсэн
 * зөв өгүүлбэрийг зөрчил гэж барьж байв. Эцсийн шийдвэрийг илэрхийлэх нь
 * үйл үг өөрөө — «зогсоолоо», «цуцаллаа».
 */
const FINALITY_WORDS = [
  "зогсоолоо", "зогсоов", "зогсоожээ", "зогсоосон", "зогслоо", "зогсоож",
  "хаалаа", "хаав", "хаажээ", "хаасан",
  "цуцаллаа", "цуцалав", "цуцалжээ", "цуцалсан",
  "болилоо", "болив", "болижээ", "татгалзлаа", "татгалзав", "татгалзжээ",
  "бүрмөсөн зогсоо", "бүр мөсөн зогсоо", "бүрэн зогсоо",
];

export function hasHedge(text: string): boolean {
  return hasAny(text, HEDGE_WORDS);
}

export function hasFinality(text: string): boolean {
  return hasAny(text, FINALITY_WORDS);
}

/**
 * Эх мэдээ нь «түр/хэсэгчилсэн» атал гаргалт нь эцсийн мэт болсон эсэх.
 * Гаргалт өөрөө hedge-ээ хадгалсан бол зөрчил биш.
 */
export function dropsHedge(text: string, sourceText: string): boolean {
  return hasHedge(sourceText) && !hasHedge(text) && hasFinality(text);
}

/**
 * ДАМЖУУЛСАН эх сурвалжийг орхих.
 *
 * 2026-09-27: Futurism-ийн мэдээ «According to Bloomberg, the Pentagon's investigation
 * concluded…» байсныг гарчиг «…цохисныг Пентагон тогтоов» болгож, «Bloomberg-ийн
 * мэдээлснээр» гэсэн давхаргыг хассан. Мөрдөн шалгалтын тайлан нийтлэгдээгүй,
 * шалгалт үргэлжилж байхад «тогтоов» гэдэг нь албан ёсны дүгнэлт мэт сонсогдоно.
 */
const RELAY_WORDS = [
  "мэдээлснээр", "мэдээлсэнээр", "мэдээлснийг", "бичсэнээр", "сурвалжилс", "дамжуулснаар",
  "мэдээлснээс", "тайлагнаснаар", "эх сурвалж", "according to", "reported", "sources say",
];

/**
 * Гаргалт талд дамжуулалт үлдсэнийг илтгэх шинжүүд — эх сурвалжийн жагсаалтаас
 * ӨРГӨН (ATTRIBUTION_SOURCE / ATTRIBUTION_HOOK хосын адил). Гарчиг нь «…гэж
 * Bloomberg мэдээлэв» гэж бичигдвэл тэр нь дамжуулалтаа хадгалсан хэрэг.
 */
const RELAY_HOOK = [
  ...RELAY_WORDS,
  "мэдээлэв", "мэдээллээ", "мэдээлсэн", "мэдээлж", "мэдээлжээ", "бичив", "бичжээ",
  "сурвалжил", "дамжуул", "тайлагна", "нийтэлсэн", "нийтлэв",
];

export function hasRelay(text: string): boolean {
  return hasAny(text, RELAY_WORDS);
}

/** Гаргалт дамжуулсан эх сурвалжаа хадгалсан эсэх */
export function keepsRelay(text: string): boolean {
  return hasAny(text, RELAY_HOOK);
}

/** Эх мэдээ нь дамжуулсан атал гаргалт нь шууд мэдсэн мэт бичсэн эсэх */
export function dropsRelay(text: string, sourceText: string): boolean {
  return hasRelay(sourceText) && !keepsRelay(text);
}

/**
 * Эх сурвалж хэдэн болгоомжлолын тэмдэглэгээтэй вэ — дор хаяж хоёр байвал
 * тухайн мэдээ нь үнэхээр тодорхойгүй баримтын тухай (MODALITY_MIN).
 */
export const MODALITY_MIN = 2;

export function countSpeculation(text: string): number {
  const t = text.toLowerCase();
  return SPECULATION_WORDS.filter((w) => t.includes(w)).length;
}

/**
 * ТААМАГ → БАТАЛГАА.
 *
 * 2026-09-27: эх мэдээнд Трамп бичлэгийг «could have been generated by AI» гэж
 * САНАЛ БОЛГОСОН байтал манай текст «хуурамч гэж МЭДЭГДСЭН» болгосон. «Магадгүй»
 * гэдгийг «тогтоов» болгох нь хамгийн амархан гардаг бөгөөд хамгийн ноцтой гуйвуулалт.
 */
const SPECULATION_WORDS = [
  "магадгүй", "байж болзошгүй", "байж болох", "байж мэдэх", "таамаг", "санал болгов",
  "санал болгосон", "гэж үзэж болох", "боломжтой гэв", "эргэлзэж", "сэжиглэж",
  "бололтой", "төлөвтэй", "гэх мэдээлэл", "гэх ярьц",
  // «…илрүүлсэн эсэх» гэдэг нь тодорхойгүйг илэрхийлнэ — батлах биш
  "эсэх", "эсэхийг", "үгүй юу", "тодорхойгүй",
  "could have", "may have", "might", "suggested", "alleged", "possibly",
  // «likely similar» -ийг «төстэй» болгосон (г) тохиолдлоос хойш нэмэгдсэн
  "likely", "probably", "potentially", "appears to", "appeared to", "seem to", "seems to",
  "seemed to", "reportedly", "could be", "may be", "as-yet", "downplayed", "it is unclear",
];

/**
 * Монгол үйл үгийн нөхцөлүүд — «тогтоо» → тогтоов, тогтоолоо, тогтоожээ …
 *
 * Жагсаалтад нэг хэлбэрийг л бичих нь хангалтгүй байв: Пентагоны мэдээний биед
 * «тогтоолоо» гэж бичигдсэн байхад жагсаалтад «тогтоов» л байсан тул шалгалт
 * өнгөрчихсөн. Нөхцөлүүдийг үндсээс нь автоматаар үүсгэнэ.
 */
const VERB_ENDINGS = [
  "в", "ав", "эв", "ов", "өв",
  "лаа", "лээ", "лоо", "лөө",
  "жээ", "чээ",
  "сан", "сэн", "сон", "сөн",
  "ж", "аж", "эж", "ож", "өж",
];

/** Үндсээс бүх нөхцөлийг үүсгэнэ — байхгүй хэлбэр үүссэн ч хор хөнөөлгүй (таарахгүй) */
export function inflections(...stems: string[]): string[] {
  return stems.flatMap((s) => VERB_ENDINGS.map((e) => s + e));
}

/** Тогтоогдсон баримт мэт сонсогдох үйл үг */
const ASSERTION_WORDS = [
  // Үндэс нь нөхцөлд хураагддаг («нотол» → «нотлов») тул хоёр хэлбэрийг нь өгнө
  ...inflections("тогтоо", "батал", "батл", "нотол", "нотл", "илрүүл", "мэдэгд", "мэдэгдэ", "дүгнэ", "дүгн"),
  "баталгаажуул", "гэдэг нь тогтоогдов", "болохыг тогтоов",
];

export function hasSpeculation(text: string): boolean {
  return hasAny(text, SPECULATION_WORDS);
}

export function hasAssertion(text: string): boolean {
  return hasAny(text, ASSERTION_WORDS);
}

/** Өгүүлбэрт хуваана — «.», «!», «?» дараах зай/мөр */
export function sentencesOf(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
}

/**
 * Эх нь таамаг байтал гаргалт нь баталгаа болсон эсэх.
 *
 * ӨГҮҮЛБЭР ТУС БҮРЭЭР шалгана: урт хураангуйд нэг өгүүлбэр дамжуулалтаа хадгалж,
 * нөгөө нь хатуу батлан хэлж байж болно. Мөн **тухайн өгүүлбэр дамжуулалтаа
 * хадгалсан бол зөрчил биш** — «Bloomberg-ийн мэдээлснээр … гэж дүгнэжээ» гэдэг
 * нь бидний биш, эх сурвалжийн батлалт гэдгийг уншигч ойлгоно.
 */
export function hardensSpeculation(text: string, sourceText: string): boolean {
  return speculationVerdict(text, sourceText) !== null;
}

/**
 * Зөрчлийн ХҮЧ — нийтлэхийг зогсоох уу, эсвэл шүүгчид үлдээх үү.
 *
 * Механик дүрэм нь ҮНЭНЧ ишлэлийг («…гэж Ерөнхий сайд мэдэгдэв» — эх сурвалж
 * дээр ч тэр хүн яг тэгж хэлсэн) ХҮЧТЭЙ БОЛГОСОН ишлэлээс («Трамп санал
 * болгосныг» → «Трамп мэдэгдсэн») ялгаж чадахгүй: хоёулаа «гэж … мэдэгдэв»
 * хэлбэртэй.
 *
 * Тиймээс: ишлэлгүй, шууд батлан хэлсэн өгүүлбэр бол НОЦТОЙ (нийтлэл зогсоно);
 * ишлэлтэй бол АНХААРАХ — хэн хэлснийг нь заасан тул уншигч тогтсон үнэн гэж
 * уншихгүй, харин ишлэлийн хүч зөв эсэхийг LLM шүүгч шийднэ.
 */
export function speculationVerdict(text: string, sourceText: string): "ноцтой" | "анхаарах" | null {
  // Урт нийтлэлд санамсаргүй тааралдсан НЭГ «may» нь гол мэдэгдлийг таамаг
  // болгодоггүй — MODALITY_MIN-тэй ижил босго (хэмжилт: 20 нийтлэлийн эх
  // текстэд 0–5 тэмдэглэгээ, 1-тэй нь бүгд баталгаатай мэдээ байв)
  if (countSpeculation(sourceText) < MODALITY_MIN) return null;

  const offending = sentencesOf(text).filter(
    (s) => hasAssertion(s) && !hasSpeculation(s) && !keepsRelay(s),
  );
  if (offending.length === 0) return null;
  return offending.some((s) => !hasAttribution(s)) ? "ноцтой" : "анхаарах";
}

// ---------- ЭХ СУРВАЛЖТАЙ ШУУД ТУЛГАХ (англи эх → монгол гаргалт) ----------

/**
 * Эх нийтлэл нь ӨӨР хэвлэлээс дамжуулж байгаа эсэх — дамжуулсан хэвлэлийн НЭР.
 *
 * `hasRelay` нь «reported» гэх үгийг хаанаас ч олдог тул («users reported issues»)
 * бүх нийтлэлийг зөрчилтэй болгоно. Дамжуулалт гэдэг нь **нэртэй хэвлэл** рүү
 * заасан тохиолдол: «According to new reporting by Bloomberg…». Нэрийг нь
 * буцаавал засварын саналд шууд оруулж болно.
 */
/**
 * Нэрийг ТОМ үсгээр нь таних тул `i` тугийг ашиглаж болохгүй — түлхүүр үгсийн
 * эхний үсгийг өөрийг нь хоёр хэлбэрээр бичнэ.
 */
const NAME = "([A-Z][\\w.]*(?: [A-Z][\\w.]*){0,2})";

const RELAY_NAMED: RegExp[] = [
  new RegExp(`[Aa]ccording to (?:new |recent |a |the )*(?:report(?:ing|s)?|story|article) (?:by|from|in) ${NAME}`),
  new RegExp(`[Aa]ccording to ${NAME}`),
  new RegExp(`(?:first )?[Rr]eport(?:ed|s) (?:by|in) ${NAME}`),
  // «As reports of X pile up» гэх НЭР ҮГИЙГ үйл үг гэж андуурахгүй — зөвхөн
  // «X reported that…», «X first reported» гэсэн тодорхой хэлбэрүүд
  new RegExp(`${NAME} (?:first )?reported\\b`),
  new RegExp(`${NAME} reports that\\b`),
  new RegExp(`[Ss]ources? (?:told|said to) ${NAME}`),
  new RegExp(`[Ii]nterviewed by ${NAME}`),
];

/** Нэр биш — өгүүлбэрийн эхний үг том үсгээр бичигддэг */
const NOT_OUTLET = new Set([
  "The", "A", "An", "It", "In", "On", "This", "That", "These", "Those", "But", "And",
  "He", "She", "They", "We", "I", "His", "Her", "Their", "Its", "One", "Some", "Many",
  // Өгүүлбэрийн эхэнд том үсгээр бичигддэг түлхүүр үгс
  "As", "According", "Reports", "Report", "Reported", "Sources", "Interviewed", "When",
  "While", "After", "Before", "Now", "Yet", "If", "Since", "Although", "Meanwhile", "Per",
]);

export function relaySource(sourceText: string): string | null {
  for (const re of RELAY_NAMED) {
    const name = re.exec(sourceText)?.[1]?.trim();
    if (!name) continue;
    const head = name.split(" ")[0]!;
    if (NOT_OUTLET.has(head)) continue;
    return name.replace(/[.,]+$/, "");
  }
  return null;
}

/**
 * Эх нийтлэл нэртэй хэвлэлээс дамжуулж байтал манай текст тэр давхаргыг хассан эсэх.
 *
 * 2026-09-27: Futurism «According to new reporting by Bloomberg, the Pentagon's
 * investigation … concluded» гэж бичсэнийг манай гарчиг «…цохисныг Пентагон
 * тогтоов» болгосон. Мөрдөн шалгалтын тайлан нийтэд гараагүй, нэрээ нууцалсан
 * мөрдөн шалгагчдын яриа байхад «Пентагон тогтоов» нь албан ёсны дүгнэлт мэт.
 */
export function dropsSourceRelay(text: string, sourceText: string): boolean {
  const outlet = relaySource(sourceText);
  if (!outlet) return false;
  // Хэвлэлийн нэрийг өөрийг нь бичсэн бол дамжуулалт хадгалагдсан
  if (text.toLowerCase().includes(outlet.split(" ")[0]!.toLowerCase())) return false;
  // «…гэж буруутган шүүхэд өгчээ» нь мөн танин мэдэхүйн зайг хадгалсан хэрэг —
  // уншигч үүнийг тогтоогдсон баримт гэж уншихгүй
  return !keepsRelay(text) && !hasAttribution(text);
}

// ---------- МОДАЛЬ УТГА ----------

/**
 * Эх нийтлэлийн болгоомжлол (could, likely, suggested…) манай текстэд үлдсэн эсэх.
 *
 * (г) тохиолдол: «an as-yet unidentified AI targeting system, LIKELY similar to
 * the one used by…» гэснийг «уг системтэй төстэй» болгосон — «магадгүй» алга.
 * Нэг тэмдэглэгээ санамсаргүй тааралдаж болох тул хоёроос доошгүй байхыг шаардана.
 */
export function dropsModality(text: string, sourceText: string): boolean {
  return countSpeculation(sourceText) >= MODALITY_MIN && !hasSpeculation(text) && !hasHedge(text);
}

// ---------- ХУУЛЬ ЗҮЙН ТОМЬЁОЛОЛ ----------

/**
 * Хуулийн болзолт томьёоллыг хүчтэй болгох.
 *
 * (б) тохиолдол: НҮБ-ын комисс «there are “reasonable grounds” to conclude the US
 * attacks amount to “war crimes”» гэснийг манай текст «дайны гэмт хэрэг гэж үзэх
 * БҮРЭН ҮНДЭСЛЭЛТЭЙ» болгосон. «Reasonable grounds» нь мөрдөн шалгах болзол
 * болохоос тогтоогдсон гэм биш — эрх зүйн утга нь эрс өөр.
 */
export const LEGAL_HEDGE = [
  "reasonable grounds", "reasonable ground", "probable cause", "prima facie",
  "credible allegations", "credible evidence", "may amount to", "could amount to",
  "amount to", "alleged", "allegation", "accused of", "suspected of",
];

/** Эргэлзээгүй тогтоогдсон мэт сонсогдох монгол хэллэг */
export const LEGAL_ABSOLUTE = [
  "бүрэн үндэслэлтэй", "бүрэн нотлогдсон", "маргаангүй", "эргэлзээгүй",
  "баттай нотлогдсон", "гэмт хэрэг болохыг тогтоов", "гэм буруутай нь тогтоогдсон",
];

export function hasLegalHedge(text: string): boolean {
  return hasAny(text, LEGAL_HEDGE);
}

export function hasLegalAbsolute(text: string): boolean {
  return hasAny(text, LEGAL_ABSOLUTE);
}

/** Эх нь болзолт хэллэгтэй атал манай текст эргэлзээгүй мэт болсон эсэх */
export function hardensLegal(text: string, sourceText: string): boolean {
  return hasLegalHedge(sourceText) && hasLegalAbsolute(text);
}

// ---------- LLM шүүгч ----------

export interface FidelityVerdict {
  faithful: boolean;
  issues: string[];
}

/** Юуг шалгаж байна вэ — нэг шүүгч гурван газар ажиллана */
export type FidelityKind = "гарчиг" | "FB текст" | "IG тайлбар" | "тоймын хэсэг";

export const FIDELITY_SYSTEM = `Чи баримт шалгагч. Нийтлэлээс гаргасан {{KIND}} нь эх нийтлэлдээ үнэнч эсэхийг шалгана.

{{KIND}} нь нийтлэлд БАЙГАА зүйлийг л хэлэх ёстой. Дараах бол ЗӨРЧИЛ (faithful=false):

1. НЭМСЭН БАРИМТ — нийтлэлд байхгүй зүйл, тодотгол, шинж чанар.
   Жишээ: нийтлэлд зүгээр «чатбот» гэснийг «хүүхдийн ашигладаг чатбот» гэж бичсэн.

2. БУРУУТГАЛЫГ БАРИМТ БОЛГОСОН — нийтлэлд «...гэж буруутгав / шүүхэд өгчээ / гэж үзэж байна»
   гэснийг гарчигт болсон явдал мэт шууд батлан бичсэн.
   Жишээ: «муж ChatGPT-ийг халдлагад хүргэсэн гэж үзэн шүүхэд өгчээ» →
   «чатбот халдлагад нөлөөлжээ» нь ЗӨРЧИЛ.

3. ШАЛТГААН-ҮР ДАГАВРЫГ ЗОХИОСОН — нийтлэлд байхгүй «улмаас / -аас болж / орлож» холбоос.
   Жишээ: «AI ферментийн систем илрүүлэв» → «эрдэмтдийн ОРОНД AI илрүүлэв» нь ЗӨРЧИЛ.

4. ХАМРАХ ХҮРЭЭГ ӨӨРЧИЛСӨН — нэг муж → улс даяар, нэг төрөл → бүх төрөл,
   оролцогч → төсөл, дэд байр → хоёрт шалгарсан гэх мэт.

5. ТООГ КОНТЕКСТООС НЬ САЛГАСАН — тоо нь нийтлэлд өөр зүйлийг тоолж байсан.
   Жишээ: «1500 оролцогчтой тэмцээний нэг төрөлд шалгарав» → «1500 төслөөс хоёрт» нь ЗӨРЧИЛ.

6. МЭДЭГДЭЛ, СУДАЛГАА, ТААМГИЙГ ТОГТСОН ҮНЭН МЭТ бичсэн — хэн хэлснийг нь орхисон.

7. ТҮР / ХЭСЭГЧИЛСЭНИЙГ БҮРЭН, ЭЦСИЙН БОЛГОСОН — нийтлэлд «түр зогсоосон /
   хойшлуулсан / зарим хэсгийг / түдгэлзүүлсэн» гэснийг «зогсоолоо / бүрэн зогсоов /
   хаалаа / цуцаллаа» гэж эцсийн шийдвэр мэт бичсэн.
   Жишээ: «OpenAI сургалтаа ТҮР зогсоов» → «OpenAI сургалтаа зогсоолоо» нь ЗӨРЧИЛ;
   «…сургалт болон үнэлгээгээ БҮРЭН зогсоолоо» нь бүр ноцтой ЗӨРЧИЛ.
   Эсрэгээр «бүрэн хориглов» гэснийг «түр хязгаарлав» гэж зөөлрүүлэх нь бас ЗӨРЧИЛ.

8. ДАМЖУУЛСАН ЭХ СУРВАЛЖИЙГ ОРХИСОН — нийтлэлд «Bloomberg-ийн мэдээлснээр»,
   «X сониноос дамжуулснаар», «эх сурвалжийн мэдээлснээр» гэж БАЙГАА атал гарчигт
   тэр давхаргыг хассан.
   Жишээ: «Bloomberg-ийн мэдээлснээр Пентагоны шалгалт … гэж дүгнэжээ» →
   «…цохисныг Пентагон тогтоов» нь ЗӨРЧИЛ — албан ёсны дүгнэлт нийтлэгдээгүй,
   шалгалт үргэлжилж байгаа. Зөв нь: «…гэж Bloomberg мэдээлэв».

9. ТААМГИЙГ БАТАЛГАА БОЛГОСОН — «магадгүй / байж болзошгүй / санал болгов /
   сэжиглэж байна» гэснийг «мэдэгдсэн / тогтоов / баталсан / нотлов» болгосон.
   Жишээ: «Трамп бичлэгийг хиймэл оюунаар үүсгэсэн БАЙЖ БОЛОХ гэж санал болгов» →
   «Трамп бичлэгийг хуурамч гэж мэдэгдсэн» нь ЗӨРЧИЛ.

ЗӨРЧИЛ БИШ:
- Товчилсон, өөр үгээр хэлсэн, сонирхолтой болгосон — УТГА нь хэвээр бол зүгээр.
- Нийтлэлийн аль ч хэсэгт байгаа баримтыг ашигласан (зөвхөн гарчигт биш).
- Тоог бөөрөнхийлсөн («1,487» → «бараг 1500»).

issues: зөрчил бүрийг НЭГ богино өгүүлбэрээр — юу нь буруу, юу гэж байвал зөв болохыг хэл.
Зөрчилгүй бол issues хоосон массив, faithful=true.

Зөвхөн JSON.`;

/** Шалгах зүйлийн төрлөөр system prompt-ыг тохируулна */
export function fidelitySystem(kind: FidelityKind = "гарчиг"): string {
  return FIDELITY_SYSTEM.replaceAll("{{KIND}}", kind.toUpperCase());
}

export const FIDELITY_SCHEMA = {
  type: "object",
  properties: {
    faithful: { type: "boolean", description: "Шалгаж буй текст эх нийтлэлдээ үнэнч эсэх" },
    issues: {
      type: "array",
      items: { type: "string" },
      description: "Зөрчил бүр нэг өгүүлбэрээр. Зөрчилгүй бол хоосон.",
    },
  },
  required: ["faithful", "issues"],
  additionalProperties: false,
};

export interface FidelityInput {
  /** Шалгах текст — гарчиг, FB текст эсвэл IG тайлбар */
  hook: string;
  kind?: FidelityKind;
  titleMn: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
}

/** Нийтлэлээс шүүгчид өгөх хэсгийн дээд урт */
export const FIDELITY_BODY_CHARS = 2_000;

export function fidelityUser(a: FidelityInput): string {
  return [
    `ШАЛГАХ ${(a.kind ?? "гарчиг").toUpperCase()}: ${a.hook.trim()}`,
    "",
    "--- ЭХ НИЙТЛЭЛ ---",
    `Гарчиг: ${a.titleMn ?? ""}`,
    `Хураангуй: ${a.summaryMn ?? ""}`,
    `Текст: ${(a.bodyMn ?? "").slice(0, FIDELITY_BODY_CHARS)}`,
  ].join("\n");
}

/** Өдөрт ийм удаагаас олон унавал шүүгч эвдэрсэн байж болзошгүй */
export const FIDELITY_DAILY_WARN = 3;

/**
 * Шүүгчийн хариу шийдвэр болохуйц уу.
 *
 * `faithful` нь заавал boolean байх ёстой: дутуу/хоосон хариуг «үнэнч» гэж уншвал
 * шалгагдаагүй гарчиг нийтэд гарна.
 */
export function isUsableVerdict(raw: Partial<FidelityVerdict> | null | undefined): boolean {
  return typeof raw?.faithful === "boolean" && Array.isArray(raw?.issues);
}

/** Шүүгчийн хариуг цэгцэлнэ — issues байвал faithful гэж тооцохгүй */
export function normalizeVerdict(raw: Partial<FidelityVerdict> | null | undefined): FidelityVerdict {
  const issues = (raw?.issues ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
  // Загвар заримдаа faithful=true атлаа зөрчил жагсаадаг — зөрчил давуу
  return { faithful: raw?.faithful === true && issues.length === 0, issues };
}
