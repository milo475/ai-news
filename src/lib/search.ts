/**
 * Сайтын хайлт — Postgres-ийн өөрийн full-text search (нэмэлт сан, сервисгүй).
 *
 * Индекс нь 'simple' тохиргоотой (монгол кирилл үсэгт stemmer байхгүй) + unaccent.
 * Сүүлийн үгэнд `:*` залгаж бичиж байх үед нь олддог болгоно ("gem" → Gemini).
 */
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db";
import { buildTsQuery, MIN_QUERY } from "./search-query";

export { buildTsQuery, MIN_QUERY };

const DEFAULT_LIMIT = 8;

export interface ArticleHit {
  slug: string;
  titleMn: string;
  summaryMn: string;
  kind: "NEWS" | "DIGEST";
  publishedAt: Date | null;
  /** ts_headline — тааралт тодруулсан хэсэг (<mark> тэгтэй) */
  headline: string;
}

export interface ModelHit {
  slug: string;
  name: string;
  companyName: string;
  arenaOnly: boolean;
}

export interface GuideHit {
  slug: string;
  title: string;
  lead: string;
  readMinutes: number;
  /** ts_headline — тааралт тодруулсан хэсэг (<mark> тэгтэй) */
  headline: string;
}

export interface PromptHit {
  slug: string;
  title: string;
  description: string;
  category: string;
  copies: number;
  /** ts_headline — тааралт тодруулсан хэсэг (<mark> тэгтэй) */
  headline: string;
}

export interface ToolHit {
  slug: string;
  name: string;
  vendor: string;
  descriptionMn: string;
  /** Аль ангиллаас олдсон бэ (ангиллын нэрээр таарсан үед) */
  useCaseSlug: string | null;
  useCaseName: string | null;
}

export interface SearchResults {
  q: string;
  articles: ArticleHit[];
  guides: GuideHit[];
  prompts: PromptHit[];
  models: ModelHit[];
  tools: ToolHit[];
  total: number;
}

const EMPTY = (q: string): SearchResults =>
  ({ q, articles: [], guides: [], prompts: [], models: [], tools: [], total: 0 });

export async function search(q: string, opts: { limit?: number } = {}): Promise<SearchResults> {
  const trimmed = q.trim();
  if (trimmed.length < MIN_QUERY) return EMPTY(trimmed);
  const ts = buildTsQuery(trimmed);
  if (!ts) return EMPTY(trimmed);

  const limit = opts.limit ?? DEFAULT_LIMIT;
  const query = Prisma.sql`to_tsquery('simple', immutable_unaccent(${ts}))`;

  const [articles, guides, prompts, models, tools] = await Promise.all([
    prisma.$queryRaw<ArticleHit[]>`
      SELECT a."slug", coalesce(a."titleMn", a."sourceTitle") AS "titleMn",
             coalesce(a."summaryMn", '') AS "summaryMn", a."kind"::text AS "kind", a."publishedAt",
             ts_headline('simple', immutable_unaccent(coalesce(a."bodyMn", a."summaryMn", '')), ${query},
                         'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=28,MinWords=12') AS "headline"
      FROM "Article" a
      WHERE a."status" = 'PUBLISHED' AND a."searchVector" @@ ${query}
      ORDER BY ts_rank(a."searchVector", ${query}) DESC, a."publishedAt" DESC NULLS LAST
      LIMIT ${limit}`,
    // Заавар — мөнхийн контент тул хайлтад мэдээний дараа нь тавина
    prisma.$queryRaw<GuideHit[]>`
      SELECT g."slug", g."title", g."lead", g."readMinutes",
             ts_headline('simple', immutable_unaccent(g."bodyMd"), ${query},
                         'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=28,MinWords=12') AS "headline"
      FROM "Guide" g
      WHERE g."status" = 'PUBLISHED' AND g."searchVector" @@ ${query}
      ORDER BY ts_rank(g."searchVector", ${query}) DESC, g."publishedAt" DESC NULLS LAST
      LIMIT ${limit}`,
    prisma.$queryRaw<PromptHit[]>`
      SELECT p."slug", p."title", p."description", p."category"::text AS "category", p."copies",
             ts_headline('simple', immutable_unaccent(p."body"), ${query},
                         'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=28,MinWords=12') AS "headline"
      FROM "Prompt" p
      WHERE p."status" = 'PUBLISHED' AND p."searchVector" @@ ${query}
      ORDER BY ts_rank(p."searchVector", ${query}) DESC, p."copies" DESC
      LIMIT ${limit}`,
    prisma.$queryRaw<ModelHit[]>`
      SELECT m."slug", m."name", c."name" AS "companyName", m."arenaOnly"
      FROM "AiModel" m
      JOIN "Company" c ON c."id" = m."companyId"
      WHERE m."isActive" = true AND m."searchVector" @@ ${query}
      ORDER BY ts_rank(m."searchVector", ${query}) DESC, m."name" ASC
      LIMIT ${limit}`,
    // Хэрэгслийг өөрийнх нь нэр/тайлбар, эсвэл харьяалагдах ангиллын нэрээр ("код бичих") олно
    prisma.$queryRaw<ToolHit[]>`
      SELECT DISTINCT ON (t."slug")
             t."slug", t."name", t."vendor", t."descriptionMn",
             u."slug" AS "useCaseSlug", u."nameMn" AS "useCaseName",
             greatest(ts_rank(t."searchVector", ${query}), coalesce(ts_rank(u."searchVector", ${query}), 0)) AS "rank"
      FROM "AiTool" t
      LEFT JOIN "UseCaseTool" ut ON ut."toolId" = t."id"
      LEFT JOIN "UseCase" u ON u."id" = ut."useCaseId" AND u."isActive" = true
      WHERE t."isActive" = true
        AND (t."searchVector" @@ ${query} OR u."searchVector" @@ ${query})
      ORDER BY t."slug", "rank" DESC
      LIMIT ${limit}`,
  ]);

  // DISTINCT ON нь slug-аар эрэмбэлдэг тул оноогоор нь дахин эрэмбэлнэ
  const sortedTools = (tools as (ToolHit & { rank?: number })[])
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .map(({ rank: _rank, ...t }) => t);

  return {
    q: trimmed,
    articles,
    guides,
    prompts,
    models,
    tools: sortedTools,
    total: articles.length + guides.length + prompts.length + models.length + sortedTools.length,
  };
}

/** Юу хайгдаж байгааг харахад. Хувийн мэдээлэл хадгалахгүй. */
export async function logSearch(q: string, resultCount: number): Promise<void> {
  try {
    await prisma.searchLog.create({ data: { q: q.slice(0, 200), resultCount } });
  } catch {
    // Бүртгэл амжилтгүй болсон нь хайлтыг унагаах ёсгүй
  }
}
