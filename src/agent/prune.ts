/**
 * Хоцрогдсон RAW нийтлэлүүдийг үнэлэлгүй SKIPPED болгоно.
 *
 *   npm run raw:prune              # 7 хоногоос хуучин RAW-уудыг цэвэрлэнэ
 *   npm run raw:prune -- --days 3  # өөр хугацаагаар
 *   npm run raw:prune -- --dry     # зөвхөн тоог харах
 *
 * Яагаад: RSS-ээс өдөрт хэдэн зуун item ирдэг ч agent нэг run-д 30-г л боловсруулдаг.
 * Хуримтлагдсан хуучин RAW нь дараалал эзэлж, шинэ мэдээ хойшилдог. Хуучирсан мэдээг
 * нийтлэх ч утгагүй тул LLM дуудалгүй алгасна (REJECTED биш — үнэлээгүй гэдгийг ялгахын тулд).
 *
 * agent алхам мөн ажиллах бүрдээ үүнийг дууддаг.
 */
import "dotenv/config";
import { prisma } from "../db";
import { staleBefore, STALE_RAW_DAYS } from "./raw.api";

export interface PruneResult {
  /** Хоцрогдсон гэж үзсэн хил */
  before: Date;
  /** SKIPPED болсон тоо */
  skipped: number;
}

/**
 * Хилээс хуучин RAW-уудыг SKIPPED болгоно.
 * Огноо нь эх сурвалж дээрээ байхгүй бол татсан огноог (createdAt) харна.
 */
export async function pruneStaleRaw(
  opts: { days?: number; now?: Date; dryRun?: boolean } = {},
): Promise<PruneResult> {
  const before = staleBefore(opts.now ?? new Date(), opts.days ?? STALE_RAW_DAYS);
  const where = {
    status: "RAW" as const,
    OR: [
      { publishedAtSource: { lt: before } },
      { publishedAtSource: null, createdAt: { lt: before } },
    ],
  };

  if (opts.dryRun) {
    return { before, skipped: await prisma.article.count({ where }) };
  }
  const { count } = await prisma.article.updateMany({ where, data: { status: "SKIPPED" } });
  return { before, skipped: count };
}

if (process.argv[1]?.endsWith("prune.ts")) {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : STALE_RAW_DAYS;
  const dryRun = process.argv.includes("--dry");

  const r = await pruneStaleRaw({ days, dryRun });
  console.log(
    `${dryRun ? "[dry] " : ""}${r.skipped} хоцрогдсон RAW ${dryRun ? "олдлоо" : "SKIPPED боллоо"} ` +
      `(${days} хоногоос хуучин, хил ${r.before.toISOString().slice(0, 10)}).`,
  );
  await prisma.$disconnect();
}
