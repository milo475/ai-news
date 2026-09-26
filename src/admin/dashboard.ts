/**
 * /admin нүүрний өдрийн самбар — «өнөөдөр юу болов» гэдгийг нэг дэлгэцэнд.
 *
 * Бүх тоог нэг Promise.all-д цуглуулна: админ хуудас нэг л удаа DB рүү очно.
 */
import { prisma } from "@/db";
import { ubDayRange } from "@/jobs/day";
import { lastError } from "@/lib/errors";

export interface Dashboard {
  /** Өнөөдөр нийтэлсэн (УБ-ийн өдрөөр) */
  publishedToday: number;
  /** Өнөөдөр нийтэлсэн дотоодын мэдээ */
  localToday: number;
  /** Шинээр орж ирсэн түүхий мэдээ */
  rawCount: number;
  /** Нийтлэхэд бэлэн DRAFT */
  readyCount: number;
  fb: { queue: number; postedToday: number; failed: number };
  ig: { queue: number; postedToday: number; failed: number };
  /** OpenRouter-т төлсөн дүн */
  cost: { today: number; month: number };
  users: { today: number; week: number; total: number };
  /** Хүлээгдэж буй хэрэглэгчийн илгээлтүүд */
  pending: { prompts: number; tools: number; reviews: number };
  lastRun: { job: string; startedAt: Date; finishedAt: Date | null; ok: boolean | null } | null;
  lastError: Awaited<ReturnType<typeof lastError>>;
}

/** Decimal | null → тоо */
function num(v: { toString(): string } | null | undefined): number {
  return v ? Number(v.toString()) : 0;
}

export async function dashboard(now = new Date()): Promise<Dashboard> {
  const { start, end } = ubDayRange(now);
  // Сарын эхлэл — УБ-ийн цагаар (UTC+8 тул 8 цагаар хойш татна)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 8 * 3_600_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const today = { gte: start, lt: end };

  const [
    publishedToday, localToday, rawCount, readyCount,
    fbQueue, fbToday, fbFailed,
    igQueue, igToday, igFailed,
    costToday, costMonth,
    usersToday, usersWeek, usersTotal,
    pendingPrompts, pendingTools, pendingReviews,
    lastRun, err,
  ] = await Promise.all([
    prisma.article.count({ where: { status: "PUBLISHED", publishedAt: today } }),
    prisma.article.count({ where: { status: "PUBLISHED", region: "MN", publishedAt: today } }),
    prisma.article.count({ where: { status: "RAW" } }),
    prisma.article.count({ where: { status: "DRAFT", readyAt: { not: null } } }),

    prisma.article.count({ where: { status: "PUBLISHED", fbPostId: null, fbPostedAt: null, fbAttempts: { lt: 3 } } }),
    prisma.article.count({ where: { fbPostedAt: today } }),
    prisma.article.count({ where: { fbError: { not: null }, fbPostedAt: null } }),

    prisma.article.count({ where: { status: "PUBLISHED", igMediaId: null, igPostedAt: null, fbImageData: { not: null }, igAttempts: { lt: 3 } } }),
    prisma.article.count({ where: { igPostedAt: today } }),
    prisma.article.count({ where: { igError: { not: null }, igPostedAt: null } }),

    prisma.jobRun.aggregate({ _sum: { costUsd: true }, where: { startedAt: today } }),
    prisma.jobRun.aggregate({ _sum: { costUsd: true }, where: { startedAt: { gte: monthStart } } }),

    prisma.user.count({ where: { createdAt: today } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count(),

    prisma.prompt.count({ where: { status: "PENDING" } }),
    prisma.tool.count({ where: { status: "PENDING" } }),
    prisma.toolReview.count({ where: { status: "PENDING" } }),

    prisma.jobRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { job: true, startedAt: true, finishedAt: true, ok: true },
    }),
    lastError(),
  ]);

  return {
    publishedToday, localToday, rawCount, readyCount,
    fb: { queue: fbQueue, postedToday: fbToday, failed: fbFailed },
    ig: { queue: igQueue, postedToday: igToday, failed: igFailed },
    cost: { today: num(costToday._sum.costUsd), month: num(costMonth._sum.costUsd) },
    users: { today: usersToday, week: usersWeek, total: usersTotal },
    pending: { prompts: pendingPrompts, tools: pendingTools, reviews: pendingReviews },
    lastRun,
    lastError: err,
  };
}
