/**
 * Хадгалсан нийтлэлүүд — унших талын query-ууд.
 */
import { prisma } from "../db";
import type { ArticleCategory } from "../generated/prisma/enums";

export interface BookmarkCard {
  id: string;
  slug: string;
  titleMn: string;
  summaryMn: string;
  category: ArticleCategory;
  publishedAt: Date | null;
  savedAt: Date;
}

/** Хэрэглэгчийн хадгалсан нийтлэлүүд, сүүлд хадгалсан нь эхэнд */
export async function listBookmarks(
  userId: string,
  category?: ArticleCategory,
): Promise<BookmarkCard[]> {
  const rows = await prisma.bookmark.findMany({
    where: { userId, article: { status: "PUBLISHED", ...(category ? { category } : {}) } },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      article: {
        select: { id: true, slug: true, titleMn: true, summaryMn: true, category: true, publishedAt: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.article.id,
    slug: r.article.slug,
    titleMn: r.article.titleMn ?? "",
    summaryMn: r.article.summaryMn ?? "",
    category: r.article.category,
    publishedAt: r.article.publishedAt,
    savedAt: r.createdAt,
  }));
}

/** Хадгалсан нийтлэлүүдийн ангиллаар тоолсон дүн — шүүлтүүрт */
export async function bookmarkCategories(userId: string): Promise<{ category: ArticleCategory; count: number }[]> {
  const rows = await prisma.bookmark.groupBy({
    by: ["articleId"],
    where: { userId, article: { status: "PUBLISHED" } },
    _count: true,
  });
  if (rows.length === 0) return [];

  const articles = await prisma.article.findMany({
    where: { id: { in: rows.map((r) => r.articleId) } },
    select: { category: true },
  });
  const counts = new Map<ArticleCategory, number>();
  for (const a of articles) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

/** Тухайн нийтлэлийг хадгалсан эсэх */
export async function isBookmarked(userId: string, articleId: string): Promise<boolean> {
  const row = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId, articleId } },
    select: { id: true },
  });
  return row !== null;
}

/** Олон нийтлэлийн төлөвийг нэг дуудлагаар (жагсаалтын картууд) */
export async function bookmarkedIds(userId: string, articleIds: string[]): Promise<Set<string>> {
  if (articleIds.length === 0) return new Set();
  const rows = await prisma.bookmark.findMany({
    where: { userId, articleId: { in: articleIds } },
    select: { articleId: true },
  });
  return new Set(rows.map((r) => r.articleId));
}

/**
 * Хадгалсан бол хасна, үгүй бол хадгална. Идемпотент:
 * зэрэг дарахад «олдсонгүй» ч, unique зөрчил ч алдаа болохгүй.
 */
export async function toggleBookmarkFor(userId: string, articleId: string): Promise<boolean> {
  const existing = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId, articleId } },
    select: { id: true },
  });

  if (existing) {
    // deleteMany — өөр таб зэрэг устгасан байсан ч алдаа гаргахгүй
    await prisma.bookmark.deleteMany({ where: { userId, articleId } });
    return false;
  }

  try {
    await prisma.bookmark.create({ data: { userId, articleId } });
  } catch (e) {
    // Хоёр таб зэрэг дарвал unique зөрчил гарна — хадгалагдсан гэж үзнэ
    if (!isUniqueViolation(e)) throw e;
  }
  return true;
}

export function isUniqueViolation(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") return true;
  return e instanceof Error && e.message.includes("Unique constraint");
}
