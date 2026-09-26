/**
 * Галерейн унших query-ууд.
 */
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import type { ArticleCategory } from "../generated/prisma/enums";
import { decodeCursor, PAGE_SIZE, toPage, weeklyBest, type Page } from "./card.api";
import { memoTtl, TTL } from "../lib/cache.api";

export interface CardItem {
  id: string;
  slug: string;
  titleMn: string;
  /** Карт дээр бичигдсэн headline — hover-т харагдана */
  hook: string;
  category: ArticleCategory;
  publishedAt: Date | null;
  cardAt: Date | null;
  fbLikes: number;
  fbShares: number;
  cardCopies: number;
}

const cardSelect = {
  id: true, slug: true, titleMn: true, fbHook: true, category: true, publishedAt: true,
  fbImageAt: true, fbLikes: true, fbShares: true, cardCopies: true,
} as const;

type Row = Prisma.ArticleGetPayload<{ select: typeof cardSelect }>;

function toItem(a: Row): CardItem {
  return {
    id: a.id,
    slug: a.slug,
    titleMn: a.titleMn ?? "",
    hook: a.fbHook ?? a.titleMn ?? "",
    category: a.category,
    publishedAt: a.publishedAt,
    cardAt: a.fbImageAt,
    fbLikes: a.fbLikes,
    fbShares: a.fbShares,
    cardCopies: a.cardCopies,
  };
}

/** Карттай нийтлэлүүд — fbImageData байгаа нь л галерейд орно */
function baseWhere(category?: ArticleCategory): Prisma.ArticleWhereInput {
  return {
    status: "PUBLISHED",
    fbImageAt: { not: null },
    ...(category ? { category } : {}),
  };
}

/**
 * Галерейн нэг хуудас. Cursor нь (fbImageAt, id) — offset биш, шинэ карт нэмэгдэхэд
 * хуудас гулсахгүй.
 */
async function cardPageUncached(
  opts: { cursor?: string | null; category?: ArticleCategory; size?: number } = {},
): Promise<Page<CardItem>> {
  const size = opts.size ?? PAGE_SIZE;
  const c = decodeCursor(opts.cursor);

  const rows = await prisma.article.findMany({
    where: {
      ...baseWhere(opts.category),
      // Cursor-аас хойших мөрүүд: (at < cursor.at) эсвэл (at = cursor.at ба id < cursor.id)
      ...(c
        ? {
            OR: [
              { fbImageAt: { lt: new Date(c.at) } },
              { fbImageAt: new Date(c.at), id: { lt: c.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ fbImageAt: "desc" }, { id: "desc" }],
    take: size + 1,
    select: cardSelect,
  });

  const page = toPage(rows.map(toItem), size);
  return page;
}

/** Ангиллын шүүлтүүрийн сонголтууд — карттай нийтлэлүүдээс */
async function cardCategoriesUncached(): Promise<{ category: ArticleCategory; count: number }[]> {
  const rows = await prisma.article.groupBy({
    by: ["category"],
    where: baseWhere(),
    _count: true,
  });
  return rows
    .map((r) => ({ category: r.category, count: r._count }))
    .sort((a, b) => b.count - a.count);
}

/** Долоо хоногийн шилдэг картууд */
async function weeklyBestCardsUncached(limit = 3, days = 7): Promise<CardItem[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.article.findMany({
    where: { ...baseWhere(), fbImageAt: { gte: since } },
    orderBy: { fbImageAt: "desc" },
    take: 60,
    select: cardSelect,
  });
  return weeklyBest(rows.map(toItem), limit);
}

/** Нүүрний «Өдрийн баримт» блок */
async function latestCardsUncached(limit = 3): Promise<CardItem[]> {
  const rows = await prisma.article.findMany({
    where: baseWhere(),
    orderBy: [{ fbImageAt: "desc" }, { id: "desc" }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toItem);
}

export interface CardDetail extends CardItem {
  summaryMn: string;
  sourceName: string;
}

/** Нэг картын хуудас */
async function getCardUncached(slug: string): Promise<CardDetail | null> {
  const a = await prisma.article.findUnique({
    where: { slug },
    select: { ...cardSelect, status: true, summaryMn: true, source: { select: { name: true } } },
  });
  if (!a || a.status !== "PUBLISHED" || a.fbImageAt === null) return null;
  return {
    ...toItem(a),
    summaryMn: a.summaryMn ?? "",
    sourceName: a.source?.name ?? "",
  };
}

/** Sitemap-д — карттай бүх нийтлэлийн slug */
async function cardSlugsUncached(): Promise<{ slug: string; updatedAt: Date }[]> {
  const rows = await prisma.article.findMany({
    where: baseWhere(),
    orderBy: { fbImageAt: "desc" },
    select: { slug: true, fbImageAt: true, updatedAt: true },
  });
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.fbImageAt ?? r.updatedAt }));
}

/** Картын татсан/хуулсан тоо. Тоолуур унасан нь татахыг зогсоох ёсгүй. */
export async function countCopy(articleId: string): Promise<void> {
  try {
    await prisma.article.update({
      where: { id: articleId },
      data: { cardCopies: { increment: 1 } },
    });
  } catch {
    // тоолуур чухал биш
  }
}

/** Галерейн хуудас */
export const cardPage: typeof cardPageUncached = memoTtl(cardPageUncached, { name: "cardPage", ttlMs: TTL.list });

/** Ангиллын тоо */
export const cardCategories: typeof cardCategoriesUncached = memoTtl(cardCategoriesUncached, { name: "cardCategories", ttlMs: TTL.list });

/** Долоо хоногийн шилдэг */
export const weeklyBestCards: typeof weeklyBestCardsUncached = memoTtl(weeklyBestCardsUncached, { name: "weeklyBestCards", ttlMs: TTL.list });

/** Нүүр хуудасны картууд */
export const latestCards: typeof latestCardsUncached = memoTtl(latestCardsUncached, { name: "latestCards", ttlMs: TTL.home });

/** Картын дэлгэрэнгүй */
export const getCard: typeof getCardUncached = memoTtl(getCardUncached, { name: "getCard", ttlMs: TTL.list });

/** Sitemap-д зориулсан жагсаалт */
export const cardSlugs: typeof cardSlugsUncached = memoTtl(cardSlugsUncached, { name: "cardSlugs", ttlMs: TTL.list });
