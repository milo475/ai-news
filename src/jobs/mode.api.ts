/**
 * Pipeline-ийн горим — цэвэр логик (DB-гүй, тесттэй).
 *
 * Cron нь **хагас цаг тутам** ажиллана (`0,30 * * * *` UTC), код нь УБ цагаар горимоо сонгоно:
 *
 *   НИЙТЛЭХ (publish)  — УБ 07:30, 12:30, 19:30: бэлэн нийтлэлийг сайтад гаргаж FB-д постлоно.
 *                        RSS, үнэлгээ хийхгүй тул нэг минутын дотор дуусна.
 *   БЭЛТГЭХ (prepare)  — бусад бүх үед: мэдээ татах, үнэлэх, дараагийн slot-д зориулж
 *                        текст/зураг бэлдэх, өдөрт нэг удаагийн ажлууд.
 *
 * Цаг нь **минуттай** — УБ-ын идэвхтэй цагт тааруулсан: ажилдаа явах (07:30),
 * үдийн цай (12:30), орой гэртээ (19:30). Cron яг тэр минутад ажиллахгүй байж
 * болзошгүй тул 30 минутын цонхоор шийднэ.
 */
import { UB_OFFSET_MS } from "./day";

export type Mode = "publish" | "prepare";

export interface PublishTime {
  /** УБ цагийн цаг, 0–23 */
  hour: number;
  /** Минут, 0–59 */
  minute: number;
}

/** Анхдагч нийтлэх цагууд (УБ) */
export const DEFAULT_PUBLISH_TIMES: PublishTime[] = [
  { hour: 7, minute: 30 },
  { hour: 12, minute: 30 },
  { hour: 19, minute: 30 },
];

/** Cron-ийн ажиллах интервал — цонхны урт (минут) */
export const SLOT_WINDOW_MIN = 30;

/** Өдөрт нэг удаагийн алхмууд эндээс хойш ажиллана (УБ цаг) */
export const DEFAULT_DAILY_HOUR = 3;

function ubHour(now: Date): number {
  return new Date(now.getTime() + UB_OFFSET_MS).getUTCHours();
}

function ubMinute(now: Date): number {
  return new Date(now.getTime() + UB_OFFSET_MS).getUTCMinutes();
}

function sortTimes(times: PublishTime[]): PublishTime[] {
  const seen = new Set<string>();
  return times
    .filter((t) => {
      const key = `${t.hour}:${t.minute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

/** "7:30,12:30,19:30" эсвэл "7,15,19" (минутгүй = :00) */
export function parseTimes(raw: string): PublishTime[] {
  const out: PublishTime[] = [];
  for (const part of raw.split(",")) {
    const text = part.trim();
    if (!text) continue;
    const [h, m = "0"] = text.split(":");
    const hour = Number(h);
    const minute = Number(m);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) continue;
    out.push({ hour, minute });
  }
  return sortTimes(out);
}

/**
 * Нийтлэх цагууд.
 *
 * `PUBLISH_TIMES_UB` (минуттай) нь давуу; байхгүй бол хуучин `PUBLISH_HOURS_UB`
 * (зөвхөн цаг) — ингэснээр аль хэдийн тохируулсан deploy өөрөө өөрчлөгдөхгүй.
 */
export function publishTimes(env: Record<string, string | undefined> = process.env): PublishTime[] {
  const times = parseTimes(env.PUBLISH_TIMES_UB?.trim() ?? "");
  if (times.length > 0) return times;
  const legacy = parseTimes(env.PUBLISH_HOURS_UB?.trim() ?? "");
  if (legacy.length > 0) return legacy;
  return DEFAULT_PUBLISH_TIMES;
}

/** DAILY_HOUR_UB — өдөрт нэг удаагийн алхмуудын эхлэх цаг */
export function dailyHour(env: Record<string, string | undefined> = process.env): number {
  const raw = env.DAILY_HOUR_UB?.trim();
  if (!raw) return DEFAULT_DAILY_HOUR;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : DEFAULT_DAILY_HOUR;
}

/** Хоёр цаг нэг 30 минутын цонхонд байна уу */
function sameWindow(a: PublishTime, b: PublishTime): boolean {
  return (
    a.hour === b.hour &&
    Math.floor(a.minute / SLOT_WINDOW_MIN) === Math.floor(b.minute / SLOT_WINDOW_MIN)
  );
}

/** Тухайн агшин нийтлэх цонхонд байна уу — байвал тэр цагийг буцаана */
export function timeSlotAt(now: Date, times = DEFAULT_PUBLISH_TIMES): PublishTime | null {
  const at = { hour: ubHour(now), minute: ubMinute(now) };
  return times.find((t) => sameWindow(t, at)) ?? null;
}

/** Тухайн агшинд аль горим ажиллах вэ */
export function modeFor(now: Date, times = DEFAULT_PUBLISH_TIMES): Mode {
  return timeSlotAt(now, times) ? "publish" : "prepare";
}

export interface NextPublish {
  /** УБ цагаар хэзээ */
  time: PublishTime;
  /** Хэзээ болох вэ (UTC) */
  at: Date;
  /** Хэдэн минутын дараа */
  minutes: number;
}

/** Дараагийн нийтлэх цаг — /admin дээр «Дараагийн нийтлэх: 12:30 (2ц 10м)» гэж харуулна */
export function nextPublishAt(now: Date, times = DEFAULT_PUBLISH_TIMES): NextPublish {
  const ub = new Date(now.getTime() + UB_OFFSET_MS);
  const sorted = sortTimes(times);
  const nowMin = ub.getUTCHours() * 60 + ub.getUTCMinutes();

  const time = sorted.find((t) => t.hour * 60 + t.minute > nowMin) ?? sorted[0]!;
  const dayShift = sorted.some((t) => t.hour * 60 + t.minute > nowMin) ? 0 : 1;

  const atUb = Date.UTC(
    ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate() + dayShift,
    time.hour, time.minute, 0, 0,
  );
  const at = new Date(atUb - UB_OFFSET_MS);
  return { time, at, minutes: Math.max(0, Math.round((at.getTime() - now.getTime()) / 60_000)) };
}

/** "2ц 10м" / "45м" */
export function humanDelay(minutes: number): string {
  if (minutes < 60) return `${minutes}м`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}ц` : `${h}ц ${m}м`;
}

/** "12:30" */
export function timeLabel(t: PublishTime): string {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}
