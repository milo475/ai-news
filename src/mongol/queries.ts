/**
 * /mongol хуудасны query-ууд.
 */
import { prisma } from "../db";
import type { NewsCard } from "../data";

const cardSelect = {
  id: true, slug: true, titleMn: true, summaryMn: true, publishedAt: true, tags: true, kind: true,
  source: { select: { name: true } },
} as const;

function toCard(a: {
  id: string; slug: string; titleMn: string | null; summaryMn: string | null;
  publishedAt: Date | null; tags: string[]; kind: "NEWS" | "DIGEST";
  source: { name: string } | null;
}): NewsCard {
  return {
    id: a.id,
    slug: a.slug,
    titleMn: a.titleMn ?? "",
    summaryMn: a.summaryMn ?? "",
    publishedAt: a.publishedAt,
    tags: a.tags,
    kind: a.kind,
    sourceName: a.source?.name ?? "",
  };
}

/** Дотоодын нийтлэгдсэн мэдээ, шинээс хуучин руу */
export async function localNews(limit = 20): Promise<NewsCard[]> {
  const rows = await prisma.article.findMany({
    where: { region: "MN", status: "PUBLISHED", kind: "NEWS" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export interface ProjectCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  website: string;
  category: string;
  isFeatured: boolean;
  hasLogo: boolean;
}

/** Монголын AI төсөл, компаниуд — гараар хөтөлдөг жагсаалт */
export async function mongolProjects(): Promise<ProjectCard[]> {
  const rows = await prisma.mongolProject.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { order: "asc" }, { name: "asc" }],
    select: {
      id: true, slug: true, name: true, description: true, website: true, category: true,
      isFeatured: true, logoAt: true,
    },
  });
  return rows.map(({ logoAt, ...r }) => ({ ...r, hasLogo: logoAt !== null }));
}

/** Дотоодын мэдээ хэдэн байна — /admin, нүүрний блокт */
export async function localCounts(): Promise<{ published: number; draft: number; raw: number }> {
  const rows = await prisma.article.groupBy({
    by: ["status"],
    where: { region: "MN" },
    _count: true,
  });
  const of = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  return { published: of("PUBLISHED"), draft: of("DRAFT"), raw: of("RAW") };
}

/** Дотоодын эх сурвалжууд — /admin/mongol */
export async function localSources() {
  return prisma.source.findMany({
    where: { region: "MN" },
    orderBy: [{ isActive: "desc" }, { weight: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, url: true, feedUrl: true, listUrl: true, linkSelector: true,
      weight: true, isActive: true, lastFetchedAt: true, lastError: true,
      _count: { select: { articles: true } },
    },
  });
}
