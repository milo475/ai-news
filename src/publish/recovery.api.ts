/**
 * Алдагдсан НИЙТЛЭХ slot-ыг нөхөх.
 *
 * Slot-ын цонх ердөө 30 минут: cron нь deploy, өмнөх run дуусаагүй, эсвэл
 * Railway-ийн түр саатлаас болж яг тэр цонхонд ажиллахгүй өнгөрвөл тэр slot
 * БҮРМӨСӨН алдагдана (дараагийн run нь «prepare» горимд орно).
 *
 * Шийдэл: slot эхэлснээс хойш 90 минутын дотор ажилласан run нь тэр slot-ыг
 * нөхөж нийтэлнэ. Давхар нийтлэхээс сэргийлж УБ огноо + slot-ын түлхүүрээр
 * idempotent байна: тэр цонхонд нийтлэл гарсан бол дахин нийтлэхгүй.
 */
import { UB_OFFSET_MS } from "../jobs/day";
import type { PublishTime } from "../jobs/mode.api";

/** Slot эхэлснээс хойш хэдэн минутын дотор нөхөж болох вэ */
export const RECOVERY_MIN = 90;

export interface SlotWindow {
  time: PublishTime;
  /** Slot эхлэх агшин (UTC) */
  start: Date;
  /** Нөхөх боломжит эцсийн агшин */
  deadline: Date;
  /** УБ огноо + цаг — давхардлаас хамгаалах түлхүүр */
  key: string;
}

function ubParts(d: Date) {
  const ub = new Date(d.getTime() + UB_OFFSET_MS);
  return {
    y: ub.getUTCFullYear(), m: ub.getUTCMonth(), day: ub.getUTCDate(),
    minutes: ub.getUTCHours() * 60 + ub.getUTCMinutes(),
  };
}

export function slotKey(time: PublishTime, now: Date): string {
  const { y, m, day } = ubParts(now);
  const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return `${date}-${String(time.hour).padStart(2, "0")}${String(time.minute).padStart(2, "0")}`;
}

/** Өнөөдөр (УБ) аль хэдийн эхэлсэн slot-уудын цонх */
export function todaysWindows(now: Date, times: PublishTime[], recoveryMin = RECOVERY_MIN): SlotWindow[] {
  const { y, m, day, minutes } = ubParts(now);
  return times
    .filter((t) => t.hour * 60 + t.minute <= minutes)
    .map((time) => {
      const start = new Date(Date.UTC(y, m, day, time.hour, time.minute) - UB_OFFSET_MS);
      return {
        time,
        start,
        deadline: new Date(start.getTime() + recoveryMin * 60_000),
        key: slotKey(time, now),
      };
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export interface MissedSlot extends SlotWindow {
  /** Slot эхэлснээс хойш хэдэн минут өнгөрсөн */
  lateMin: number;
}

/**
 * Нөхөх шаардлагатай slot.
 *
 * · Зөвхөн ӨНӨӨДРИЙН, аль хэдийн эхэлсэн slot-уудыг харна.
 * · Тэр slot-ын цонхонд нийтлэл гарсан бол нөхөхгүй (idempotent).
 * · 90 минут хэтэрсэн slot-ыг орхино — хэт хоцорсон мэдээ нийтлэхгүй.
 * · Хамгийн сүүлийн алдагдсаныг л буцаана: хоёр slot зэрэг нөхвөл өдрийн квот
 *   нэг дор дүүрч, дараагийн slot хоосон үлдэнэ.
 */
export function missedSlot(a: {
  now: Date;
  times: PublishTime[];
  /** Өнөөдөр нийтлэгдсэн мэдээнүүдийн цаг */
  publishedAt: Date[];
  recoveryMin?: number;
}): MissedSlot | null {
  const windows = todaysWindows(a.now, a.times, a.recoveryMin ?? RECOVERY_MIN);

  for (const w of windows) {
    const late = a.now.getTime() - w.start.getTime();
    // Цонх хэтэрсэн — энэ ба түүнээс өмнөх slot-уудыг орхино
    if (a.now > w.deadline) return null;
    // Тэр цонхонд нийтлэл гарсан уу
    const covered = a.publishedAt.some(
      (p) => p.getTime() >= w.start.getTime() && p.getTime() <= w.deadline.getTime(),
    );
    if (covered) return null;
    return { ...w, lateMin: Math.round(late / 60_000) };
  }
  return null;
}
