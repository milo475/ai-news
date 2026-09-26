/**
 * Facebook постын цэвэр хэсэг — DB, сүлжээгүй тул тесттэй.
 *
 * Постын бүтэц:
 *
 *   Гарчиг
 *
 *   2–3 өгүүлбэр lead
 *
 *   👉 https://сайт/medee/slug
 *
 *   #AI #ХиймэлОюун #OpenAI
 *
 * Зураг тусад нь upload хийхгүй — холбоосын preview-ээр og:image-ийг Facebook өөрөө авна.
 */

import { siteUrl } from "../lib/site";

/** Нэг ажиллуулалтад постлох анхдагч тоо */
export const DEFAULT_POSTS_PER_RUN = 1;

/** Ийм удаа алдаа өгсөн нийтлэлийг дараалалаас гаргана */
export const MAX_ATTEMPTS = 3;

/** Lead-д авах дээд өгүүлбэр ба тэмдэгтийн тоо */
const MAX_LEAD_SENTENCES = 3;
const MAX_LEAD_CHARS = 400;

/** Үргэлж явах hashtag-ууд */
export const BASE_HASHTAGS = ["#AI", "#ХиймэлОюун"];

/** FB_POSTS_PER_RUN — 0 бол алхам алгасагдана */
export function postsPerRun(env: Record<string, string | undefined> = process.env): number {
  const raw = env.FB_POSTS_PER_RUN?.trim();
  if (!raw) return DEFAULT_POSTS_PER_RUN;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_POSTS_PER_RUN;
}

/** Markdown-ий тэмдэглэгээг постод хэрэггүй тул цэвэрлэнэ */
function stripMarkdown(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")   // [текст](хаяг)
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Цэгээр тасалж өгүүлбэр болгоно */
export function sentences(text: string): string[] {
  return stripMarkdown(text)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Үг тус бүрээр харьцуулсан ижил төстэй байдал (Jaccard), 0–1 */
function similarity(a: string, b: string): number {
  const words = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
  const [x, y] = [words(a), words(b)];
  if (x.size === 0 || y.size === 0) return 0;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / (x.size + y.size - shared);
}

/** Үүнээс илүү давхцсан өгүүлбэрийг lead-д давтахгүй (үгийн талаас илүү нь ижил) */
const MAX_SIMILARITY = 0.45;

/**
 * 2–3 өгүүлбэрийн lead. Хураангуй нь нэг өгүүлбэр бол үндсэн текстийн эхнээс нөхнө.
 * Агент ихэвчлэн хураангуйн санааг биетийн эхний өгүүлбэрт давтдаг тул ойролцоо
 * өгүүлбэрийг алгасна.
 */
export function leadOf(summaryMn: string | null, bodyMn: string | null): string {
  const picked: string[] = [];
  let chars = 0;

  for (const s of [...sentences(summaryMn ?? ""), ...sentences(bodyMn ?? "")]) {
    if (picked.length >= MAX_LEAD_SENTENCES) break;
    if (picked.some((p) => similarity(p, s) > MAX_SIMILARITY)) continue;
    if (picked.length >= 2 && chars + s.length > MAX_LEAD_CHARS) break;
    picked.push(s);
    chars += s.length + 1;
  }
  return picked.join(" ");
}

/** "GPT-6 Astra" → "#GPT6Astra". Үсэггүй эсвэл хоосон бол null */
export function hashtagOf(name: string): string | null {
  const word = name.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
  if (!word || !/\p{L}/u.test(word)) return null;
  return `#${word}`;
}

/** #AI #ХиймэлОюун + модель/компанийн нэрнээс нэг — нийт 2–3 */
export function hashtagsFor(modelNames: string[], companyNames: string[]): string[] {
  const tags = [...BASE_HASHTAGS];
  for (const name of [...modelNames, ...companyNames]) {
    const tag = hashtagOf(name);
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      tags.push(tag);
      break;
    }
  }
  return tags;
}

export interface PostInput {
  titleMn: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
  link: string;
  modelNames?: string[];
  companyNames?: string[];
}

/** Постын бүтэн текст */
export function buildPost(a: PostInput): string {
  const lead = leadOf(a.summaryMn, a.bodyMn);
  const tags = hashtagsFor(a.modelNames ?? [], a.companyNames ?? []);
  return [a.titleMn?.trim() ?? "", lead, `👉 ${a.link}`, tags.join(" ")]
    .filter(Boolean)
    .join("\n\n");
}

/** Сайтын хаяг + slug. Хаягийг өгөөгүй бол SITE_URL-ээс (site.ts) авна. */
export function articleLink(slug: string, site = siteUrl()): string {
  return `${site.replace(/\/+$/, "")}/medee/${slug}`;
}
