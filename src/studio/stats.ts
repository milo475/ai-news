/**
 * Студийн админ статистик — өдрийн зардал, бүтээлийн тоо, 👍 хувь.
 */
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { ubDayRange } from "../jobs/day";
import { dailyBudget } from "./studio.api";
import { today } from "./db";

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
}

const WEEK_MS = 7 * 86_400_000;

export async function studioStats(now = new Date()): Promise<StudioStats> {
  const { start } = ubDayRange(now);
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  const [usage, done, week, up, rated, rejected] = await Promise.all([
    prisma.studioUsage.findMany({
      where: { day: today(now), subject: { startsWith: "ip:" } },
      select: { count: true, costUsd: true },
    }),
    prisma.studioSession.count({ where: { createdAt: { gte: start }, outputs: { not: Prisma.DbNull } } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo }, feedback: true } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo }, feedback: { not: null } } }),
    prisma.studioSession.count({ where: { createdAt: { gte: weekAgo }, rejected: { not: null } } }),
  ]);

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
  };
}
