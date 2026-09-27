/**
 * FB/IG постын хүрэлтийг Graph API-аас татна — постлосноос 24 цагийн дараа.
 *
 *   npx tsx src/publish/insights.ts            # хүлээгдэж байгаа постуудыг шинэчилнэ
 *   npx tsx src/publish/insights.ts --all      # хугацаа хамаарахгүй, бүгдийг (7 хоногт)
 *
 * Токен байхгүй бол чимээгүй алгасна. Graph-ийн лимитийг хайрлаж нэг run-д 25 пост.
 *
 * Яагаад 24 цаг: тоо тэр үед тогтворжсон байдаг бөгөөд пост тус бүрийг нэг л удаа
 * асуудаг тул лимит дүүрэхгүй.
 */
import "dotenv/config";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { isEntry, runCli } from "../lib/cli";
import { igUserId } from "./instagram.api";
import {
  buildReport, INSIGHTS_BATCH, INSIGHTS_DELAY_HOURS, insightsDue, parseFbStats, parseIgStats,
  REPORT_DAYS, type GraphEngagement, type GraphInsights, type PostRow, type Report,
} from "./insights.api";

const GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 15_000;

export interface SyncResult {
  checked: number;
  fbUpdated: number;
  igUpdated: number;
  failed: number;
  skipped: string | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** FB постын хүрэлт + хариу үзүүлэлт */
export async function fetchFbStats(postId: string, token: string) {
  const t = encodeURIComponent(token);
  const [insights, engagement] = await Promise.all([
    getJson<GraphInsights>(`${GRAPH}/${postId}/insights?metric=post_impressions_unique&access_token=${t}`),
    getJson<GraphEngagement>(
      `${GRAPH}/${postId}?fields=reactions.summary(true),shares,comments.summary(true)&access_token=${t}`,
    ),
  ]);
  return parseFbStats(insights, engagement);
}

/** IG media insights */
export async function fetchIgStats(mediaId: string, token: string) {
  const t = encodeURIComponent(token);
  const json = await getJson<GraphInsights>(
    `${GRAPH}/${mediaId}/insights?metric=reach,likes,comments&access_token=${t}`,
  );
  return parseIgStats(json);
}

export async function syncInsights(
  opts: { now?: Date; all?: boolean } = {},
): Promise<SyncResult> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const r: SyncResult = { checked: 0, fbUpdated: 0, igUpdated: 0, failed: 0, skipped: null };
  if (!token) {
    r.skipped = "FB_PAGE_ACCESS_TOKEN тохируулаагүй";
    return r;
  }

  const now = opts.now ?? new Date();
  const job = await prisma.jobRun.create({ data: { job: "insights", ...jobRunMeta() } });

  try {
    const since = new Date(now.getTime() - REPORT_DAYS * 2 * 86_400_000);
    const posts = await prisma.article.findMany({
      where: { fbPostedAt: { gte: since, not: null } },
      orderBy: { fbPostedAt: "desc" },
      take: INSIGHTS_BATCH * 4,
      select: {
        id: true, slug: true, fbPostId: true, fbPostedAt: true, fbStatsAt: true,
        igMediaId: true, igPostedAt: true, igStatsAt: true,
      },
    });

    const due = posts
      .filter((a) =>
        opts.all ||
        insightsDue(a.fbPostedAt, a.fbStatsAt, now) ||
        insightsDue(a.igPostedAt, a.igStatsAt, now),
      )
      .slice(0, INSIGHTS_BATCH);

    for (const a of due) {
      r.checked++;
      let touched = false;

      if (a.fbPostId && (opts.all || insightsDue(a.fbPostedAt, a.fbStatsAt, now))) {
        const s = await fetchFbStats(a.fbPostId, token);
        if (s) {
          await prisma.article.update({
            where: { id: a.id },
            data: {
              ...(s.reach !== null ? { fbReach: s.reach } : {}),
              ...(s.likes !== null ? { fbLikes: s.likes } : {}),
              ...(s.shares !== null ? { fbShares: s.shares } : {}),
              ...(s.comments !== null ? { fbComments: s.comments } : {}),
              fbStatsAt: now,
            },
          });
          r.fbUpdated++;
          touched = true;
          console.log(`  FB ${a.slug}: хүрэлт ${s.reach ?? "?"}, хариу ${(s.likes ?? 0) + (s.shares ?? 0) + (s.comments ?? 0)}`);
        } else {
          r.failed++;
        }
      }

      if (a.igMediaId && igUserId() && (opts.all || insightsDue(a.igPostedAt, a.igStatsAt, now))) {
        const s = await fetchIgStats(a.igMediaId, token);
        if (s) {
          await prisma.article.update({
            where: { id: a.id },
            data: {
              ...(s.reach !== null ? { igReach: s.reach } : {}),
              ...(s.likes !== null ? { igLikes: s.likes } : {}),
              ...(s.comments !== null ? { igComments: s.comments } : {}),
              igStatsAt: now,
            },
          });
          r.igUpdated++;
          touched = true;
          console.log(`  IG ${a.slug}: хүрэлт ${s.reach ?? "?"}`);
        } else {
          r.failed++;
        }
      }

      if (!touched) r.failed++;
    }

    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        finishedAt: new Date(), ok: true,
        itemsIn: r.checked, itemsOut: r.fbUpdated + r.igUpdated,
        attempted: r.checked, failed: r.failed,
      },
    });
    return r;
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: job.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 500) },
    });
    throw e;
  }
}

/** 7 хоногийн тайлан — /admin/tarhalt */
export async function weeklyReport(
  opts: { days?: number; now?: Date; minPosts?: number } = {},
): Promise<Report & { days: number }> {
  const days = opts.days ?? REPORT_DAYS;
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - days * 86_400_000);

  const rows = await prisma.article.findMany({
    where: { fbPostedAt: { gte: since } },
    orderBy: { fbPostedAt: "desc" },
    select: {
      category: true, fbHookType: true,
      fbReach: true, fbLikes: true, fbShares: true, fbComments: true,
      igReach: true, igLikes: true, igComments: true,
    },
  });

  const mapped: PostRow[] = rows.map((a) => ({
    category: a.category,
    hookType: a.fbHookType,
    fbReach: a.fbReach, fbLikes: a.fbLikes, fbShares: a.fbShares, fbComments: a.fbComments,
    igReach: a.igReach, igLikes: a.igLikes, igComments: a.igComments,
  }));

  return { ...buildReport(mapped, opts.minPosts ?? 1), days };
}

if (isEntry("insights.ts")) {
  await runCli(async () => {
    const r = await syncInsights({ all: process.argv.includes("--all") });
    if (r.skipped) {
      console.log(`алгасав: ${r.skipped}`);
      return;
    }
    console.log(
      `${r.checked} пост шалгав — FB ${r.fbUpdated}, IG ${r.igUpdated} шинэчлэв, ${r.failed} амжилтгүй ` +
        `(${INSIGHTS_DELAY_HOURS} цагийн дараа татдаг)`,
    );
  });
}
