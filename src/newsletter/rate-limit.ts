/**
 * Энгийн in-memory хязгаарлагч (нэмэлт сервисгүй).
 * Процесс дахин эхлэхэд тэглэгдэнэ — бүртгэлийн формд хангалттай.
 */
const HOUR_MS = 3_600_000;
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max = 5, windowMs = HOUR_MS, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Тестэд цэвэрлэхэд */
export function resetRateLimit(): void {
  hits.clear();
}
