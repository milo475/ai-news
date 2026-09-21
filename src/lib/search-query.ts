/**
 * Хайлтын query бэлтгэх цэвэр хэсэг (DB-гүй, тесттэй).
 */

/** Үүнээс богино query-д хайхгүй */
export const MIN_QUERY = 2;

/**
 * Хэрэглэгчийн бичсэнийг tsquery болгоно: бүх үгийг AND-аар, сүүлийнг нь prefix болгоно
 * ("gem" → "gem:*" → Gemini олдоно).
 * tsquery-гийн операторуудыг (& | ! : * ( )) хасна — хэрэглэгч тэдгээрийг бичсэн ч алдаа гарахгүй.
 */
export function buildTsQuery(q: string): string {
  const words = q
    .toLowerCase()
    .replace(/[\\/]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}._-]/gu, "").replace(/^[.\-_]+|[.\-_]+$/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "";
  const last = words[words.length - 1]!;
  return [...words.slice(0, -1), `${last}:*`].join(" & ");
}
