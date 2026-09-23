/**
 * Өдрийн квотоор авто нийтлэх — agent алхмын төгсгөлд ажиллана.
 *
 * УБ цагаар тухайн өдөр PUBLISHED болсон мэдээг тоолж, үлдсэн квотыг DRAFT-уудаас
 * оноо өндөрөөс нь эхлэн сонгоно (quota.api.ts-ийн дүрмээр). Бусад нь DRAFT хэвээр —
 * /admin-аас гараар нийтэлж болно, гараар нийтэлсэн нь мөн квотод тооцогдоно.
 */
import { prisma } from "../db";
import { ubDateLabel, ubDayRange } from "../jobs/day";
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
    tags: a.tags,
    publishedAtSource: a.publishedAtSource,
    createdAt: a.createdAt,
    modelSlugs: a.models.map((m) => m.slug),
    companySlugs: a.companies.map((c) => c.slug),
  };
}

export interface AutoPublishResult {
  /** Өдрийн дээд хязгаар */
  limit: number;
  /** УБ цагаар өнөөдөр аль хэдийн нийтлэгдсэн (гараар нийтэлсэн нь ч ордог) */
  already: number;
  /** Энэ ажиллалтад нийтэлсэн */
  published: { id: string; titleMn: string | null; slug: string; relevance: number }[];
}

/** УБ цагаар өнөөдөр нийтлэгдсэн мэдээний тоо (DIGEST ордоггүй) */
export async function publishedToday(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.article.count({
    where: { kind: "NEWS", status: "PUBLISHED", publishedAt: { gte: start, lt: end } },
  });
}

/** Квотын үлдэгдлийг DRAFT-уудаар дүүргэнэ */
export async function runAutoPublish(now = new Date()): Promise<AutoPublishResult> {
  const limit = dailyPublishLimit();
  const minScore = autoPublishMinScore();
  const { start, end } = ubDayRange(now);

  const todayRows = (await prisma.article.findMany({
    where: { kind: "NEWS", status: "PUBLISHED", publishedAt: { gte: start, lt: end } },
    select: SELECT,
  })) as ArticleRow[];
  const already = todayRows.length;
  const remaining = limit - already;

  if (remaining <= 0) {
    console.log(
      limit === 0
        ? "Авто нийтлэх унтраалттай (DAILY_PUBLISH_LIMIT=0)"
        : `Өнөөдөр (${ubDateLabel(now)}) квот дүүрсэн: ${already}/${limit}`,
    );
    return { limit, already, published: [] };
  }

  // Зөвхөн бүтэн тексттэй нийтлэлийг авто нийтэлнэ — хураангуйгаар бичигдсэнд баримт дутуу байж мэднэ
  const drafts = (await prisma.article.findMany({
    where: { kind: "NEWS", status: "DRAFT", relevance: { gte: minScore }, sourceText: { not: null } },
    orderBy: [{ relevance: "desc" }, { publishedAtSource: "desc" }, { createdAt: "desc" }],
    take: CANDIDATE_POOL,
    select: SELECT,
  })) as ArticleRow[];

  const picks = selectForPublish(drafts.map(toCandidate), remaining, todayRows.map(toCandidate));

  const published: AutoPublishResult["published"] = [];
  for (const p of picks) {
    const a = await prisma.article.update({
      where: { id: p.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), reviewedBy: "auto" },
      select: { id: true, titleMn: true, slug: true, relevance: true },
    });
    published.push(a);
    console.log(`↑ PUBLISHED score=${a.relevance} "${a.titleMn}" /medee/${a.slug}`);
  }

  console.log(
    `Өдрийн квот ${limit}: өмнө нь ${already}, одоо ${published.length} нийтлэв ` +
      `(${drafts.length} DRAFT нэр дэвшсэн, оноо ≥ ${minScore}).`,
  );
  return { limit, already, published };
}
