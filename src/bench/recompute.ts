/**
 * Админ гараар оноо өгөхөд тухайн run-ийн дүн, эрэмбийг дахин бодно.
 */
import { prisma } from "../db";
import { summarize, type ScoredResult } from "./summary.api";

export async function recomputeSummaries(runId: string): Promise<number> {
  const rows = await prisma.benchResult.findMany({
    where: { runId },
    select: {
      modelSlug: true, latencyMs: true, costUsd: true, outputWords: true,
      judgeScore: true, checkerPass: true, humanScore: true, error: true,
      task: { select: { category: true, weight: true } },
    },
  });

  const scored: ScoredResult[] = rows.map((r) => ({
    modelSlug: r.modelSlug,
    category: r.task.category,
    weight: r.task.weight,
    latencyMs: r.latencyMs,
    costUsd: r.costUsd,
    outputWords: r.outputWords,
    judgeScore: r.judgeScore,
    checkerPass: r.checkerPass,
    humanScore: r.humanScore,
    error: r.error,
  }));

  const summaries = summarize(scored);
  await prisma.benchModelSummary.deleteMany({ where: { runId } });
  await prisma.benchModelSummary.createMany({
    data: summaries.map((s) => ({
      runId, modelSlug: s.modelSlug, avgScore: s.avgScore,
      scoreByCategory: s.scoreByCategory, avgLatency: s.avgLatency,
      costPer1kMn: s.costPer1kMn, completed: s.completed, rank: s.rank,
    })),
  });
  return summaries.length;
}
