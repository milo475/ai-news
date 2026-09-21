/**
 * Хуудсууд зөвхөн энэ файлаас өгөгдөл авна.
 * USE_FIXTURES=1 → зохиомол өгөгдөл; үгүй бол Postgres.
 */
import type { LeaderboardRow } from "@/queries/leaderboard";

const useFixtures = process.env.USE_FIXTURES === "1";

export interface ModelDetail {
  slug: string; name: string; nameMn: string | null;
  descriptionEn: string | null; descriptionMn: string | null;
  isOpenWeights: boolean; contextLength: number | null; modality: string | null;
  releasedAt: Date | null;
  inputPricePerM: string | null; outputPricePerM: string | null;
  company: { slug: string; name: string };
}

export interface HistoryPoint { date: Date; rank: number; score: string }

export interface NewsCard {
  slug: string; titleMn: string; summaryMn: string;
  publishedAt: Date | null; sourceName: string; tags: string[];
}

export interface NewsDetail extends NewsCard {
  bodyMn: string;
  sourceUrl: string;
  sourceTitle: string;
  models: { slug: string; name: string; nameMn: string | null }[];
  companies: { name: string }[];
}

/** PUBLISHED нийтлэлийн нийтлэг select — картны талбарууд */
const cardSelect = {
  slug: true, titleMn: true, summaryMn: true, publishedAt: true, tags: true,
  source: { select: { name: true } },
} as const;

type CardRow = {
  slug: string; titleMn: string | null; summaryMn: string | null;
  publishedAt: Date | null; tags: string[]; source: { name: string };
};

function toCard(a: CardRow): NewsCard {
  return {
    slug: a.slug,
    titleMn: a.titleMn ?? "",
    summaryMn: a.summaryMn ?? "",
    publishedAt: a.publishedAt,
    sourceName: a.source.name,
    tags: a.tags,
  };
}

export async function getLeaderboard(limit = 50): Promise<{ date: Date | null; rows: LeaderboardRow[] }> {
  if (useFixtures) return (await import("./fixtures")).fixtureLeaderboard(limit);
  const { getLatestLeaderboard } = await import("@/queries/leaderboard");
  return getLatestLeaderboard("OPENROUTER_USAGE", limit);
}

export async function getModel(slug: string): Promise<ModelDetail | null> {
  if (useFixtures) return (await import("./fixtures")).fixtureModel(slug);
  const { prisma } = await import("@/db");
  const m = await prisma.aiModel.findUnique({ where: { slug }, include: { company: true } });
  if (!m) return null;
  return {
    ...m,
    inputPricePerM: m.inputPricePerM?.toString() ?? null,
    outputPricePerM: m.outputPricePerM?.toString() ?? null,
    company: { slug: m.company.slug, name: m.company.name },
  };
}

export async function getHistory(slug: string, days = 30): Promise<HistoryPoint[]> {
  if (useFixtures) return (await import("./fixtures")).fixtureHistory(slug);
  const { getModelHistory } = await import("@/queries/leaderboard");
  const h = await getModelHistory(slug, "OPENROUTER_USAGE", days);
  return h.map((p) => ({ ...p, score: p.score.toString() }));
}

/** Нийтлэгдсэн мэдээний жагсаалт, хуудаслалттай */
export async function getNews(page = 1, perPage = 20): Promise<{ items: NewsCard[]; total: number }> {
  if (useFixtures) return { items: [], total: 0 };
  const { prisma } = await import("@/db");
  const where = { status: "PUBLISHED" as const };
  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      where, orderBy: { publishedAt: "desc" },
      skip: (page - 1) * perPage, take: perPage, select: cardSelect,
    }),
    prisma.article.count({ where }),
  ]);
  return { items: rows.map(toCard), total };
}

/** Нүүр хуудасны "Сүүлийн мэдээ" */
export async function getLatestNews(limit = 5): Promise<NewsCard[]> {
  if (useFixtures) return [];
  const { prisma } = await import("@/db");
  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: limit, select: cardSelect,
  });
  return rows.map(toCard);
}

/** Моделийн хуудасны "Холбоотой мэдээ" */
export async function getNewsForModel(slug: string, limit = 5): Promise<NewsCard[]> {
  if (useFixtures) return [];
  const { prisma } = await import("@/db");
  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED", models: { some: { slug } } },
    orderBy: { publishedAt: "desc" }, take: limit, select: cardSelect,
  });
  return rows.map(toCard);
}

export async function getNewsItem(slug: string): Promise<NewsDetail | null> {
  if (useFixtures) return null;
  const { prisma } = await import("@/db");
  const a = await prisma.article.findUnique({
    where: { slug },
    select: {
      ...cardSelect, status: true, bodyMn: true, sourceUrl: true, sourceTitle: true,
      models: { select: { slug: true, name: true, nameMn: true } },
      companies: { select: { name: true } },
    },
  });
  if (!a || a.status !== "PUBLISHED") return null;
  return {
    ...toCard(a),
    bodyMn: a.bodyMn ?? "",
    sourceUrl: a.sourceUrl,
    sourceTitle: a.sourceTitle,
    models: a.models,
    companies: a.companies,
  };
}

export async function getSourceNote(): Promise<string> {
  const { date } = await getLeaderboard(1);
  const asOf = date ? date.toISOString().slice(0, 10) : "—";
  return `Source: OpenRouter (openrouter.ai/rankings), as of ${asOf}.`;
}
