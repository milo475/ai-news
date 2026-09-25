/**
 * Хэрэглэгчийн сонирхол — ангилал, хэрэглээний slug, долоо хоногийн имэйл.
 *
 * Хоосон ангилал = "бүгд" гэсэн үг тул "Таны сонирхол" блок харагдахгүй.
 */
import { prisma } from "../db";
import type { ArticleCategory } from "../generated/prisma/enums";
import type { NewsCard } from "../data";

export interface Preference {
  categories: ArticleCategory[];
  usecases: string[];
  digestEmail: boolean;
}

export const DEFAULT_PREFERENCE: Preference = { categories: [], usecases: [], digestEmail: true };

export async function getPreference(userId: string): Promise<Preference> {
  const row = await prisma.userPreference.findUnique({
    where: { userId },
    select: { categories: true, usecases: true, digestEmail: true },
  });
  return row ?? DEFAULT_PREFERENCE;
}

/** Сонгосон ангиллуудын сүүлийн мэдээ — нүүрний "Таны сонирхол" блокт */
export async function newsForInterests(
  categories: ArticleCategory[],
  limit = 4,
): Promise<NewsCard[]> {
  if (categories.length === 0) return [];
  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED", kind: "NEWS", category: { in: categories } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true, slug: true, titleMn: true, summaryMn: true, publishedAt: true, tags: true, kind: true,
      source: { select: { name: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    titleMn: a.titleMn ?? "",
    summaryMn: a.summaryMn ?? "",
    publishedAt: a.publishedAt,
    tags: a.tags,
    kind: a.kind,
    sourceName: a.source?.name ?? "",
  }));
}
