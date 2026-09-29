/**
 * JobRun-д зардлыг АВТОМАТААР бичих бүрхүүл.
 *
 * `llm.ts` дуудлага бүрийг төв бүртгэлд нэмдэг тул алхам нь зөвхөн «эхлэхэд
 * тэмдэг авч, дуусахад зөрүүг бичнэ». УНАСАН үед ч зардал бичигдэнэ — 2026-09-28-нд
 * бенчмарк унаад 195 дуудлагын зардал бүхэлдээ алдагдсан.
 */
import { prisma } from "../db";
import { jobRunMeta } from "./meta";
import { mark, spentSince } from "../lib/spend";
import type { Ledger } from "../lib/spend.api";

export interface TrackedRun {
  id: string;
  /** Энэ ажлын одоо хүртэлх зарцуулалт */
  spent: () => Ledger;
}

/** JobRun үүсгээд зардлын тэмдэг тавина */
export async function startJob(job: string): Promise<TrackedRun> {
  const run = await prisma.jobRun.create({ data: { job, ...jobRunMeta() } });
  const m = mark();
  return { id: run.id, spent: () => spentSince(m) };
}

type JobData = Parameters<typeof prisma.jobRun.update>[0]["data"];

/**
 * JobRun-ыг хаана. `costUsd` -г өгөөгүй бол төв бүртгэлээс автоматаар бичнэ.
 * Бүртгэл өөрөө унах нь ажлыг унагаах ёсгүй.
 */
export async function finishJob(
  run: TrackedRun,
  data: JobData & { ok: boolean },
): Promise<void> {
  const spent = run.spent();
  try {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        // Дуудагч тусгайлан өгөөгүй бол төв бүртгэлийнхийг
        costUsd: spent.usd,
        ...data,
      },
    });
  } catch (e) {
    console.warn(`  ⚠ JobRun бичигдсэнгүй: ${(e as Error).message.slice(0, 120)}`);
  }
}

/**
 * Ажлыг бүрхээд JobRun-ыг ҮРГЭЛЖ хаана — амжилттай ч, унасан ч.
 *
 * Унасан үед зардал нь төв бүртгэлээс бичигдэнэ.
 */
export async function withJob<T>(
  job: string,
  fn: (run: TrackedRun) => Promise<T>,
  opts: { onFinish?: (r: T, run: TrackedRun) => JobData } = {},
): Promise<T> {
  const run = await startJob(job);
  try {
    const out = await fn(run);
    await finishJob(run, { ...(opts.onFinish?.(out, run) ?? {}), ok: true });
    return out;
  } catch (e) {
    await finishJob(run, { ok: false, error: String(e).slice(0, 1000) });
    throw e;
  }
}
