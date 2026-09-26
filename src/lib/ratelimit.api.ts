/**
 * Энгийн хугацааны цонхтой хязгаарлагч (fixed window) — цэвэр логик, тесттэй.
 *
 * Санах ойд хадгална: Railway дээр вэб нэг процесс тул хангалттай бөгөөд
 * Redis нэмэх шаардлагагүй. Олон instance болох үед хязгаар нь instance тус бүрт
 * хамаарна — хэт олон хүсэлтээс хамгаалах зорилгодоо мөн нийцнэ.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Цонхонд үлдсэн хүсэлтийн тоо */
  remaining: number;
  /** Цонх дуусах хугацаа (ms, epoch) */
  resetAt: number;
  /** Хэдэн секундын дараа дахин оролдохыг зөвлөх (зөвхөн ok=false үед) */
  retryAfter: number;
}

export interface LimiterOptions {
  /** Цонх дахь дээд хүсэлт */
  limit: number;
  /** Цонхны урт (ms) */
  windowMs: number;
  /** Санах ойд байлгах түлхүүрийн дээд тоо — санах ой хамгаалах */
  max?: number;
  now?: () => number;
}

export interface Limiter {
  check(key: string): RateLimitResult;
  reset(): void;
  size(): number;
}

export function createLimiter(o: LimiterOptions): Limiter {
  const now = o.now ?? Date.now;
  const max = o.max ?? 10_000;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      let e = hits.get(key);

      if (!e || e.resetAt <= t) {
        e = { count: 0, resetAt: t + o.windowMs };
        hits.set(key, e);
      }
      e.count += 1;

      // Дууссан цонхнуудыг үе үе цэвэрлэнэ — Map хязгааргүй өсөхгүй
      if (hits.size > max) {
        for (const [k, v] of hits) {
          if (v.resetAt <= t) hits.delete(k);
          if (hits.size <= max) break;
        }
      }

      const ok = e.count <= o.limit;
      return {
        ok,
        remaining: Math.max(0, o.limit - e.count),
        resetAt: e.resetAt,
        retryAfter: ok ? 0 : Math.max(1, Math.ceil((e.resetAt - t) / 1000)),
      };
    },
    reset() {
      hits.clear();
    },
    size() {
      return hits.size;
    },
  };
}

/**
 * Хүсэлтийн IP. Railway нь proxy-ийн ард байдаг тул x-forwarded-for-ийн ЭХНИЙ
 * утгыг (жинхэнэ клиент) авна.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Хариунд тавих стандарт header-ууд */
export function rateLimitHeaders(limit: number, r: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(limit),
    "RateLimit-Remaining": String(r.remaining),
    "RateLimit-Reset": String(Math.ceil((r.resetAt - Date.now()) / 1000)),
    ...(r.ok ? {} : { "Retry-After": String(r.retryAfter) }),
  };
}
