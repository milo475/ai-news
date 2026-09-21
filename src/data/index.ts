/**
 * Хуудсууд зөвхөн энэ файлаас өгөгдөл авна.
 * USE_FIXTURES=1 → зохиомол өгөгдөл; үгүй бол Postgres.
 */
import type { LeaderboardRow } from "@/queries/leaderboard";
import type { RankSource } from "@/generated/prisma/enums";

const useFixtures = process.env.USE_FIXTURES === "1";

export interface ModelDetail {
  slug: string; name: string; nameMn: string | null;
  descriptionEn: string | null; descriptionMn: string | null;
  isOpenWeights: boolean; contextLength: number | null; modality: string | null;
  arenaOnly: boolean;
  releasedAt: Date | null;
  inputPricePerM: string | null; outputPricePerM: string | null;
  company: { slug: string; name: string };
}

export interface HistoryPoint { date: Date; rank: number; score: string }

export interface UseCaseCard {
  slug: string; nameMn: string; descriptionMn: string; icon: string;
  /** Карт дээр харуулах эхний 3 хэрэгслийн нэр */
  topTools: string[];
}

export interface UseCaseToolRow {
  rank: number; name: string; vendor: string; url: string;
  descriptionMn: string; noteMn: string | null;
  pricing: "FREE" | "FREEMIUM" | "PAID"; worksInMongolian: boolean;
}

export interface UseCaseDetail extends UseCaseCard {
  tools: UseCaseToolRow[];
}

export interface NewsCard {
  slug: string; titleMn: string; summaryMn: string;
  publishedAt: Date | null; sourceName: string; tags: string[];
  /** DIGEST = долоо хоногийн тойм */
  kind: "NEWS" | "DIGEST";
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
  slug: true, titleMn: true, summaryMn: true, publishedAt: true, tags: true, kind: true,
  source: { select: { name: true } },
} as const;

type CardRow = {
  slug: string; titleMn: string | null; summaryMn: string | null;
  publishedAt: Date | null; tags: string[]; kind: "NEWS" | "DIGEST"; source: { name: string };
};

function toCard(a: CardRow): NewsCard {
  return {
    slug: a.slug,
    titleMn: a.titleMn ?? "",
    summaryMn: a.summaryMn ?? "",
    publishedAt: a.publishedAt,
    sourceName: a.source.name,
    tags: a.tags,
    kind: a.kind,
  };
}

export async function getLeaderboard(
  limit = 50,
  source: RankSource = "OPENROUTER_USAGE",
): Promise<{ date: Date | null; rows: LeaderboardRow[] }> {
  if (useFixtures) return (await import("./fixtures")).fixtureLeaderboard(limit);
  const { getLatestLeaderboard } = await import("@/queries/leaderboard");
  return getLatestLeaderboard(source, limit);
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

export async function getHistory(
  slug: string,
  days = 30,
  source: RankSource = "OPENROUTER_USAGE",
): Promise<HistoryPoint[]> {
  if (useFixtures) return source === "ARENA_ELO" ? [] : (await import("./fixtures")).fixtureHistory(slug);
  const { getModelHistory } = await import("@/queries/leaderboard");
  const h = await getModelHistory(slug, source, days);
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

/** Нүүр хуудсанд дээр нь гарах хамгийн сүүлийн долоо хоногийн тойм */
export async function getLatestDigest(): Promise<NewsCard | null> {
  if (useFixtures) return null;
  const { prisma } = await import("@/db");
  const row = await prisma.article.findFirst({
    where: { status: "PUBLISHED", kind: "DIGEST" },
    orderBy: { publishedAt: "desc" },
    select: cardSelect,
  });
  return row ? toCard(row) : null;
}

/** Нүүр хуудасны "Сүүлийн мэдээ" */
export async function getLatestNews(limit = 5): Promise<NewsCard[]> {
  if (useFixtures) return [];
  const { prisma } = await import("@/db");
  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED", kind: "NEWS" }, orderBy: { publishedAt: "desc" }, take: limit, select: cardSelect,
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

/** Идэвхтэй ангиллууд, карт дээрх топ 3 хэрэгслийн хамт */
export async function getUseCases(limit?: number): Promise<UseCaseCard[]> {
  if (useFixtures) return (await import("./usecases.fixture")).fixtureUseCases.slice(0, limit);
  const { prisma } = await import("@/db");
  const rows = await prisma.useCase.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    take: limit,
    select: {
      slug: true, nameMn: true, descriptionMn: true, icon: true,
      tools: {
        where: { tool: { isActive: true } },
        orderBy: { rank: "asc" },
        take: 3,
        select: { tool: { select: { name: true } } },
      },
    },
  });
  return rows.map((u) => ({ ...u, topTools: u.tools.map((t) => t.tool.name) }));
}

export async function getUseCase(slug: string): Promise<UseCaseDetail | null> {
  if (useFixtures) return (await import("./usecases.fixture")).fixtureUseCase(slug);
  const { prisma } = await import("@/db");
  const u = await prisma.useCase.findUnique({
    where: { slug },
    select: {
      slug: true, nameMn: true, descriptionMn: true, icon: true, isActive: true,
      tools: {
        where: { tool: { isActive: true } },
        orderBy: { rank: "asc" },
        select: {
          rank: true, noteMn: true,
          tool: { select: { name: true, vendor: true, url: true, descriptionMn: true, pricing: true, worksInMongolian: true } },
        },
      },
    },
  });
  if (!u || !u.isActive) return null;
  return {
    slug: u.slug, nameMn: u.nameMn, descriptionMn: u.descriptionMn, icon: u.icon,
    topTools: u.tools.slice(0, 3).map((t) => t.tool.name),
    tools: u.tools.map((t) => ({ rank: t.rank, noteMn: t.noteMn, ...t.tool })),
  };
}

/** Тухайн ангиллын slug эсвэл нэрийг шошгондоо агуулсан нийтлэгдсэн мэдээ */
export async function getNewsForUseCase(slug: string, nameMn: string, limit = 5): Promise<NewsCard[]> {
  if (useFixtures) return [];
  const { prisma } = await import("@/db");
  const rows = await prisma.article.findMany({
    where: { status: "PUBLISHED", tags: { hasSome: [slug, nameMn.toLowerCase()] } },
    orderBy: { publishedAt: "desc" }, take: limit, select: cardSelect,
  });
  return rows.map(toCard);
}

/** Заавал ишлэх тэмдэглэл. Эх сурвалж бүр өөрийн огноотой. */
export async function getSourceNote(source: RankSource = "OPENROUTER_USAGE"): Promise<string> {
  const { date } = await getLeaderboard(1, source);
  const asOf = date ? date.toISOString().slice(0, 10) : "—";
  return source === "ARENA_ELO"
    ? `Source: LMArena (lmarena.ai), as of ${asOf}.`
    : `Source: OpenRouter (openrouter.ai/rankings), as of ${asOf}.`;
}
