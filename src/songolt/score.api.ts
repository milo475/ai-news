/**
 * «Надад ямар AI тохирох вэ?» асуулгын цэвэр логик (DB, LLM, React-гүй тул тесттэй).
 *
 * Дүгнэлт нь **дүрмээр** гардаг — LLM биш. Шалтгаан: хурдан (хүлээлтгүй), тогтвортой
 * (ижил хариултад ижил үр дүн), үнэгүй.
 */
import type { MongolianSupport, ToolCategory, ToolPlan } from "../generated/prisma/enums";

// ——— Асуултууд ———

export const TASKS = ["bichih", "orchuulga", "surah", "code", "zurag", "biznes", "yarilzah"] as const;
export type Task = (typeof TASKS)[number];

export const TASK_LABEL: Record<Task, string> = {
  bichih: "Бичих",
  orchuulga: "Орчуулах",
  surah: "Сурах",
  code: "Код бичих",
  zurag: "Зураг, видео",
  biznes: "Бизнес, маркетинг",
  yarilzah: "Ярилцах, асуух",
};

/** Нэг даалгаварт аль каталогийн ангиллууд тохирох вэ */
export const TASK_CATEGORIES: Record<Task, ToolCategory[]> = {
  bichih: ["BICHIH"],
  orchuulga: ["ORCHUULGA"],
  surah: ["SURGALT"],
  code: ["CODE"],
  zurag: ["ZURAG", "VIDEO"],
  biznes: ["BIZNES", "MARKETING"],
  yarilzah: ["CHAT"],
};

/** Хэдэн даалгавар сонгож болох вэ */
export const MAX_TASKS = 3;

export const WHOS = ["oyutan", "ajiltan", "biznes", "bagsh", "etseg", "hogjuulegch"] as const;
export type Who = (typeof WHOS)[number];

export const WHO_LABEL: Record<Who, string> = {
  oyutan: "Оюутан",
  ajiltan: "Оффисын ажилтан",
  biznes: "Бизнес эрхлэгч",
  bagsh: "Багш",
  etseg: "Эцэг эх",
  hogjuulegch: "Хөгжүүлэгч",
};

export const BUDGETS = ["unegui", "arvan", "hamaagui"] as const;
export type Budget = (typeof BUDGETS)[number];

export const BUDGET_LABEL: Record<Budget, string> = {
  unegui: "Үнэгүй л",
  arvan: "Сард $10 хүртэл",
  hamaagui: "Хамаагүй",
};

export const MONGOLIAN = ["ih", "tal", "baga"] as const;
export type MongolianUse = (typeof MONGOLIAN)[number];

export const MONGOLIAN_LABEL: Record<MongolianUse, string> = {
  ih: "Бараг бүгд монголоор",
  tal: "Тал хувь нь",
  baga: "Бага",
};

export const DEVICES = ["utas", "comp", "hoyul"] as const;
export type Device = (typeof DEVICES)[number];

export const DEVICE_LABEL: Record<Device, string> = {
  utas: "Утас",
  comp: "Компьютер",
  hoyul: "Хоёулаа",
};

/** Төхөөрөмж тус бүрд тохирох платформууд */
export const DEVICE_PLATFORMS: Record<Device, string[]> = {
  utas: ["ios", "android"],
  comp: ["web", "desktop"],
  hoyul: ["web", "ios", "android", "desktop"],
};

export interface Answers {
  tasks: Task[];
  who: Who;
  budget: Budget;
  mongolian: MongolianUse;
  device: Device;
}

export const STEPS = 5;

// ——— Кодчилол ———

/**
 * Хариултыг богино кодоор URL-д. Ижил код → ижил үр дүн (хуваалцахад чухал).
 *
 * 16 бит өгөгдөл + 4 бит хувилбар + 8 бит шалгах нийлбэр = 28 бит → base64url 5 тэмдэгт.
 * Шалгах нийлбэр нь гараар зохиосон кодыг барина (хуурамч үр дүн гаргахаас сэргийлнэ).
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const CODE_LENGTH = 5;
export const CODE_VERSION = 1;

function taskBits(tasks: Task[]): number {
  let bits = 0;
  for (const t of tasks) {
    const i = TASKS.indexOf(t);
    if (i >= 0) bits |= 1 << i;
  }
  return bits;
}

function bitsToTasks(bits: number): Task[] {
  return TASKS.filter((_, i) => (bits & (1 << i)) !== 0).slice(0, MAX_TASKS);
}

/** Энгийн шалгах нийлбэр — криптограф биш, зөвхөн санамсаргүй кодыг барина */
function checksum(payload: number): number {
  let x = payload ^ (payload >>> 8) ^ (payload >>> 16);
  x = (x * 131 + CODE_VERSION) & 0xff;
  return x;
}

export function encodeAnswers(a: Answers): string {
  const payload =
    (taskBits(a.tasks) & 0x7f) |
    ((Math.max(0, WHOS.indexOf(a.who)) & 0x7) << 7) |
    ((Math.max(0, BUDGETS.indexOf(a.budget)) & 0x3) << 10) |
    ((Math.max(0, MONGOLIAN.indexOf(a.mongolian)) & 0x3) << 12) |
    ((Math.max(0, DEVICES.indexOf(a.device)) & 0x3) << 14);

  // 28 бит: [checksum 8][version 4][payload 16]
  const value = (checksum(payload) * 2 ** 20) + (CODE_VERSION << 16) + payload;

  let out = "";
  for (let i = CODE_LENGTH - 1; i >= 0; i--) {
    out += ALPHABET[Math.floor(value / 64 ** i) % 64];
  }
  return out;
}

export function decodeAnswers(code: string): Answers | null {
  const raw = code.trim();
  if (raw.length !== CODE_LENGTH) return null;

  let value = 0;
  for (const ch of raw) {
    const i = ALPHABET.indexOf(ch);
    if (i === -1) return null;
    value = value * 64 + i;
  }

  const payload = value % 2 ** 16;
  const version = Math.floor(value / 2 ** 16) % 16;
  const sum = Math.floor(value / 2 ** 20) % 256;
  if (version !== CODE_VERSION || sum !== checksum(payload)) return null;

  const tasks = bitsToTasks(payload & 0x7f);
  if (tasks.length === 0) return null;

  const who = WHOS[(payload >> 7) & 0x7];
  const budget = BUDGETS[(payload >> 10) & 0x3];
  const mongolian = MONGOLIAN[(payload >> 12) & 0x3];
  const device = DEVICES[(payload >> 14) & 0x3];
  if (!who || !budget || !mongolian || !device) return null;

  return { tasks, who, budget, mongolian, device };
}

// ——— Оноо ———

export interface ScorableTool {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categories: ToolCategory[];
  pricing: ToolPlan;
  priceFrom: number | null;
  mongolianSupport: MongolianSupport;
  platforms: string[];
  upvotes: number;
  clicks: number;
  /** А.3-ын бенчмаркийн монгол хэлний оноо, 0–10. Байхгүй бол null. */
  mnScore: number | null;
}

export interface ScoreBreakdown {
  category: number;
  mongolian: number;
  budget: number;
  platform: number;
  benchmark: number;
  popular: number;
  total: number;
}

/** Оноо өгөх жингүүд — нэг газар барина */
export const WEIGHTS = {
  category: 3,
  mongolianGood: 2,
  mongolianPartial: 1,
  budget: 2,
  platform: 1,
  /** Бенчмаркийн оноог 0–10-аас 0–2 болгоно */
  benchmark: 2,
  popular: 1,
} as const;

/** «Алдартай» гэж тооцох босго — upvote + товшилт */
export const POPULAR_THRESHOLD = 5;

/**
 * Хэрэглэгчийн төсөвт тохирох эсэх.
 *
 * «Үнэгүй л» → зөвхөн FREE/FREEMIUM. «$10 хүртэл» → үнэгүй, эсвэл тариф ≤$10.
 * «Хамаагүй» → бүгд тохирно (тиймээс энэ оноо бүх хэрэгсэлд нэмэгдэж эрэмбэд нөлөөлөхгүй).
 */
export function budgetFits(tool: ScorableTool, budget: Budget): boolean {
  if (budget === "hamaagui") return true;
  const free = tool.pricing === "FREE" || tool.pricing === "FREEMIUM";
  if (budget === "unegui") return free;
  return free || (tool.priceFrom !== null && tool.priceFrom <= 10);
}

export function scoreTool(tool: ScorableTool, a: Answers): ScoreBreakdown {
  // Ангилал — сонгосон даалгавар бүрт тохирвол нэмэгдэнэ
  const wanted = new Set(a.tasks.flatMap((t) => TASK_CATEGORIES[t]));
  const matched = tool.categories.filter((c) => wanted.has(c)).length;
  const category = matched > 0 ? WEIGHTS.category * Math.min(matched, a.tasks.length) : 0;

  // Монгол хэл — их хэрэглэнэ гэвэл жин хоёр дахин
  const base =
    tool.mongolianSupport === "GOOD" ? WEIGHTS.mongolianGood
    : tool.mongolianSupport === "PARTIAL" ? WEIGHTS.mongolianPartial
    : 0;
  const mongolian = a.mongolian === "ih" ? base * 2 : base;

  const budget = budgetFits(tool, a.budget) ? WEIGHTS.budget : 0;

  const platforms = DEVICE_PLATFORMS[a.device];
  const platform = tool.platforms.some((p) => platforms.includes(p)) ? WEIGHTS.platform : 0;

  // Бенчмаркийн MN оноо байвал л нэмэгдэнэ — байхгүйг 0 гэж үзэх нь шийтгэл биш
  const benchmark = tool.mnScore === null ? 0 : (tool.mnScore / 10) * WEIGHTS.benchmark;

  const popular = tool.upvotes + tool.clicks >= POPULAR_THRESHOLD ? WEIGHTS.popular : 0;

  const total = category + mongolian + budget + platform + benchmark + popular;
  return {
    category, mongolian, budget, platform,
    benchmark: Math.round(benchmark * 100) / 100,
    popular,
    total: Math.round(total * 100) / 100,
  };
}

export interface Recommendation {
  tool: ScorableTool;
  score: ScoreBreakdown;
  /** Яагаад тохирох вэ — template-ээр (LLM биш) */
  reason: string;
}

/**
 * Санал болгох хэрэгслүүд.
 *
 * Ангилал огт таараагүй хэрэгслийг **огт оруулахгүй** — «алдартай» гэдгээр л дээр гарч
 * ирвэл хариулт утгагүй болно. Тэнцвэл нэрээр эрэмбэлж тогтвортой байлгана.
 */
export function recommend(tools: ScorableTool[], a: Answers, limit = 3): Recommendation[] {
  const scored = tools
    .map((tool) => ({ tool, score: scoreTool(tool, a) }))
    .filter((r) => r.score.category > 0);

  // Ангилал таарсан нэг ч хэрэгсэл байхгүй бол шүүлтгүй эрэмбээр гүйцээнэ
  const pool = scored.length > 0
    ? scored
    : tools.map((tool) => ({ tool, score: scoreTool(tool, a) }));

  return pool
    .sort((x, y) => y.score.total - x.score.total || x.tool.name.localeCompare(y.tool.name))
    .slice(0, limit)
    .map((r) => ({ ...r, reason: reasonFor(r.tool, a, r.score) }));
}

/** Яагаад тохирохыг 2 өгүүлбэрээр — бүх хэсэг нь баталгаатай өгөгдлөөс */
export function reasonFor(tool: ScorableTool, a: Answers, score: ScoreBreakdown): string {
  const tasks = a.tasks.map((t) => TASK_LABEL[t].toLowerCase()).join(", ");
  const first = `${WHO_LABEL[a.who]} хүнд ${tasks} зориулалтаар ${tool.name} тохирно.`;

  // Дараалал нь мэдээллийн үнэ цэнээр: монгол хэл → хэмжсэн оноо → үнэ → төхөөрөмж.
  // Зөвхөн эхний 3 нь харагдана (хоёр өгүүлбэрт багтаахын тулд).
  const points: string[] = [];
  if (score.mongolian > 0) {
    points.push(
      tool.mongolianSupport === "GOOD" ? "монгол хэл дээр сайн ажилладаг" : "монголоор дунд зэрэг ажилладаг",
    );
  }
  if (tool.mnScore !== null) points.push(`монгол хэлний бенчмаркт ${tool.mnScore.toFixed(1)}/10`);
  if (tool.pricing === "FREE") points.push("бүрэн үнэгүй");
  else if (tool.pricing === "FREEMIUM") points.push("үнэгүй хувилбартай");
  else if (tool.priceFrom !== null) points.push(`сард $${tool.priceFrom}-аас`);
  if (score.platform > 0) points.push(`${DEVICE_LABEL[a.device].toLowerCase()} дээр ажиллана`);

  const second = points.length > 0
    ? `Учир нь ${points.slice(0, 3).join(", ")}.`
    : `${tool.tagline}.`;
  return `${first} ${second}`;
}

// ——— Хэрэгсэл ↔ моделийн холбоос ———

/**
 * Каталогийн хэрэгслийг бенчмаркийн моделийн нийлүүлэгчтэй холбоно.
 *
 * Бенчмарк нь моделиудыг (`openai/gpt-5.1`) хэмждэг, каталог нь бүтээгдэхүүнийг
 * (ChatGPT). Тиймээс нийлүүлэгчээр холбож, тухайн компанийн **хамгийн өндөр** MN
 * оноог авна. Бүх хэрэгсэлд биш — зөвхөн модель нь тодорхой мэдэгдэх хэрэгслүүдэд.
 */
export const TOOL_VENDOR: Record<string, string> = {
  chatgpt: "openai",
  claude: "anthropic",
  gemini: "google",
  "microsoft-copilot": "openai",
  deepseek: "deepseek",
  "qwen-chat": "qwen",
  perplexity: "perplexity",
  "claude-code": "anthropic",
};

export function vendorForTool(slug: string): string | null {
  return TOOL_VENDOR[slug] ?? null;
}
