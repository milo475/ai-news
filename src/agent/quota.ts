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
import { upcomingSlots } from "../publish/slot.api";
import {
  dailyPublishLimit,
  minScoreGroups,
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

/** Ангилал бүрийн доод оноог хангасан нийтлэлүүд (PROJECT/HOWTO нь нэгээр доогуур) */
function scoreWhere() {
  return { OR: minScoreGroups().map((g) => ({ category: { in: g.categories }, relevance: { gte: g.score } })) };
}

/**
 * УБ цагаар өнөөдөр нийтлэгдсэн мэдээний тоо (DIGEST ордоггүй).
 *
 * Дотоодын мэдээ **тусдаа квоттой** тул ерөнхий тооллогод орохгүй — эс тэгвээс
 * Монголын нэг мэдээ дэлхийн нэг мэдээг хөөнө.
 */
export async function publishedToday(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.article.count({
    where: {
      kind: "NEWS", status: "PUBLISHED", isLocal: false,
      publishedAt: { gte: start, lt: end },
    },
  });
}

/** Өнөөдөр нийтлэгдсэн ДОТООД мэдээний тоо */
export async function localPublishedToday(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.article.count({
    where: {
      kind: "NEWS", status: "PUBLISHED", isLocal: true,
      publishedAt: { gte: start, lt: end },
    },
  });
}

/**
 * Дотоод мэдээний квотад зай байгаа эсэх.
 *
 * DAILY_LOCAL_LIMIT=0 бол дотоод мэдээ автоматаар нийтлэгдэхгүй (гараар л).
 */
export async function localQuotaLeft(now = new Date()): Promise<number> {
  const { dailyLocalLimit } = await import("../mongol/filter.api");
  return Math.max(0, dailyLocalLimit() - (await localPublishedToday(now)));
}

/**
 * Нийтлэхэд бэлэн дотоод мэдээ сонгоно. Ерөнхий квотоос тусдаа — FB slot-д орохгүй,
 * зөвхөн /mongol ба нүүрэнд гарна.
 */
export async function pickLocal(now = new Date()): Promise<{ id: string } | null> {
  if ((await localQuotaLeft(now)) <= 0) return null;

  const { LOCAL_MIN_SCORE } = await import("../mongol/filter.api");
  const row = await prisma.article.findFirst({
    where: {
      kind: "NEWS", status: "DRAFT", isLocal: true,
      titleMn: { not: null },
      relevance: { gte: LOCAL_MIN_SCORE },
    },
    orderBy: [{ relevance: "desc" }, { publishedAtSource: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  return row;
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

  const todayRows = (await prisma.article.findMany({
    where: { kind: "NEWS", status: "PUBLISHED", isLocal: false, publishedAt: { gte: start, lt: end } },
    select: SELECT,
  })) as ArticleRow[];

  // Дотоод мэдээ FB slot-д орохгүй — тусдаа квоттой (pickLocal)
  const baseWhere = {
    kind: "NEWS" as const,
    status: "DRAFT" as const,
    isLocal: false,
    sourceText: { not: null },
    ...scoreWhere(),
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

/**
 * БЭЛТГЭХ горимд: бэлдэх N нийтлэлийг сонгоно.
 *
 * Зөвхөн оноогоор авбал нэг үйл явдлыг гурван эх сурвалж бичсэн байхад гурвуулаа бэлдэгдэж,
 * буфер нь бодитоор нэг л нийтлэл болдог. Тиймээс нийтлэх үеийнхтэй ижил дүрмийг (эх сурвалж,
 * ангилал, сэдвийн давхардал) энд ч хэрэглэнэ: өнөөдөр нийтлэгдсэн болон аль хэдийн бэлэн
 * болсон нийтлэлүүдтэй давхцахгүй байхаар сонгоно.
 */
export async function pickForPrepare(need: number, now = new Date()): Promise<string[]> {
  if (need <= 0) return [];
  const { start, end } = ubDayRange(now);

  const [todayRows, readyRows, pool] = (await Promise.all([
    prisma.article.findMany({
      where: { kind: "NEWS", status: "PUBLISHED", isLocal: false, publishedAt: { gte: start, lt: end } },
      select: SELECT,
    }),
    prisma.article.findMany({
      where: { kind: "NEWS", status: "DRAFT", isLocal: false, readyAt: { not: null } },
      select: SELECT,
    }),
    // Дотоод мэдээ буферт орохгүй — тусдаа квоттой, FB slot-д гарахгүй
    prisma.article.findMany({
      where: {
        kind: "NEWS", status: "DRAFT", isLocal: false, readyAt: null,
        sourceText: { not: null }, ...scoreWhere(),
      },
      orderBy: [{ relevance: "desc" }, { publishedAtSource: "desc" }, { createdAt: "desc" }],
      take: CANDIDATE_POOL,
      select: SELECT,
    }),
  ])) as [ArticleRow[], ArticleRow[], ArticleRow[]];

  // Буфер нь ирээдүйн slot-уудынх: ангилал/эх сурвалжийн хязгаарыг зөвхөн буферээр тооцно,
  // өнөөдөр нийтлэгдсэнийг зөвхөн сэдвийн давхардал шалгахад хэрэглэнэ.
  const taken = readyRows.map(toCandidate);
  const avoidTopics = todayRows.map(toCandidate);
  let left = pool.map(toCandidate);
  const ids: string[] = [];

  // Дараагийн slot-уудын ангиллаар нэг нэгээр нь сонгоно — оройн slot (PROJECT/HOWTO/BUSINESS)
  // хоосон үлдэхгүйн тулд. Тухайн ангилалд нэр дэвшигч байхгүй бол хамгийн сайныг нь авна.
  for (const slot of upcomingSlots(now, need)) {
    const picked = selectForPublish(left, 1, taken, slot.categories, { avoidTopics })[0];
    if (!picked) break;
    ids.push(picked.id);
    taken.push(picked);
    left = left.filter((c) => c.id !== picked.id);
  }
  return ids;
}

/** Өдрийн квотын үлдэгдэл */
export async function remainingQuota(now = new Date()): Promise<number> {
  return Math.max(0, dailyPublishLimit() - (await publishedToday(now)));
}
