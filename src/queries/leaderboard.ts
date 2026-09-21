/**
 * Нүүр хуудас / жагсаалтын хуудсанд хэрэглэх query-ууд.
 */
import { prisma } from "../db";
import type { RankSource } from "../generated/prisma/enums";

export interface LeaderboardRow {
  rank: number;
  rankDelta: number | null;     // null = шинэ орсон
  trend: "up" | "down" | "same" | "new";
  score: string;
  scoreDelta: string | null;    // түүхий зөрүү (Elo-д оноогоор харуулна)
  scoreDeltaPct: number | null; // хувиар
  model: { slug: string; name: string; nameMn: string | null; isOpenWeights: boolean };
  company: { slug: string; name: string };
}

/** Тухайн эх сурвалжийн хамгийн сүүлийн өдрийн жагсаалт */
export async function getLatestLeaderboard(
  source: RankSource = "OPENROUTER_USAGE",
  limit = 50,
): Promise<{ date: Date | null; rows: LeaderboardRow[] }> {
  const latest = await prisma.rankingSnapshot.findFirst({
    where: { source },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return { date: null, rows: [] };

  const snaps = await prisma.rankingSnapshot.findMany({
    where: { source, date: latest.date },
    orderBy: { rank: "asc" },
    take: limit,
    include: { model: { include: { company: true } } },
  });

  const rows = snaps.map((s): LeaderboardRow => {
    const score = Number(s.score);
    const delta = s.scoreDelta === null ? null : Number(s.scoreDelta);
    const prev = delta === null ? null : score - delta;
    return {
      rank: s.rank,
      rankDelta: s.rankDelta,
      trend:
        s.rankDelta === null ? "new" : s.rankDelta > 0 ? "up" : s.rankDelta < 0 ? "down" : "same",
      score: s.score.toString(),
      scoreDelta: s.scoreDelta === null ? null : s.scoreDelta.toString(),
      scoreDeltaPct: prev && prev > 0 && delta !== null ? Math.round((delta / prev) * 1000) / 10 : null,
      model: {
        slug: s.model.slug,
        name: s.model.name,
        nameMn: s.model.nameMn,
        isOpenWeights: s.model.isOpenWeights,
      },
      company: { slug: s.model.company.slug, name: s.model.company.name },
    };
  });
  return { date: latest.date, rows };
}

/** Моделийн хуудасны график: сүүлийн N өдрийн байр */
export async function getModelHistory(modelSlug: string, source: RankSource, days = 30) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  return prisma.rankingSnapshot.findMany({
    where: { source, model: { slug: modelSlug }, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, rank: true, score: true },
  });
}
