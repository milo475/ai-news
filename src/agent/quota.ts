/**
 * Өдрийн квот — НИЙТЛЭХ горимын slot бүрт нэг нийтлэл сонгоно.
 *
 * УБ цагаар тухайн өдөр PUBLISHED болсон мэдээг тоолж, квот дүүрээгүй бол DRAFT-уудаас
 * quota.api.ts-ийн дүрмээр (slot-ын ангилал → оноо → эх сурвалж/ангилал/сэдвийн хязгаар)
 * сонгоно. Бэлэн (readyAt) нийтлэл байвал түүнийг эхэлж үзнэ — текст, зураг нь бэлэн
 * тул slot хурдан дуусна. Гараар /admin-аас нийтэлсэн нь мөн квотод тооцогдоно.
 */
import { prisma } from "../db";
import type { ArticleCategory } from "../generated/prisma/enums";
import { ubDayRange } from "../jobs/day";
import {
  autoPublishMinScore,
  dailyPublishLimit,
  selectForPublish,
  type PublishCandidate,
} from "./quota.api";

/** DRAFT-аас квотод нэр дэвших дээд тоо — оноогоор эрэмбэлж таслана */
const CANDIDATE_POOL = 50;

interface ArticleRow {
  id: string;
  relevance: number;
  sourceId: string;
  category: ArticleCategory;
  tags: string[];
  publishedAtSource: Date | null;
  createdAt: Date;
  models: { slug: string }[];
  companies: { slug: string }[];
}

const SELECT = {
  id: true,
  relevance: true,
  sourceId: true,
  category: true,
  tags: true,
  publishedAtSource: true,
  createdAt: true,
  models: { select: { slug: true } },
  companies: { select: { slug: true } },
} as const;

function toCandidate(a: ArticleRow): PublishCandidate {
  return {
    id: a.id,
    relevance: a.relevance,
    sourceId: a.sourceId,
    category: a.category,
    tags: a.tags,
    publishedAtSource: a.publishedAtSource,
    createdAt: a.createdAt,
    modelSlugs: a.models.map((m) => m.slug),
    companySlugs: a.companies.map((c) => c.slug),
  };
}

/** УБ цагаар өнөөдөр нийтлэгдсэн мэдээний тоо (DIGEST ордоггүй) */
export async function publishedToday(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.article.count({
    where: { kind: "NEWS", status: "PUBLISHED", publishedAt: { gte: start, lt: end } },
  });
}

/**
 * Тухайн slot-д нийтлэх нэг нийтлэлийг сонгоно (нийтлэхгүй — зөвхөн сонголт).
 * Бэлэн (readyAt) нийтлэлүүдийг эхэлж үзээд, олдохгүй бол бүх DRAFT-аас сонгоно.
 */
export async function pickForSlot(
  now: Date,
  prefer: ArticleCategory[] = [],
): Promise<{ id: string; category: ArticleCategory } | null> {
  const { start, end } = ubDayRange(now);
  const minScore = autoPublishMinScore();

  const todayRows = (await prisma.article.findMany({
    where: { kind: "NEWS", status: "PUBLISHED", publishedAt: { gte: start, lt: end } },
    select: SELECT,
  })) as ArticleRow[];

  const baseWhere = {
    kind: "NEWS" as const,
    status: "DRAFT" as const,
    relevance: { gte: minScore },
    sourceText: { not: null },
  };
  const order = [
    { relevance: "desc" as const },
    { publishedAtSource: "desc" as const },
    { createdAt: "desc" as const },
  ];

  // Эхлээд бэлэн болгосон нийтлэлүүд, дараа нь бусад
  for (const where of [{ ...baseWhere, readyAt: { not: null } }, baseWhere]) {
    const drafts = (await prisma.article.findMany({
      where, orderBy: order, take: CANDIDATE_POOL, select: SELECT,
    })) as ArticleRow[];
    if (drafts.length === 0) continue;

    const picked = selectForPublish(drafts.map(toCandidate), 1, todayRows.map(toCandidate), prefer);
    if (picked[0]) return { id: picked[0].id, category: picked[0].category };
  }
  return null;
}

/** Өдрийн квотын үлдэгдэл */
export async function remainingQuota(now = new Date()): Promise<number> {
  return Math.max(0, dailyPublishLimit() - (await publishedToday(now)));
}
