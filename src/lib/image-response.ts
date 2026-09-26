/**
 * DB дэх зургийг буцаах нийтлэг хариу — ETag + зөв кэш.
 *
 * Хаягт `?v=<timestamp>` байвал агуулга нь тэр хувилбарт үүрд хамаарна гэсэн үг тул
 * `immutable` кэш тавина (хөтөч дахин асуухгүй). Хувилбаргүй бол богино max-age +
 * ETag — хөтөч 304-өөр баталгаажуулна.
 */

/** Агуулга + сүүлд өөрчлөгдсөн хугацаанаас тогтвортой ETag */
export function etagFor(length: number, updatedAt: Date | null | undefined): string {
  return `"${length.toString(36)}-${(updatedAt?.getTime() ?? 0).toString(36)}"`;
}

/** `if-none-match` нь олон ETag-тай байж болно (таслалаар) */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header
    .split(",")
    .map((s) => s.trim().replace(/^W\//, ""))
    .includes(etag);
}

export interface ImageOptions {
  data: Uint8Array | Buffer;
  contentType: string;
  updatedAt?: Date | null;
  /** Хувилбаргүй хаягийн max-age (секунд) */
  maxAge?: number;
  /** Нэмэлт header (жишээ нь лого дээрх CSP) */
  extra?: Record<string, string>;
}

export function imageResponse(req: Request, o: ImageOptions): Response {
  // Шинэ Uint8Array — Buffer-ийн ArrayBufferLike нь BodyInit-д тохирохгүй
  const bytes = new Uint8Array(o.data);
  const etag = etagFor(bytes.length, o.updatedAt);
  const versioned = new URL(req.url).searchParams.has("v");

  const headers: Record<string, string> = {
    "Content-Type": o.contentType,
    ETag: etag,
    "Cache-Control": versioned
      ? "public, max-age=31536000, immutable"
      : `public, max-age=${o.maxAge ?? 3_600}, stale-while-revalidate=86400`,
    "Last-Modified": (o.updatedAt ?? new Date()).toUTCString(),
    ...o.extra,
  };

  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(bytes as unknown as BodyInit, {
    headers: { ...headers, "Content-Length": String(bytes.length) },
  });
}
