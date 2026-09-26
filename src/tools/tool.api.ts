/**
 * Хэрэгслийн каталогийн цэвэр логик (DB, LLM, React-гүй тул тесттэй).
 */
import type { MongolianSupport, ToolCategory, ToolPlan } from "../generated/prisma/enums";

export const TOOL_CATEGORIES: ToolCategory[] = [
  "CHAT", "BICHIH", "ZURAG", "VIDEO", "AUDIO", "CODE", "OFFICE", "SURGALT",
  "MARKETING", "BIZNES", "ORCHUULGA", "HAILT", "AGENT", "BUSAD",
];

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  CHAT: "Чат",
  BICHIH: "Бичих",
  ZURAG: "Зураг",
  VIDEO: "Видео",
  AUDIO: "Дуу",
  CODE: "Код",
  OFFICE: "Хүснэгт, документ",
  SURGALT: "Сургалт",
  MARKETING: "Маркетинг",
  BIZNES: "Бизнес",
  ORCHUULGA: "Орчуулга",
  HAILT: "Хайлт",
  AGENT: "Агент",
  BUSAD: "Бусад",
};

export const TOOL_CATEGORY_HINT: Record<ToolCategory, string> = {
  CHAT: "ерөнхий чатбот, асуулт хариулт",
  BICHIH: "текст бичих, засварлах, найруулах",
  ZURAG: "зураг үүсгэх, дизайн, засвар",
  VIDEO: "видео үүсгэх, монтаж, субтитр",
  AUDIO: "дуу хоолой, хөгжим, транскрипц",
  CODE: "программчлал, кодын туслах",
  OFFICE: "Excel, Google Sheets, Docs, илтгэл",
  SURGALT: "сурах, багшлах, хичээл",
  MARKETING: "сошиал, зар, контент",
  BIZNES: "борлуулалт, CRM, санхүү",
  ORCHUULGA: "орчуулга, хэл",
  HAILT: "мэдээлэл хайх, судлах",
  AGENT: "ажлыг бүхэлд нь даалгах",
  BUSAD: "бусад",
};

export const TOOL_PLANS: ToolPlan[] = ["FREE", "FREEMIUM", "TRIAL", "PAID"];

export const TOOL_PLAN_LABEL: Record<ToolPlan, string> = {
  FREE: "Үнэгүй",
  FREEMIUM: "Үнэгүй + төлбөртэй",
  TRIAL: "Туршилтын хугацаа",
  PAID: "Төлбөртэй",
};

export const MN_SUPPORT: MongolianSupport[] = ["GOOD", "PARTIAL", "NONE"];

export const MN_SUPPORT_LABEL: Record<MongolianSupport, string> = {
  GOOD: "Монголоор сайн",
  PARTIAL: "Монголоор дунд",
  NONE: "Монголоор ажиллахгүй",
};

/** Картын жижиг тэмдэг */
export const MN_SUPPORT_BADGE: Record<MongolianSupport, string> = {
  GOOD: "MN ✓",
  PARTIAL: "MN ~",
  NONE: "MN ✗",
};

export const PLATFORMS = ["web", "ios", "android", "desktop", "api"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  web: "Вэб",
  ios: "iPhone",
  android: "Android",
  desktop: "Компьютер",
  api: "API",
};

/** Жагсаалтын эрэмбэ */
export const TOOL_SORTS = ["aldartai", "shine", "unelgee"] as const;
export type ToolSort = (typeof TOOL_SORTS)[number];

export const TOOL_SORT_LABEL: Record<ToolSort, string> = {
  aldartai: "Алдартай",
  shine: "Шинэ",
  unelgee: "Үнэлгээ",
};

export function toToolSort(raw: string | undefined): ToolSort {
  return (TOOL_SORTS as readonly string[]).includes(raw ?? "") ? (raw as ToolSort) : "aldartai";
}

/**
 * «Алдартай» оноо — upvote нь хэрэглэгчийн санаатай үйлдэл тул товшилтоос хүндтэй.
 * Товшилт нь сонирхлыг харуулна ч санамсаргүй ч байж болно.
 */
export const UPVOTE_WEIGHT = 3;

export function popularity(upvotes: number, clicks: number): number {
  return upvotes * UPVOTE_WEIGHT + clicks;
}

// ——— Хязгаарлалт ———

export const MAX_TAGLINE = 80;
/** Хэрэглэгч өдөрт хэдэн хэрэгсэл санал болгож болох вэ */
export const DAILY_TOOL_LIMIT = 3;
export const MAX_REVIEW_TEXT = 500;
export const MIN_STARS = 1;
export const MAX_STARS = 5;

export interface SubmitProblem {
  code: "name-short" | "name-long" | "bad-url" | "no-category" | "url-not-http";
  detail: string;
}

/** Хэрэглэгчийн санал болгосон хэрэгслийг шалгана */
export function checkToolSubmission(input: { name: string; website: string; categories: string[] }): SubmitProblem[] {
  const p: SubmitProblem[] = [];
  const name = input.name.trim();
  if (name.length < 2) p.push({ code: "name-short", detail: "Нэр хэт богино байна." });
  else if (name.length > 60) p.push({ code: "name-long", detail: "Нэр 60 тэмдэгтээс урт байна." });

  const url = normalizeWebsite(input.website);
  if (!url) p.push({ code: "bad-url", detail: "Вэбсайтын хаяг танигдсангүй." });
  else if (!/^https?:\/\//.test(url)) p.push({ code: "url-not-http", detail: "Хаяг http эсвэл https байх ёстой." });

  if (cleanCategories(input.categories).length === 0) {
    p.push({ code: "no-category", detail: "Ангилал сонгоно уу." });
  }
  return p;
}

/** "chatgpt.com" → "https://chatgpt.com". Танигдахгүй бол null. */
export function normalizeWebsite(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    // Хайлтын query, fragment нь каталогт хэрэггүй
    return `${u.protocol}//${u.hostname}${u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function cleanCategories(raw: string[]): ToolCategory[] {
  const seen = new Set<string>();
  for (const value of raw) {
    const key = value.trim().toUpperCase();
    if ((TOOL_CATEGORIES as string[]).includes(key)) seen.add(key);
  }
  return [...seen] as ToolCategory[];
}

export function cleanPlatforms(raw: string[]): Platform[] {
  const seen = new Set<string>();
  for (const value of raw) {
    const key = value.trim().toLowerCase();
    if ((PLATFORMS as readonly string[]).includes(key)) seen.add(key);
  }
  return [...seen] as Platform[];
}

// ——— Шүүмж ———

export interface ReviewProblem {
  code: "bad-stars" | "text-long";
  detail: string;
}

export function checkReview(stars: number, text: string): ReviewProblem[] {
  const p: ReviewProblem[] = [];
  if (!Number.isInteger(stars) || stars < MIN_STARS || stars > MAX_STARS) {
    p.push({ code: "bad-stars", detail: `Од ${MIN_STARS}–${MAX_STARS} хооронд байна.` });
  }
  if (text.trim().length > MAX_REVIEW_TEXT) {
    p.push({ code: "text-long", detail: `Шүүмж ${MAX_REVIEW_TEXT} тэмдэгтээс урт байна.` });
  }
  return p;
}

/** Нийтлэгдсэн шүүмжүүдээс дундаж — нэг аравтын нарийвчлалтай */
export function averageStars(stars: number[]): number {
  if (stars.length === 0) return 0;
  return Math.round((stars.reduce((n, s) => n + s, 0) / stars.length) * 10) / 10;
}

// ——— Харьцуулалтын slug ———

/** "chatgpt-vs-claude" → ["chatgpt", "claude"]. Харьцуулалт биш бол null. */
export function parseVersusSlug(slug: string): [string, string] | null {
  const m = /^(.+?)-vs-(.+)$/.exec(slug.trim().toLowerCase());
  if (!m) return null;
  const [, a, b] = m;
  if (!a || !b || a === b) return null;
  return [a, b];
}

export function versusSlug(a: string, b: string): string {
  return `${a}-vs-${b}`;
}

// ——— Лого ———

/** Google-ийн favicon сервис — сайтын өөрийн icon олдохгүй үед */
export function faviconFallbackUrl(website: string, size = 64): string {
  const domain = domainOf(website);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/** Үсгэн avatar — лого огт олдохгүй бол. Тогтвортой өнгө нэрээс гарна. */
export function letterAvatar(name: string): { letter: string; hue: number } {
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) % 360;
  return { letter, hue: hash };
}

/** Зөвшөөрөгдөх логоны төрөл — SVG нь скрипт агуулж болох тул зөвхөн растер + цэвэр SVG */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/svg+xml"] as const;

export function isLogoType(contentType: string | null | undefined): boolean {
  const t = (contentType ?? "").split(";")[0]!.trim().toLowerCase();
  return (LOGO_TYPES as readonly string[]).includes(t);
}

/**
 * /hereglee-ийн ангиллыг каталогийн ангилалтай холбоно.
 *
 * Хоёр нь өөр зорилготой: /hereglee нь «юунд ашиглах вэ» гэсэн редакцийн жагсаалт,
 * /hereglel нь бүрэн каталог. Хэрэглээний хуудсанд тухайн ангиллын топ хэрэгслийг холбоно.
 */
export const USECASE_TO_CATEGORY: Record<string, ToolCategory> = {
  yarilzah: "CHAT",
  code: "CODE",
  haih: "HAILT",
  bichih: "BICHIH",
  orchuulga: "ORCHUULGA",
  zurag: "ZURAG",
  video: "VIDEO",
  "duu-hooloi": "AUDIO",
  hugjim: "AUDIO",
  presentation: "OFFICE",
  surah: "SURGALT",
  agent: "AGENT",
  local: "BUSAD",
};

export function categoryForUseCase(slug: string): ToolCategory | null {
  return USECASE_TO_CATEGORY[slug] ?? null;
}
