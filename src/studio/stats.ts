/**
 * Студийн админ статистик — өдрийн зардал, бүтээлийн тоо, 👍 хувь.
 */
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { ubDayRange } from "../jobs/day";
import { dailyBudget } from "./studio.api";
import { today } from "./db";
import { overTarget, percentile } from "./parallel.api";
import { staleCount } from "./kb-check";

export interface StudioStats {
  /** Өнөөдрийн бүтээлийн тоо (УБ) */
  countToday: number;
  /** Өнөөдрийн зардал, ам.доллар */
  spentToday: number;
  /** Өдрийн төсөв */
  budget: number;
  /** Нэг бүтээлийн дундаж зардал (өнөөдөр) */
  avgCost: number;
  /** 7 хоногт үнэлгээ өгсөн тоо */
  rated: number;
  /** 7 хоногийн 👍 хувь. Үнэлгээ байхгүй бол null */
  thumbsUpPct: number | null;
  /** 7 хоногийн нийт бүтээл */
  week: number;
  /** Модерациар татгалзсан (7 хоног) */
  rejected: number;
  /** Эцсийн гаргалтын хугацаа, секундээр (7 хоног) */
  p50: number;
  p90: number;
  /** Зорилт (30с) давсан бүтээлийн тоо */
  overTarget: number;
  /** Мэдлэгийн сангаас баталгаажаагүй тул хасагдсан тооны нийлбэр (7 хоног) */
  stripped: number;
  /** 60 хоногоос хуучин мэдлэгийн файлын тоо */
  staleDocs: number;
  /** Засах давталтын тоо (7 хоног) */
  revisions: number;
}

const WEEK_MS = 7 * 86_400_000;

export async function studioStats(now = new Date()): Promise<StudioStats> {
  const { start } = ubDayRange(now);
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  const [usage, done, week, up, rated, rejected, timed] = await Promise.all([
    prisma.studioUsage.findMany({
      where: { day: today(now), subject: { startsWith: "ip:" } },
      select: { count: true, costUsd: true },
    }),
    prisma.studioSession.count({ where: { createdAt: { gte: start }, outputs: { not: Prisma.DbNull } } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo }, feedback: true } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo }, feedback: { not: null } } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo }, rejected: { not: null } } }),
    prisma.studioSession.findMany({
      where: { createdAt: { gte: weekAgo }, timings: { not: Prisma.DbNull } },
      select: { timings: true, strippedNumbers: true, revisionCount: true },
    }),
  ]);

  // Эцсийн гаргалтын хугацаа — зорилт 30с, p90 45с
  const msList = timed
    .map((r) => Number((r.timings as { output?: number } | null)?.output ?? 0))
    .filter((n) => n > 0);
  const toSec = (ms: number) => Math.round(ms / 100) / 10;

  const countToday = usage.reduce((n, r) => n + r.count, 0);
  const spent = usage.reduce((n, r) => n + (Number(r.costUsd ?? 0) || 0), 0);

  return {
    countToday,
    spentToday: spent,
    budget: dailyBudget(),
    avgCost: done > 0 ? spent / done : 0,
    rated,
    thumbsUpPct: rated > 0 ? Math.round((up / rated) * 100) : null,
    week,
    rejected,
    p50: toSec(percentile(msList, 50)),
    p90: toSec(percentile(msList, 90)),
    overTarget: msList.filter((ms) => overTarget("output", ms)).length,
    stripped: timed.reduce((n, r) => n + r.strippedNumbers, 0),
    revisions: timed.reduce((n, r) => n + r.revisionCount, 0),
    staleDocs: staleCount(now),
  };
}
