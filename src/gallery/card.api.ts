/**
 * Галерейн цэвэр логик — cursor pagination, хуваалцах хаягууд, embed (DB, React-гүй).
 */
import type { ArticleCategory } from "../generated/prisma/enums";

/** Нэг хуудсанд хэдэн карт */
export const PAGE_SIZE = 24;

/** Картын харьцаа — 1080×1350 (4:5) */
export const CARD_W = 1080;
export const CARD_H = 1350;

// ——— Cursor pagination ———

export interface Cursor {
  /** Картын үүсгэсэн огноо (ms) */
  at: number;
  /** Ижил огноотой картуудыг тогтвортой салгах */
  id: string;
}

/**
 * Cursor-ыг хаягт тавихад тохирох мөр болгоно.
 *
 * Зөвхөн (at, id) — offset биш. Offset нь шинэ карт нэмэгдэхэд хуудас гулсаж
 * давхардал/цоорхой үүсгэдэг.
 */
export function encodeCursor(c: Cursor): string {
  return `${c.at}_${c.id}`;
}

export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  const i = raw.indexOf("_");
  if (i <= 0) return null;
  const at = Number(raw.slice(0, i));
  const id = raw.slice(i + 1);
  if (!Number.isFinite(at) || at <= 0 || !id) return null;
  return { at, id };
}

export interface Page<T> {
  items: T[];
  /** Дараагийн хуудсын cursor. null = дууссан. */
  next: string | null;
}

/**
 * PAGE_SIZE + 1 мөр уншиж, илүү нь байвал дараагийн cursor гаргана.
 *
 * Ингэснээр «дараагийн хуудас байгаа эсэх»-ийг тусдаа count query-гүйгээр мэднэ.
 */
export function toPage<T extends { id: string; cardAt: Date | null }>(
  rows: T[],
  size = PAGE_SIZE,
): Page<T> {
  const items = rows.slice(0, size);
  const hasMore = rows.length > size;
  const last = items[items.length - 1];
  return {
    items,
    next: hasMore && last?.cardAt ? encodeCursor({ at: last.cardAt.getTime(), id: last.id }) : null,
  };
}

// ——— Хуваалцах ———

export const PLATFORMS = ["facebook", "x", "telegram", "messenger"] as const;
export type SharePlatform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<SharePlatform, string> = {
  facebook: "Facebook",
  x: "X",
  telegram: "Telegram",
  messenger: "Messenger",
};

/**
 * Хуваалцах хаяг. Бүгд нийтийн share dialog — нэвтрэх, апп шаардахгүй.
 *
 * Messenger-ийн web dialog нь `app_id` шаарддаг; FB_APP_ID тохируулаагүй бол
 * Messenger-ийг харуулахгүй (доорх `sharePlatforms`).
 */
export function shareUrl(
  platform: SharePlatform,
  url: string,
  text: string,
  appId?: string,
): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (platform) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case "messenger":
      return `https://www.facebook.com/dialog/send?link=${u}&app_id=${encodeURIComponent(appId ?? "")}&redirect_uri=${u}`;
  }
}

/** Ямар платформууд харагдах вэ — Messenger нь FB_APP_ID-гүйгээр ажиллахгүй */
export function sharePlatforms(env: Record<string, string | undefined> = process.env): SharePlatform[] {
  const appId = (env.FB_APP_ID ?? "").trim();
  return PLATFORMS.filter((p) => p !== "messenger" || appId !== "");
}

// ——— Embed ———

/** Embed-ийн анхдагч хэмжээ — картын 4:5 харьцаанд тохирсон */
export const EMBED_W = 400;
export const EMBED_H = 560;

/**
 * Бусад сайт тавих iframe код.
 *
 * `loading="lazy"` нь embed хийсэн сайтын хурдыг гэмтээхгүй; `title` нь
 * хүртээмжид (screen reader) шаардлагатай.
 */
export function embedCode(siteUrl: string, slug: string, title: string): string {
  const site = siteUrl.replace(/\/+$/, "");
  const safeTitle = title.replace(/"/g, "&quot;");
  return (
    `<iframe src="${site}/barimt/${slug}/embed" width="${EMBED_W}" height="${EMBED_H}" ` +
    `style="border:0;max-width:100%" loading="lazy" title="${safeTitle} — AI News"></iframe>`
  );
}

// ——— «Долоо хоногийн шилдэг» ———

/**
 * Эрэмбийн оноо. FB-ийн тоо байвал түүнийг, байхгүй бол картын татсан тоог хэрэглэнэ.
 *
 * Share нь like-аас хүчтэй дохио (хүн өөрийн хуудсанд тавьсан) тул 3 дахин жинтэй.
 */
export const SHARE_WEIGHT = 3;

export function cardScore(a: { fbLikes: number; fbShares: number; cardCopies: number }): number {
  const fb = a.fbLikes + a.fbShares * SHARE_WEIGHT;
  return fb > 0 ? fb : a.cardCopies;
}

/** Долоо хоногийн шилдгийг сонгоно — өгөгдөлгүй бол хоосон */
export function weeklyBest<T extends { fbLikes: number; fbShares: number; cardCopies: number }>(
  rows: T[],
  limit = 3,
): T[] {
  return [...rows]
    .filter((r) => cardScore(r) > 0)
    .sort((a, b) => cardScore(b) - cardScore(a))
    .slice(0, limit);
}

// ——— Ангиллын шүүлт ———

/** Галерейд ямар ангилал байж болох вэ — Article-ийн ангиллууд */
export function parseCategory(
  raw: string | undefined,
  allowed: readonly string[],
): ArticleCategory | undefined {
  const key = (raw ?? "").trim().toUpperCase();
  return allowed.includes(key) ? (key as ArticleCategory) : undefined;
}

/**
 * Картын зургийн хаяг.
 *
 * `?v=<cardAt>` нэмэхэд сервер нь `Cache-Control: immutable` өгдөг (src/lib/image-response.ts):
 * хөтөч дахин хэзээ ч асуухгүй, карт дахин үүсэхэд хаяг нь өөрчлөгдөж шинэчлэгдэнэ.
 */
export function cardImageUrl(id: string, cardAt: Date | null): string {
  const base = `/api/fb-image/${id}`;
  return cardAt ? `${base}?v=${cardAt.getTime()}` : base;
}
