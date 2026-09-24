/**
 * Pipeline-ийн горим — цэвэр логик (DB-гүй, тесттэй).
 *
 * Cron цаг бүр ажиллана (`0 * * * *` UTC), код нь УБ цагаар горимоо сонгоно:
 *
 *   НИЙТЛЭХ (publish)  — УБ 07:00, 15:00, 19:00: бэлэн нийтлэлийг сайтад гаргаж FB-д постлоно.
 *                        RSS, үнэлгээ хийхгүй тул нэг минутын дотор дуусна.
 *   БЭЛТГЭХ (prepare)  — бусад бүх цагт: мэдээ татах, үнэлэх, дараагийн slot-д зориулж
 *                        текст/зураг бэлдэх, өдөрт нэг удаагийн ажлууд.
 */
import { UB_OFFSET_MS } from "./day";

export type Mode = "publish" | "prepare";

/** Анхдагч нийтлэх цагууд (УБ) */
export const DEFAULT_PUBLISH_HOURS = [7, 15, 19];

/** Өдөрт нэг удаагийн алхмууд эндээс хойш ажиллана (УБ цаг) */
export const DEFAULT_DAILY_HOUR = 3;

function ubHour(now: Date): number {
  return new Date(now.getTime() + UB_OFFSET_MS).getUTCHours();
}

/** PUBLISH_HOURS_UB="7,15,19" — буруу/хоосон бол анхдагч */
export function publishHours(env: Record<string, string | undefined> = process.env): number[] {
  const raw = env.PUBLISH_HOURS_UB?.trim();
  if (!raw) return DEFAULT_PUBLISH_HOURS;
  const hours = [...new Set(
    raw.split(",").map((h) => Number(h.trim())).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23),
  )].sort((a, b) => a - b);
  return hours.length > 0 ? hours : DEFAULT_PUBLISH_HOURS;
}

/** DAILY_HOUR_UB — өдөрт нэг удаагийн алхмуудын эхлэх цаг */
export function dailyHour(env: Record<string, string | undefined> = process.env): number {
  const raw = env.DAILY_HOUR_UB?.trim();
  if (!raw) return DEFAULT_DAILY_HOUR;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : DEFAULT_DAILY_HOUR;
}

/** Тухайн агшинд аль горим ажиллах вэ */
export function modeFor(now: Date, hours = DEFAULT_PUBLISH_HOURS): Mode {
  return hours.includes(ubHour(now)) ? "publish" : "prepare";
}

export interface NextPublish {
  /** УБ цагийн цаг (0–23) */
  hour: number;
  /** Хэзээ болох вэ (UTC) */
  at: Date;
  /** Хэдэн минутын дараа */
  minutes: number;
}

/** Дараагийн нийтлэх цаг — /admin дээр «Дараагийн нийтлэх: 15:00 (2ц 10м)» гэж харуулна */
export function nextPublishAt(now: Date, hours = DEFAULT_PUBLISH_HOURS): NextPublish {
  const ub = new Date(now.getTime() + UB_OFFSET_MS);
  const sorted = [...hours].sort((a, b) => a - b);
  const hour = sorted.find((h) => h > ub.getUTCHours()) ?? sorted[0]!;
  const dayShift = sorted.some((h) => h > ub.getUTCHours()) ? 0 : 1;

  const atUb = Date.UTC(
    ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate() + dayShift, hour, 0, 0, 0,
  );
  const at = new Date(atUb - UB_OFFSET_MS);
  return { hour, at, minutes: Math.max(0, Math.round((at.getTime() - now.getTime()) / 60_000)) };
}

/** "2ц 10м" / "45м" */
export function humanDelay(minutes: number): string {
  if (minutes < 60) return `${minutes}м`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}ц` : `${h}ц ${m}м`;
}

/** "15:00" */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
