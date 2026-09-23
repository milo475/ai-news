/**
 * Улаанбаатарын өдөр — квот, өдөрт нэг удаа ажиллах шалгалтуудад.
 *
 * Монгол зуны цагтай биш тул офсет тогтмол UTC+8. Өдрийн хил нь UTC-ээр
 * өмнөх өдрийн 16:00 — жишээ нь УБ-ийн 2026-09-23 = UTC 2026-09-22T16:00 … 2026-09-23T16:00.
 */

/** УБ = UTC+8, зуны цаггүй */
export const UB_OFFSET_MS = 8 * 3_600_000;

const DAY_MS = 86_400_000;

/** Тухайн агшин аль УБ өдөрт байгаа вэ — тэр өдрийн эхлэл/төгсгөл (UTC-ээр) */
export function ubDayRange(now: Date): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + UB_OFFSET_MS);
  const midnightUb = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const start = new Date(midnightUb - UB_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** "2026-09-23" — УБ цагаар */
export function ubDateLabel(d: Date): string {
  return new Date(d.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Хоёр агшин УБ цагаар нэг өдөрт багтаж байна уу */
export function sameUbDay(a: Date, b: Date): boolean {
  return ubDateLabel(a) === ubDateLabel(b);
}
