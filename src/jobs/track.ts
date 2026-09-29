/**
 * JobRun-д зардлыг АВТОМАТААР бичих бүрхүүл.
 *
 * `llm.ts` дуудлага бүрийг төв бүртгэлд нэмдэг тул алхам нь зөвхөн «эхлэхэд
 * тэмдэг авч, дуусахад зөрүүг бичнэ». УНАСАН үед ч зардал бичигдэнэ — 2026-09-28-нд
 * бенчмарк унаад 195 дуудлагын зардал бүхэлдээ алдагдсан.
 */
import { prisma } from "../db";
import { jobRunMeta } from "./meta";
import { withScope } from "../lib/spend";
import { emptyLedger, type Ledger } from "../lib/spend.api";

export interface TrackedRun {
  id: string;
  /** Энэ ажлын одоо хүртэлх зарцуулалт */
  spent: () => Ledger;
}

/**
 * JobRun үүсгэнэ. Зардал нь `withJob`-ийн хүрээнээс л бүртгэгдэнэ — энэ
 * функцийг дангаар нь ашиглавал зардал тоологдохгүй тул `withJob`-ийг сонго.
 */
export async function startJob(job: string): Promise<TrackedRun> {
  const run = await prisma.jobRun.create({ data: { job, ...jobRunMeta() } });
  return { id: run.id, spent: () => emptyLedger() };
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
  return withScope(async (spent) => {
    const created = await prisma.jobRun.create({ data: { job, ...jobRunMeta() } });
    const run: TrackedRun = { id: created.id, spent };
    try {
      const out = await fn(run);
      // `onFinish` нь `ok`-ийг дарж болно: амжилттай буцсан ч үр дүн нь
      // «амжилтгүй» гэж хэлж болно (жишээ нь bench нь FAILED төлөвтэй буцдаг)
      const extra = opts.onFinish?.(out, run) ?? {};
      await finishJob(run, { ok: true, ...extra } as JobData & { ok: boolean });
      return out;
    } catch (e) {
      await finishJob(run, { ok: false, error: String(e).slice(0, 1000) });
      throw e;
    }
  });
}
