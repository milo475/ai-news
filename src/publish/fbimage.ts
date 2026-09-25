/**
 * Өдрийн жагсаалтын карт ба зургийн туслах функцууд.
 *
 *   npx tsx src/publish/fbimage.ts --ranking --out b.jpg
 *
 * Нийтлэлийн постын карт (гэрэл зураг + headline) нь `card.ts` дотор. Энд зөвхөн:
 *   rankingCard        — топ 5 моделийн брэндийн карт (нийтлэлтэй холбоогүй пост)
 *   imagesToday        — өдрийн зургийн квотыг тоолох
 *   recentImagePrompts — сүүлийн зургуудын prompt (дүрслэл давхардуулахгүйн тулд)
 */
import "dotenv/config";
// fonts нь FONTCONFIG_FILE тохируулдаг тул sharp-аас ӨМНӨ импортлоно
import "./fonts";
import sharp from "sharp";
import { prisma } from "../db";
import { ubDateLabel, ubDayRange } from "../jobs/day";
import { getLatestLeaderboard } from "../queries/leaderboard";
import { RECENT_SCENES } from "./card.api";
import { rankingCardSvg, type RankingRow } from "./fbimage.api";

/** УБ цагаар өнөөдөр хэдэн зураг үүсгэсэн бэ (картын өдрийн квотод) */
export async function imagesToday(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.article.count({ where: { fbImageAt: { gte: start, lt: end } } });
}

/** Сүүлийн постуудын зургийн prompt — дүрслэл давхардахгүй байх */
export async function recentImagePrompts(limit = RECENT_SCENES): Promise<string[]> {
  const rows = await prisma.article.findMany({
    where: { fbImagePrompt: { not: null } },
    orderBy: { fbImageAt: "desc" },
    take: limit,
    select: { fbImagePrompt: true },
  });
  return rows.map((r) => r.fbImagePrompt!).filter(Boolean);
}

/** Өдрийн жагсаалтын карт — топ 5, өсөлт/уналт, лого. Жагсаалт бэлэн биш бол null. */
export async function rankingCard(now = new Date()): Promise<{ buffer: Buffer } | null> {
  const { date, rows } = await getLatestLeaderboard("OPENROUTER_USAGE", 5);
  if (rows.length < 5) return null;

  const cardRows: RankingRow[] = rows.map((r) => ({
    rank: r.rank,
    name: r.model.name,
    company: r.company.name,
    rankDelta: r.rankDelta,
  }));
  const svg = rankingCardSvg(cardRows, ubDateLabel(date ?? now));
  return { buffer: await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toBuffer() };
}

if (process.argv[1]?.endsWith("fbimage.ts")) {
  const outArg = process.argv.indexOf("--out");
  const out = outArg > -1 ? process.argv[outArg + 1] : null;

  const card = await rankingCard();
  if (!card) {
    console.error("Жагсаалт бэлэн биш");
    process.exitCode = 1;
  } else {
    console.log(`жагсаалтын карт: ${(card.buffer.length / 1024).toFixed(0)} KB`);
    if (out) {
      await sharp(card.buffer).toFile(out);
      console.log(`→ ${out}`);
    }
  }
  await prisma.$disconnect();
}
