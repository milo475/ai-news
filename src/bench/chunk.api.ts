/**
 * Бенчмаркийг хэсэгчлэн ажиллуулах — cron-ыг блоклохгүй байх цэвэр логик.
 *
 * Асуудал: 17 модель × 30 даалгавар + шүүгч ≈ 1080 дуудлага, дараалан ажиллахад
 * ~2 цаг үргэлжилнэ (хэмжсэн: даалгавар ~8.0с, шүүгч ~5с, concurrency байхгүй).
 * Railway-ийн cron нь өмнөх run дуусаагүй бол дараагийнхыг алгасдаг тул 10/1-ний
 * 03:00-д эхэлсэн bench нь 07:30-ын НИЙТЛЭХ slot-ыг залгих эрсдэлтэй.
 *
 * Шийдэл: нэг cron run-д 20 минут л ажиллаад хийсэн хэсгээ хадгалж гарна.
 * Дараагийн prepare run дутуу даалгавраас үргэлжилнэ.
 */

/** Нэг cron run-д бенчмаркт олгох дээд хугацаа */
export const CHUNK_MS = 20 * 60_000;

/** НИЙТЛЭХ цонхны өмнө шинэ хэсэг эхлүүлэхгүй хугацаа */
export const PUBLISH_GUARD_MS = 45 * 60_000;

/** Энэ хугацаанд дуусаагүй run FAILED болно */
export const MAX_RUN_DAYS = 3;

/** Хугацаа дуусахад хэсгийг зогсооно */
export function outOfTime(chunkStart: Date, now: Date, chunkMs = CHUNK_MS): boolean {
  return now.getTime() - chunkStart.getTime() >= chunkMs;
}

/** Хэсэгт үлдсэн хугацаа, миллисекундээр */
export function timeLeft(chunkStart: Date, now: Date, chunkMs = CHUNK_MS): number {
  return Math.max(0, chunkMs - (now.getTime() - chunkStart.getTime()));
}

/**
 * НИЙТЛЭХ цонх ойртсон эсэх.
 *
 * `minutesToPublish` нь `nextPublishAt(now).minutes`. Цонхны 45 минутын дотор
 * шинэ хэсэг эхлүүлбэл 20 минутын ажил нь slot-той мөргөлдөж болзошгүй.
 */
export function nearPublishWindow(minutesToPublish: number, guardMs = PUBLISH_GUARD_MS): boolean {
  return minutesToPublish * 60_000 < guardMs;
}

/** Run хэт удсан эсэх — 3 хоног дуусаагүй бол орхино */
export function isStale(startedAt: Date, now: Date, days = MAX_RUN_DAYS): boolean {
  return now.getTime() - startedAt.getTime() > days * 86_400_000;
}

// ---------- Дутуу даалгаврууд ----------

/** `BenchResult`-ийн (модель, даалгавар) түлхүүр */
export function pairKey(modelSlug: string, taskId: string): string {
  return `${modelSlug}\u0000${taskId}`;
}

export interface Pair {
  modelSlug: string;
  taskId: string;
}

/**
 * Хийгдээгүй (модель, даалгавар) хосууд.
 *
 * Дараалал нь МОДЕЛИОР — нэг моделийг дуусгаад дараагийнх руу шилжинэ.
 * Ингэснээр run дундуур тасарсан ч бүтэн хэмжигдсэн модель олон байна.
 */
export function pendingPairs(models: string[], taskIds: string[], done: Set<string>): Pair[] {
  const out: Pair[] = [];
  for (const modelSlug of models) {
    for (const taskId of taskIds) {
      if (!done.has(pairKey(modelSlug, taskId))) out.push({ modelSlug, taskId });
    }
  }
  return out;
}

export interface Progress {
  total: number;
  done: number;
  left: number;
  percent: number;
}

export function progressOf(total: number, done: number): Progress {
  const left = Math.max(0, total - done);
  return { total, done, left, percent: total > 0 ? Math.round((done / total) * 100) : 100 };
}

export function progressLabel(p: Progress): string {
  return `${p.done}/${p.total} (${p.percent}%), үлдсэн ${p.left}`;
}

// ---------- Хэсэг эхлүүлж болох уу ----------

export type ChunkBlock = "publish-window" | "stale" | "balance" | null;

export interface ChunkGate {
  /** Эхлүүлж болох эсэх */
  go: boolean;
  block: ChunkBlock;
  reason: string;
}

/**
 * Шинэ хэсэг эхлүүлэх шийдвэр.
 *
 * Дараалал чухал: хуучирсан run-ыг эхлээд илрүүлнэ (тэр нь FAILED болох ёстой),
 * дараа нь нийтлэх цонх, эцэст нь үлдэгдэл.
 */
export function canStartChunk(a: {
  runStartedAt: Date | null;
  now: Date;
  minutesToPublish: number;
  balanceUsd: number | null;
  needUsd: number;
}): ChunkGate {
  if (a.runStartedAt && isStale(a.runStartedAt, a.now)) {
    return { go: false, block: "stale", reason: `${MAX_RUN_DAYS} хоногт дуусаагүй — run орхигдоно` };
  }
  if (nearPublishWindow(a.minutesToPublish)) {
    return {
      go: false,
      block: "publish-window",
      reason: `НИЙТЛЭХ цонх ${a.minutesToPublish} минутын дараа — шинэ хэсэг эхлүүлэхгүй`,
    };
  }
  if (a.balanceUsd !== null && a.balanceUsd < a.needUsd) {
    return {
      go: false,
      block: "balance",
      reason: `үлдэгдэл $${a.balanceUsd.toFixed(2)} < шаардлага $${a.needUsd.toFixed(2)}`,
    };
  }
  return { go: true, block: null, reason: "" };
}
