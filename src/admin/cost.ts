/**
 * Өдрийн LLM зардлыг алхам бүрээр уншина.
 *
 * Хоёр эх сурвалж:
 *   · JobRun.costUsd — pipeline-ийн алхмууд өөрсдөө бичдэг;
 *   · StudioUsage.costUsd — студи нь JobRun үүсгэдэггүй (вэбээс дуудагддаг).
 */
import { prisma } from "../db";
import { ubDateLabel, ubDayRange } from "../jobs/day";
import { cappedTotal, LLM_STEPS, sortSteps, stepLabel, type DayCost, type StepCost } from "./cost.api";

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}

/** Нэг өдрийн (УБ) задаргаа */
export async function dayCost(now = new Date()): Promise<DayCost> {
  const { start, end } = ubDayRange(now);
  const day = ubDateLabel(now);

  // UTC өдрийн хил — OpenRouter-ийн usage_daily-тай тулгахад
  const utcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const utcEnd = new Date(utcStart.getTime() + 86_400_000);

  const [jobs, studio, utcJobs] = await Promise.all([
    prisma.jobRun.groupBy({
      by: ["job"],
      where: { startedAt: { gte: start, lt: end } },
      _sum: { costUsd: true },
      _count: { _all: true },
    }),
    prisma.studioUsage.findMany({
      where: { day, subject: { startsWith: "ip:" } },
      select: { costUsd: true, count: true },
    }),
    prisma.jobRun.aggregate({
      where: { startedAt: { gte: utcStart, lt: utcEnd }, job: { not: "pipeline" } },
      _sum: { costUsd: true },
    }),
  ]);

  const steps: StepCost[] = jobs
    // pipeline нь бүрхүүл — алхмуудын зардлыг давхар тоолохгүй
    .filter((j) => j.job !== "pipeline")
    .map((j) => ({
      job: j.job,
      label: stepLabel(j.job),
      usd: num(j._sum.costUsd),
      runs: j._count._all,
      llm: LLM_STEPS.has(j.job),
    }));

  const studioUsd = studio.reduce((n, r) => n + num(r.costUsd), 0);
  const studioRuns = studio.reduce((n, r) => n + r.count, 0);
  if (studioUsd > 0 || studioRuns > 0) {
    steps.push({ job: "studio", label: stepLabel("studio"), usd: studioUsd, runs: studioRuns, llm: true });
  }

  return {
    day,
    total: steps.reduce((n, s) => n + s.usd, 0),
    // ЗӨВХӨН JobRun: түүнд бодит цагийн тэмдэг байдаг тул UTC өдрөөр яг
    // тоологдоно. `StudioUsage` нь зөвхөн УБ огнооны мөртэй (цагийн тэмдэггүй)
    // тул UTC өдөрт хуваарилах боломжгүй — харьцуулалтаас гадуур үлдэнэ.
    utcTotal: num(utcJobs._sum.costUsd),
    capped: cappedTotal(steps),
    steps: sortSteps(steps),
  };
}

/** Сүүлийн N өдрийн задаргаа — /admin дээр харьцуулахад */
export async function recentCosts(days = 2, now = new Date()): Promise<DayCost[]> {
  const out: DayCost[] = [];
  for (let i = 0; i < days; i++) {
    out.push(await dayCost(new Date(now.getTime() - i * 86_400_000)));
  }
  return out;
}

/**
 * Өнөөдөр ӨДРИЙН ХЯЗГААРТ тооцогдох зардал — pipeline-ийн шалгалтад.
 * Бенчмарк энд ОРОХГҮЙ (өөрийн төсөв, үлдэгдлийн шалгалттай).
 */
export async function spentTodayUsd(now = new Date()): Promise<number> {
  return (await dayCost(now)).capped;
}
