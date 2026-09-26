/**
 * FB постын reaction/share-ыг Graph API-аас өдөрт нэг удаа синк.
 *
 *   npx tsx src/gallery/fb-stats.ts
 *
 * Токен, FB_PAGE_ID тохируулаагүй бол чимээгүй алгасна — галерей нь картын татсан
 * тоогоор эрэмбэлэгдэнэ.
 */
import "dotenv/config";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { parseStats, STATS_BATCH, STATS_WINDOW_DAYS, type GraphStats } from "./fb-stats.api";

const GRAPH = "https://graph.facebook.com/v21.0";

export interface SyncResult {
  checked: number;
  updated: number;
  skipped: string | null;
  failed: number;
}

async function fetchStats(postId: string, token: string): Promise<GraphStats | null> {
  try {
    const url = `${GRAPH}/${postId}?fields=reactions.summary(true),shares&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return (await res.json()) as GraphStats;
  } catch {
    return null;
  }
}

export async function syncFbStats(): Promise<SyncResult> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return { checked: 0, updated: 0, skipped: "FB_PAGE_ACCESS_TOKEN тохируулаагүй", failed: 0 };

  const job = await prisma.jobRun.create({ data: { job: "fbstats", ...jobRunMeta() } });
  const r: SyncResult = { checked: 0, updated: 0, skipped: null, failed: 0 };

  try {
    const since = new Date(Date.now() - STATS_WINDOW_DAYS * 86_400_000);
    const posts = await prisma.article.findMany({
      where: { fbPostId: { not: null }, fbPostedAt: { gte: since } },
      orderBy: { fbPostedAt: "desc" },
      take: STATS_BATCH,
      select: { id: true, fbPostId: true, slug: true },
    });

    for (const a of posts) {
      r.checked++;
      const json = await fetchStats(a.fbPostId!, token);
      const stats = json ? parseStats(json) : null;
      if (!stats) {
        r.failed++;
        continue;
      }
      await prisma.article.update({
        where: { id: a.id },
        data: { fbLikes: stats.likes, fbShares: stats.shares, fbStatsAt: new Date() },
      });
      r.updated++;
    }

    await prisma.jobRun.update({
      where: { id: job.id },
      data: { finishedAt: new Date(), ok: true, itemsIn: r.checked, itemsOut: r.updated, failed: r.failed },
    });
    return r;
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: job.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 1000) },
    });
    throw e;
  }
}

if (process.argv[1]?.endsWith("fb-stats.ts")) {
  const r = await syncFbStats();
  console.log(
    r.skipped
      ? `алгасав: ${r.skipped}`
      : `${r.checked} пост шалгав, ${r.updated} шинэчлэв, ${r.failed} амжилтгүй`,
  );
  await prisma.$disconnect();
}
