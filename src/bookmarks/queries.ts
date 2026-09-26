/**
 * Хадгалсан зүйлс — унших талын query-ууд.
 *
 * Нэг Bookmark мөр нь нийтлэл ЭСВЭЛ заавар заана (DB дээр CHECK constraint-аар барьсан).
 */
import { prisma } from "../db";
import type { ArticleCategory } from "../generated/prisma/enums";
import { guideCardSelect, toGuideCard, type GuideCard } from "../guides/queries";
import { promptCardSelect, toPromptCard, type PromptCard } from "../prompts/queries";
import { toolCardSelect, toToolCard, type ToolCard } from "../tools/queries";

/** Хадгалах боломжтой зүйл — яг нэг талбартай */
export type BookmarkTarget =
  | { articleId: string; guideId?: never; promptId?: never; toolId?: never }
  | { guideId: string; articleId?: never; promptId?: never; toolId?: never }
  | { promptId: string; articleId?: never; guideId?: never; toolId?: never }
  | { toolId: string; articleId?: never; guideId?: never; promptId?: never };

export interface BookmarkCard {
  id: string;
  slug: string;
  titleMn: string;
  summaryMn: string;
  category: ArticleCategory;
  publishedAt: Date | null;
  savedAt: Date;
}

/** Зааврын карт + хэзээ хадгалсан */
export type GuideBookmarkCard = GuideCard & { savedAt: Date };

/** Prompt-ын карт + хэзээ хадгалсан */
export type PromptBookmarkCard = PromptCard & { savedAt: Date };

/** Хэрэгслийн карт + хэзээ хадгалсан */
export type ToolBookmarkCard = ToolCard & { savedAt: Date };

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

  return rows.flatMap((r) =>
    r.article
      ? [{
          id: r.article.id,
          slug: r.article.slug,
          titleMn: r.article.titleMn ?? "",
          summaryMn: r.article.summaryMn ?? "",
          category: r.article.category,
          publishedAt: r.article.publishedAt,
          savedAt: r.createdAt,
        }]
      : [],
  );
}

/** Хадгалсан заавраууд */
export async function listGuideBookmarks(userId: string): Promise<GuideBookmarkCard[]> {
  const rows = await prisma.bookmark.findMany({
    where: { userId, guide: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, guide: { select: guideCardSelect } },
  });
  return rows.flatMap((r) => (r.guide ? [{ ...toGuideCard(r.guide), savedAt: r.createdAt }] : []));
}

/** Хадгалсан prompt-ууд */
export async function listPromptBookmarks(userId: string): Promise<PromptBookmarkCard[]> {
  const rows = await prisma.bookmark.findMany({
    where: { userId, prompt: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, prompt: { select: promptCardSelect } },
  });
  return rows.flatMap((r) => (r.prompt ? [{ ...toPromptCard(r.prompt), savedAt: r.createdAt }] : []));
}

/** Хадгалсан prompt-уудын id (жагсаалтын картууд) */
export async function bookmarkedPromptIds(userId: string, promptIds: string[]): Promise<Set<string>> {
  if (promptIds.length === 0) return new Set();
  const rows = await prisma.bookmark.findMany({
    where: { userId, promptId: { in: promptIds } },
    select: { promptId: true },
  });
  return new Set(rows.flatMap((r) => (r.promptId ? [r.promptId] : [])));
}

/** Хадгалсан хэрэгслүүд */
export async function listToolBookmarks(userId: string): Promise<ToolBookmarkCard[]> {
  const rows = await prisma.bookmark.findMany({
    where: { userId, tool: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, tool: { select: toolCardSelect } },
  });
  return rows.flatMap((r) => (r.tool ? [{ ...toToolCard(r.tool), savedAt: r.createdAt }] : []));
}

/** Хадгалсан нийтлэлүүдийн ангиллаар тоолсон дүн — шүүлтүүрт */
export async function bookmarkCategories(userId: string): Promise<{ category: ArticleCategory; count: number }[]> {
  const rows = await prisma.bookmark.groupBy({
    by: ["articleId"],
    where: { userId, article: { status: "PUBLISHED" } },
    _count: true,
  });
  const ids = rows.flatMap((r) => (r.articleId ? [r.articleId] : []));
  if (ids.length === 0) return [];

  const articles = await prisma.article.findMany({
    where: { id: { in: ids } },
    select: { category: true },
  });
  const counts = new Map<ArticleCategory, number>();
  for (const a of articles) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

/** Тухайн зүйлийг хадгалсан эсэх */
export async function isBookmarked(userId: string, target: BookmarkTarget): Promise<boolean> {
  const row = await prisma.bookmark.findFirst({ where: { userId, ...target }, select: { id: true } });
  return row !== null;
}

/** Олон нийтлэлийн төлөвийг нэг дуудлагаар (жагсаалтын картууд) */
export async function bookmarkedIds(userId: string, articleIds: string[]): Promise<Set<string>> {
  if (articleIds.length === 0) return new Set();
  const rows = await prisma.bookmark.findMany({
    where: { userId, articleId: { in: articleIds } },
    select: { articleId: true },
  });
  return new Set(rows.flatMap((r) => (r.articleId ? [r.articleId] : [])));
}

/** Хадгалсан заавруудын id (жагсаалтын картууд) */
export async function bookmarkedGuideIds(userId: string, guideIds: string[]): Promise<Set<string>> {
  if (guideIds.length === 0) return new Set();
  const rows = await prisma.bookmark.findMany({
    where: { userId, guideId: { in: guideIds } },
    select: { guideId: true },
  });
  return new Set(rows.flatMap((r) => (r.guideId ? [r.guideId] : [])));
}

/**
 * Хадгалсан бол хасна, үгүй бол хадгална. Идемпотент:
 * зэрэг дарахад «олдсонгүй» ч, unique зөрчил ч алдаа болохгүй.
 */
export async function toggleBookmarkFor(userId: string, target: BookmarkTarget): Promise<boolean> {
  const existing = await prisma.bookmark.findFirst({ where: { userId, ...target }, select: { id: true } });

  if (existing) {
    // deleteMany — өөр таб зэрэг устгасан байсан ч алдаа гаргахгүй
    await prisma.bookmark.deleteMany({ where: { userId, ...target } });
    return false;
  }

  try {
    await prisma.bookmark.create({ data: { userId, ...target } });
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
