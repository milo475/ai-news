/**
 * «Промпт студи»-ийн цэвэр хэсэг — хэрэгслийн каталог, хэлбэр таних, хязгаар,
 * төсөв, LLM-ийн prompt ба схемүүд. DB, сүлжээ, огноо-хамааралгүй тул бүрэн тесттэй.
 *
 * Санаа: хэрэглэгч «шинэ жилийн мэндчилгээ видео хэрэгтэй» гэж бичнэ. Студи нь
 * 1) юу хийхийг нь тодруулж асууна, 2) бүтэцтэй brief болгоно, 3) 3 чиглэл санал
 * болгоно, 4) сонгосон хэрэгсэл бүрд бэлэн промпт + параметр + монгол тайлбар өгнө.
 */

export type StudioFormat = "IMAGE" | "VIDEO" | "TEXT" | "AUDIO" | "SLIDES";

export const FORMATS: StudioFormat[] = ["IMAGE", "VIDEO", "TEXT", "AUDIO", "SLIDES"];

export const FORMAT_LABEL: Record<StudioFormat, string> = {
  IMAGE: "Зураг",
  VIDEO: "Видео",
  TEXT: "Бичвэр",
  AUDIO: "Дуу, хөгжим",
  SLIDES: "Слайд",
};

// ---------- Хэрэгслийн каталог ----------

export interface StudioTool {
  id: string;
  name: string;
  /** Ямар хэлбэрт санал болгох вэ */
  formats: StudioFormat[];
  /** src/studio/tools/<doc>.md */
  doc: string;
  /** Үнэгүй хэрэглэж болох эсэх (Монголоос картгүй) */
  free: boolean;
  /** Жагсаалтад харуулах нэг мөр */
  note: string;
  /** Угсралтын хэрэгсэл — промпт биш, эцсийн алхам болж ордог */
  assembly?: boolean;
  /** Хаагдсан/ажиллахаа больсон — санал болгохгүй */
  retired?: boolean;
}

/**
 * Хэрэгслүүд. `doc` файл бүрд «сүүлд шалгасан огноо» ба эх холбоос бий
 * (src/studio/tools/*.md). Prompt-д зөвхөн сонгосон хэрэгслийн файлыг оруулна.
 */
export const TOOLS: StudioTool[] = [
  {
    id: "gemini", name: "Gemini (Nano Banana)", formats: ["IMAGE", "TEXT", "SLIDES"], doc: "gemini",
    free: true, note: "Үнэгүй, лавлагаа зургаар дүрээ тогтвортой барина",
  },
  {
    id: "chatgpt", name: "ChatGPT", formats: ["TEXT", "IMAGE", "SLIDES"], doc: "chatgpt",
    free: true, note: "Монгол хэл сайн ойлгоно; зураг үнэгүйд өдөрт 2–3",
  },
  {
    id: "ideogram", name: "Ideogram", formats: ["IMAGE"], doc: "ideogram",
    free: true, note: "Зураг дээр латин текст зөв бичдэг",
  },
  {
    id: "midjourney", name: "Midjourney", formats: ["IMAGE"], doc: "midjourney",
    free: false, note: "Чанар хамгийн өндөр, гэхдээ төлбөртэй",
  },
  {
    id: "kling", name: "Kling", formats: ["VIDEO"], doc: "kling",
    free: true, note: "Өдөрт 66 үнэгүй кредит — тогтмол ажиллахад тохиромжтой",
  },
  {
    id: "veo", name: "Veo (Google)", formats: ["VIDEO"], doc: "veo",
    free: true, note: "Дуу, чимээг промптоос гаргана. Клип 4–8 секунд",
  },
  {
    id: "runway", name: "Runway", formats: ["VIDEO"], doc: "runway",
    free: false, note: "Зургаас видео сайн; үнэгүй кредит нэг удаагийн",
  },
  {
    id: "pika", name: "Pika", formats: ["VIDEO"], doc: "pika",
    free: true, note: "Эффект хурдан; үнэгүйд 480p, усан тэмдэгтэй",
  },
  {
    id: "heygen", name: "HeyGen", formats: ["VIDEO"], doc: "heygen",
    free: true, note: "Ярьж буй аватар; үнэгүйд сард 3 видео",
  },
  {
    id: "suno", name: "Suno", formats: ["AUDIO"], doc: "suno",
    free: true, note: "Хөгжим. Монгол дуу үг гажих магадлалтай",
  },
  {
    id: "canva", name: "Canva", formats: ["IMAGE", "SLIDES"], doc: "canva",
    free: true, assembly: true, note: "Монгол текстээ энд нэмнэ",
  },
  {
    id: "capcut", name: "CapCut", formats: ["VIDEO"], doc: "capcut",
    free: true, assembly: true, note: "Клипүүдээ залгаж, субтитр тавина",
  },
  // Хаагдсан — зөвхөн хэрэглэгч нэрлэвэл тайлбарлахад
  {
    id: "sora", name: "Sora", formats: ["VIDEO"], doc: "sora",
    free: false, retired: true, note: "2026 онд хаагдсан — Veo эсвэл Kling ашигла",
  },
];

export function toolById(id: string, tools = TOOLS): StudioTool | null {
  return tools.find((t) => t.id === id) ?? null;
}

/** Тухайн хэлбэрт санал болгох хэрэгслүүд. Хаагдсаныг оруулахгүй. */
export function toolsFor(format: StudioFormat, tools = TOOLS): StudioTool[] {
  return tools.filter((t) => !t.retired && t.formats.includes(format));
}

/**
 * Анхны сонголт: үнэгүй үүсгэгч + угсралтын хэрэгсэл.
 *
 * Монголын хэрэглэгчийн ихэнх нь картгүй тул **үнэгүй хувилбарыг урьдчилж
 * тавина**; төлбөртэйг нь «илүү сайн чанар хүсвэл» гэж нэмэлтээр санал болгоно.
 */
export function defaultTools(format: StudioFormat, tools = TOOLS): string[] {
  const list = toolsFor(format, tools);
  const gen = list.filter((t) => t.free && !t.assembly).slice(0, 2);
  const asm = list.filter((t) => t.assembly).slice(0, 1);
  return [...gen, ...asm].map((t) => t.id);
}

/** Хаагдсан хэрэгслийг сольж өгнө */
export function retiredNote(id: string, tools = TOOLS): string | null {
  const t = toolById(id, tools);
  return t?.retired ? t.note : null;
}

// ---------- Хэлбэр таних ----------

const FORMAT_HINTS: [StudioFormat, RegExp][] = [
  [
    "VIDEO",
    /(видео|бичлэг|reels|рийлс|tiktok|тикток|shorts|шортс|сурталчилгааны роли|клип|storyboard|кадар|анимаци|мэндчилгээ.*бичлэг)/iu,
  ],
  [
    "AUDIO",
    /(хөгжим|дуу\b|дуу\s|дууны|аялгуу|подкаст|саундтрек|jingle|жингл|дуу хоолой|дикци)/iu,
  ],
  [
    "SLIDES",
    /(слайд|танилцуулга|презент|илтгэл|powerpoint|pitch\s*deck)/iu,
  ],
  [
    "IMAGE",
    /(зураг|постер|баннер|лого|ковер|нүүр зураг|дизайн|илюстрац|иллюстрац|карт\b|зурагтай|thumbnail|обложк)/iu,
  ],
  [
    "TEXT",
    /(текст|бичвэр|нийтлэл|захидал|и-?мэйл|имэйл|мэдэгдэл|тайлан|зарлал|скрипт|script|хуулбар|copy\b|тайлбар бич)/iu,
  ],
];

/**
 * Хүсэлтээс хэлбэрийг таана. Хэд хэдэн дохио байвал ВИДЕО > ДУУ > СЛАЙД > ЗУРАГ >
 * БИЧВЭР эрэмбээр — видео нь бусдыг нь (зураг, дуу, бичвэр) агуулдаг тул давуу.
 * Юу ч таарахгүй бол null — хэрэглэгчээс асууна.
 */
export function detectFormat(request: string, hints = FORMAT_HINTS): StudioFormat | null {
  for (const [format, re] of hints) if (re.test(request)) return format;
  return null;
}

// ---------- Байршуулах газар ----------

export interface Placement {
  id: string;
  label: string;
  /** Харьцаа — промптод шууд орно */
  aspect: string;
  formats: StudioFormat[];
  /** Видеоны зөвлөмжит урт, секундээр */
  seconds?: number;
}

export const PLACEMENTS: Placement[] = [
  { id: "fb-post", label: "Facebook пост", aspect: "4:5", formats: ["IMAGE"] },
  { id: "fb-cover", label: "Facebook ковер", aspect: "16:9", formats: ["IMAGE"] },
  { id: "ig-post", label: "Instagram пост", aspect: "1:1", formats: ["IMAGE"] },
  { id: "ig-story", label: "Instagram story", aspect: "9:16", formats: ["IMAGE", "VIDEO"], seconds: 15 },
  { id: "reels", label: "Reels / TikTok", aspect: "9:16", formats: ["VIDEO"], seconds: 30 },
  { id: "youtube", label: "YouTube", aspect: "16:9", formats: ["VIDEO"], seconds: 60 },
  { id: "print", label: "Хэвлэл (постер, А4)", aspect: "3:4", formats: ["IMAGE"] },
  { id: "slides", label: "Слайд", aspect: "16:9", formats: ["IMAGE", "SLIDES"] },
  { id: "web", label: "Вэб сайт", aspect: "16:9", formats: ["IMAGE"] },
];

export function placementById(id: string | null | undefined, list = PLACEMENTS): Placement | null {
  if (!id) return null;
  return list.find((p) => p.id === id) ?? null;
}

export function placementsFor(format: StudioFormat, list = PLACEMENTS): Placement[] {
  return list.filter((p) => p.formats.includes(format));
}

/** Байршил мэдэгдэхгүй үед хэлбэрээс таамаглах харьцаа */
export const DEFAULT_ASPECT: Record<StudioFormat, string> = {
  IMAGE: "4:5",
  VIDEO: "9:16",
  TEXT: "",
  AUDIO: "",
  SLIDES: "16:9",
};

export function aspectFor(format: StudioFormat, placementId?: string | null): string {
  return placementById(placementId)?.aspect ?? DEFAULT_ASPECT[format];
}

// ---------- Хязгаар ба төсөв ----------

/** Нэвтрээгүй хэрэглэгч — өдөрт */
export const ANON_DAILY = 2;
/** Нэвтэрсэн хэрэглэгч — өдөрт */
export const USER_DAILY = 10;

export function dailyLimit(loggedIn: boolean): number {
  return loggedIn ? USER_DAILY : ANON_DAILY;
}

export function limitLeft(used: number, loggedIn: boolean): number {
  return Math.max(0, dailyLimit(loggedIn) - used);
}

/** IP ба anonId хоёуланг тоолно — cookie цэвэрлэснээр хязгаар тойрохгүй */
export function subjectsOf(a: { userId?: string | null; anonId: string; ip: string }): string[] {
  const list = [`a:${a.anonId}`, `ip:${a.ip}`];
  return a.userId ? [`u:${a.userId}`, ...list] : list;
}

/** Хэд хэдэн subject-ийн хамгийн ИХ тоог авна — аль нэгээр нь хязгаарт хүрвэл зогсоно */
export function usedOf(counts: number[]): number {
  return counts.length ? Math.max(...counts) : 0;
}

/** Өдрийн төсөв (ам.доллар). Хэтэрвэл студи унтарна. */
export const DEFAULT_DAILY_USD = 0.5;

export function dailyBudget(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.STUDIO_DAILY_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_USD;
}

export function withinBudget(spentUsd: number, budget: number): boolean {
  return spentUsd < budget;
}

/**
 * OpenRouter-ийн үлдэгдэл бага үед студи ХАМГИЙН ТҮРҮҮНД унтарна — мэдээний
 * pipeline давуу эрхтэй. Энэ хязгаараас доош орвол шинэ бүтээл эхлүүлэхгүй.
 */
export const MIN_BALANCE_USD = 1;

export type OffReason = "flag" | "budget" | "balance" | null;

/** Студи ажиллах уу. Ажиллахгүй бол шалтгааны код. */
export function studioOff(a: {
  env?: NodeJS.ProcessEnv;
  spentUsd: number;
  balanceUsd?: number | null;
}): OffReason {
  const env = a.env ?? process.env;
  if (env.STUDIO_OFF === "true") return "flag";
  if (a.balanceUsd !== null && a.balanceUsd !== undefined && a.balanceUsd < MIN_BALANCE_USD) return "balance";
  if (!withinBudget(a.spentUsd, dailyBudget(env))) return "budget";
  return null;
}

export const OFF_MESSAGE: Record<Exclude<OffReason, null>, string> = {
  flag: "Промпт студи түр хаалттай байна.",
  budget: "Өнөөдрийн студийн хязгаар дүүрсэн байна. Маргааш дахин оролдоорой.",
  balance: "Түр зуурын техникийн хязгаарлалт. Хэсэг хугацааны дараа оролдоорой.",
};
