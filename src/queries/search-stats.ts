/**
 * /admin-ийн хайлтын статистик. Umami-гаас хамааралгүй — SearchLog хүснэгтээс уншина
 * (Umami унтарсан ч, хэрэглэгч tracker-ийг блоклосон ч энэ тоо бүрэн байна).
 */
import { prisma } from "../db";

export interface SearchStatRow {
  q: string;
  count: number;
  lastAt: Date;
}

const DAYS = 7;
const LIMIT = 20;

/**
 * Сүүлийн 7 хоногийн хамгийн их хайсан үгс. Том/жижиг үсэг, зайг нэгтгэнэ.
 * Тэмдэглэл: dropdown нь бичих бүрт хайдаг тул урт үгийн эхний хэсгүүд ч тусад нь бүртгэгдэнэ.
 */
export function topSearches(): Promise<SearchStatRow[]> {
  return prisma.$queryRaw<SearchStatRow[]>`
    SELECT lower(btrim("q")) AS q, count(*)::int AS count, max("createdAt") AS "lastAt"
    FROM "SearchLog"
    WHERE "createdAt" >= now() - make_interval(days => ${DAYS})
    GROUP BY 1
    ORDER BY count DESC, "lastAt" DESC
    LIMIT ${LIMIT}
  `;
}

/** Үр дүн гараагүй хайлтууд — контент дутуу байгаа газрыг заана */
export function emptySearches(): Promise<SearchStatRow[]> {
  return prisma.$queryRaw<SearchStatRow[]>`
    SELECT lower(btrim("q")) AS q, count(*)::int AS count, max("createdAt") AS "lastAt"
    FROM "SearchLog"
    WHERE "createdAt" >= now() - make_interval(days => ${DAYS}) AND "resultCount" = 0
    GROUP BY 1
    ORDER BY count DESC, "lastAt" DESC
    LIMIT ${LIMIT}
  `;
}
