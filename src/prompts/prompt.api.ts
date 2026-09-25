/**
 * Prompt-ын цэвэр логик (DB, LLM, React-гүй тул тесттэй).
 *
 * Хувьсагчийн гэрээ: prompt-ын текст дотор `{компанийн нэр}` гэж бичвэл
 * хэрэглэгчид бөглөх нүх болж харагдана.
 */
import type { PromptCategory, PromptLanguage } from "../generated/prisma/enums";

export const PROMPT_CATEGORIES: PromptCategory[] = [
  "AJIL", "SURGALT", "BIZNES", "BICHIH", "CODE", "ZURAG", "ORCHUULGA", "AMIDRAL", "BUSAD",
];

export const PROMPT_CATEGORY_LABEL: Record<PromptCategory, string> = {
  AJIL: "Ажил",
  SURGALT: "Сургалт",
  BIZNES: "Бизнес",
  BICHIH: "Бичих",
  CODE: "Код",
  ZURAG: "Зураг",
  ORCHUULGA: "Орчуулга",
  AMIDRAL: "Амьдрал",
  BUSAD: "Бусад",
};

export const PROMPT_CATEGORY_HINT: Record<PromptCategory, string> = {
  AJIL: "албан ажил, хурал, тайлан, төлөвлөгөө",
  SURGALT: "хичээл, сурах, багшлах, даалгавар",
  BIZNES: "маркетинг, борлуулалт, үйлчлүүлэгч, санхүү",
  BICHIH: "нийтлэл, пост, захидал, зар",
  CODE: "программчлал, алдаа засах, Excel томьёо",
  ZURAG: "зураг, дизайн, видеоны дүрслэл",
  ORCHUULGA: "орчуулга, хэл засварлах",
  AMIDRAL: "өдөр тутам, эрүүл мэнд, аялал, гэр бүл",
  BUSAD: "бусад",
};

export const PROMPT_LANGUAGES: PromptLanguage[] = ["MN", "EN", "MIXED"];

export const PROMPT_LANGUAGE_LABEL: Record<PromptLanguage, string> = {
  MN: "Монгол",
  EN: "Англи",
  MIXED: "Холимог",
};

/** Жагсаалтын эрэмбэ */
export const SORTS = ["shine", "huulsan", "taalagdsan"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABEL: Record<Sort, string> = {
  shine: "Шинэ",
  huulsan: "Их хуулагдсан",
  taalagdsan: "Их таалагдсан",
};

export function toSort(raw: string | undefined): Sort {
  return (SORTS as readonly string[]).includes(raw ?? "") ? (raw as Sort) : "shine";
}

// ——— Хувьсагч ———

/** `{нэр}` — дотроо } болон мөр таслалт агуулахгүй, хоосон биш */
const VARIABLE = /\{([^{}\n]{1,60}?)\}/g;

/** Текстээс хувьсагчийн нэрсийг бичигдсэн дарааллаар, давхардалгүй */
export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(VARIABLE)) {
    const name = m[1]!.trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * Хувьсагчуудыг утгаар нь солино. Бөглөөгүй нүхийг `{нэр}` хэвээр үлдээнэ —
 * хэрэглэгч хуулаад гараар нөхөж болно.
 */
export function fillVariables(body: string, values: Record<string, string>): string {
  return body.replace(VARIABLE, (whole, rawName: string) => {
    const value = values[rawName.trim()]?.trim();
    return value ? value : whole;
  });
}

/** Бүх хувьсагч бөглөгдсөн эсэх */
export function allFilled(body: string, values: Record<string, string>): boolean {
  return extractVariables(body).every((name) => (values[name] ?? "").trim().length > 0);
}

/** Текстийг хувьсагч ба энгийн хэсгүүдэд хуваана — тодруулж харуулахад */
export interface Segment {
  text: string;
  variable: boolean;
}

export function splitVariables(body: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of body.matchAll(VARIABLE)) {
    const start = m.index!;
    if (start > last) out.push({ text: body.slice(last, start), variable: false });
    out.push({ text: m[1]!.trim(), variable: true });
    last = start + m[0]!.length;
  }
  if (last < body.length) out.push({ text: body.slice(last), variable: false });
  return out;
}

/**
 * Нүүрний «Өнөөдрийн prompt» — жагсаалтаас өдрийн дугаараар нэгийг сонгоно.
 * Цэвэр функц: ижил өдөр ижил prompt, маргааш дараагийнх.
 */
export function pickOfDay<T>(items: T[], day: Date = new Date()): T | null {
  if (items.length === 0) return null;
  const dayNumber = Math.floor(day.getTime() / 86_400_000);
  return items[dayNumber % items.length]!;
}

// ——— Гадаад хэрэгсэл рүү нээх ———

/** ChatGPT-д бэлэн текстээр нээх */
export function chatGptUrl(text: string): string {
  return `https://chat.openai.com/?q=${encodeURIComponent(text)}`;
}

/** Gemini — ?q= дэмждэггүй байж болзошгүй тул UI дээр «ажиллахгүй бол хуулна» гэж сануулна */
export function geminiUrl(text: string): string {
  return `https://gemini.google.com/app?q=${encodeURIComponent(text)}`;
}

// ——— Хэрэглэгчийн илгээх prompt-ын шалгуур ———

export const MIN_BODY = 40;
export const MAX_BODY = 4_000;
export const MAX_TITLE = 80;
export const MAX_DESCRIPTION = 200;
/** Хэрэглэгч бүр өдөрт хэдэн prompt илгээж болох вэ */
export const DAILY_SUBMIT_LIMIT = 5;

export interface SubmitProblem {
  code: "title-short" | "title-long" | "body-short" | "body-long" | "description-long" | "bad-category";
  detail: string;
}

export function checkSubmission(input: {
  title: string;
  body: string;
  description: string;
  category: string;
}): SubmitProblem[] {
  const p: SubmitProblem[] = [];
  const title = input.title.trim();
  if (title.length < 5) p.push({ code: "title-short", detail: "Гарчиг хэт богино байна." });
  else if (title.length > MAX_TITLE) p.push({ code: "title-long", detail: `Гарчиг ${MAX_TITLE} тэмдэгтээс урт байна.` });

  const body = input.body.trim();
  if (body.length < MIN_BODY) {
    p.push({ code: "body-short", detail: `Prompt ${MIN_BODY} тэмдэгтээс урт байх ёстой.` });
  } else if (body.length > MAX_BODY) {
    p.push({ code: "body-long", detail: `Prompt ${MAX_BODY} тэмдэгтээс урт байна.` });
  }

  if (input.description.trim().length > MAX_DESCRIPTION) {
    p.push({ code: "description-long", detail: `Тайлбар ${MAX_DESCRIPTION} тэмдэгтээс урт байна.` });
  }
  if (!(PROMPT_CATEGORIES as string[]).includes(input.category)) {
    p.push({ code: "bad-category", detail: "Ангилал сонгоогүй байна." });
  }
  return p;
}

/** Өнөөдөр хэдэн prompt үлдсэн бэ */
export function remainingToday(usedToday: number, max = DAILY_SUBMIT_LIMIT): number {
  return Math.max(0, max - usedToday);
}
