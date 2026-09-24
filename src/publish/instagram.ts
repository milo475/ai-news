/**
 * Нийтлэгдсэн мэдээг Instagram-д постлоно (FB-тэй зэрэгцээ).
 *
 *   npx tsx src/publish/instagram.ts          # дараалалд хүлээж буйг постолно
 *
 * Тохиргоо: IG_USER_ID (Instagram business account id) + FB_PAGE_ACCESS_TOKEN (ижил Page
 * token, `instagram_content_publish` эрхтэй). IG_USER_ID хоосон бол алхам алгасагдана.
 *
 * Instagram зургийг URL-аар нь татдаг тул `SITE_URL/api/fb-image/<id>` (1080×1080 JPEG,
 * нээлттэй, public cache) хаягийг өгнө — **зураггүй нийтлэл IG-д орохгүй**.
 *
 * Хоёр алхамт нийтлэлт:
 *   1. POST /{ig-user-id}/media { image_url, caption } → creation_id
 *   2. creation_id-ийн status_code FINISHED болтол 3 сек тутам шалгана (дээд тал нь 60 сек)
 *   3. POST /{ig-user-id}/media_publish { creation_id } → media id
 */
import "dotenv/config";
import { prisma } from "../db";
import { ubDayRange } from "../jobs/day";
import { jobRunMeta } from "../jobs/meta";
import { dailyPublishLimit } from "../agent/quota.api";
import {
  buildCaption, checkCaption, igUserId, MAX_IG_ATTEMPTS, publicImageUrl,
} from "./instagram.api";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Контейнер бэлтгэгдэхийг хүлээх */
const POLL_MS = 3_000;
const POLL_TIMEOUT_MS = 60_000;

type FetchLike = typeof fetch;

export interface InstagramDeps {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface GraphOut {
  id?: string;
  status_code?: string;
  error?: { message?: string };
}

async function graph(
  fetchImpl: FetchLike,
  url: string,
  body?: Record<string, string>,
): Promise<GraphOut> {
  const res = await fetchImpl(url, body ? { method: "POST", body: new URLSearchParams(body) } : {});
  const json = (await res.json()) as GraphOut;
  if (!res.ok || json.error) {
    throw new Error(`Instagram ${res.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

/** Зураг + caption-аас IG пост үүсгэнэ. Media id буцаана. */
export async function postToInstagram(
  imageUrl: string,
  caption: string,
  deps: InstagramDeps = {},
): Promise<string> {
  const userId = igUserId();
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!userId) throw new Error("IG_USER_ID тохируулаагүй байна");
  if (!token) throw new Error("FB_PAGE_ACCESS_TOKEN тохируулаагүй байна");

  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? wait;

  // 1. Контейнер
  const created = await graph(fetchImpl, `${GRAPH}/${userId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token,
  });
  const creationId = created.id;
  if (!creationId) throw new Error("Instagram: creation_id ирсэнгүй");

  // 2. Бэлэн болтол хүлээнэ — Instagram зургийг өөрөө татаж боловсруулдаг
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const status = await graph(
      fetchImpl,
      `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram контейнер ${status.status_code}`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`Instagram контейнер ${POLL_TIMEOUT_MS / 1000}с дотор бэлэн болсонгүй (${status.status_code})`);
    }
    await sleep(POLL_MS);
  }

  // 3. Нийтлэх
  const published = await graph(fetchImpl, `${GRAPH}/${userId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  if (!published.id) throw new Error("Instagram: media id ирсэнгүй");
  return published.id;
}

export async function markIgPosted(articleId: string, igMediaId: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: { igMediaId, igPostedAt: new Date(), igError: null },
  });
}

export async function markIgFailed(articleId: string, message: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: { igAttempts: { increment: 1 }, igError: message.slice(0, 300) },
  });
}

/** IG дараалалд хүлээж буй нийтлэлийн тоо (зурагтай, постлогдоогүй) */
export async function igQueueSize(): Promise<number> {
  return prisma.article.count({
    where: {
      status: "PUBLISHED", igPostedAt: null, igMediaId: null,
      igAttempts: { lt: MAX_IG_ATTEMPTS }, fbImageData: { not: null },
    },
  });
}

/** УБ цагаар өнөөдөр IG-д постлосон тоо */
export async function igPostedToday(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.article.count({ where: { igPostedAt: { gte: start, lt: end } } });
}

/**
 * Нэг нийтлэлийг Instagram-д постлоно. Алдаа гарвал throw (дуудагч markIgFailed хийнэ).
 * Зураггүй бол null буцаана — IG зураггүй пост дэмждэггүй.
 */
export async function publishArticleToInstagram(
  articleId: string,
  deps: InstagramDeps = {},
): Promise<{ igMediaId: string; caption: string } | null> {
  const a = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    select: {
      id: true, titleMn: true, fbText: true, fbImageData: true, tags: true,
      models: { select: { name: true } }, companies: { select: { name: true } },
    },
  });
  if (!a.fbImageData) {
    console.log(`  IG: зураггүй тул алгасав — ${a.titleMn}`);
    return null;
  }
  if (!a.fbText) throw new Error("FB текст байхгүй — эхлээд fbcopy ажиллуулна");

  const extraTags = [...a.models.map((m) => m.name), ...a.companies.map((c) => c.name), ...a.tags];
  const caption = buildCaption(a.fbText, extraTags);
  const problems = checkCaption(caption);
  if (problems.length) console.warn(`  ⚠ IG caption: ${problems.map((p) => p.detail).join("; ")}`);

  const igMediaId = await postToInstagram(publicImageUrl(a.id), caption, deps);
  return { igMediaId, caption };
}

export interface InstagramRunResult {
  posted: number;
  failed: number;
  skipped: boolean;
  queue: number;
  reason?: string;
}

/**
 * IG дараалалд хүлээж буй нийтлэлүүдийг постолно (ихэвчлэн өмнө нь унасан нь).
 * Өдөрт DAILY_PUBLISH_LIMIT-ээс илүүгүй.
 */
export async function postPendingInstagram(
  now = new Date(),
  deps: InstagramDeps = {},
): Promise<InstagramRunResult> {
  if (!igUserId() || !process.env.FB_PAGE_ACCESS_TOKEN) {
    console.log("IG тохируулаагүй, алгасав");
    return { posted: 0, failed: 0, skipped: true, queue: 0, reason: "IG_USER_ID алга" };
  }

  const limit = dailyPublishLimit();
  const today = await igPostedToday(now);
  if (today >= limit) {
    const reason = `өдрийн хязгаар ${today}/${limit}`;
    console.log(`IG: ${reason}`);
    return { posted: 0, failed: 0, skipped: true, queue: await igQueueSize(), reason };
  }

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED", igPostedAt: null, igMediaId: null,
      igAttempts: { lt: MAX_IG_ATTEMPTS }, fbImageData: { not: null }, fbText: { not: null },
    },
    orderBy: [{ publishedAt: "desc" }, { relevance: "desc" }],
    take: limit - today,
    select: { id: true, titleMn: true },
  });

  const run = await prisma.jobRun.create({ data: { job: "instagram", ...jobRunMeta() } });
  let posted = 0;
  let failed = 0;

  for (const a of articles) {
    try {
      const out = await publishArticleToInstagram(a.id, deps);
      if (!out) continue;
      await markIgPosted(a.id, out.igMediaId);
      posted++;
      console.log(`✓ IG: ${a.titleMn} → ${out.igMediaId}`);
    } catch (e) {
      const message = (e as Error).message;
      await markIgFailed(a.id, message);
      failed++;
      console.error(`✗ IG ${a.titleMn}: ${message}`);
    }
  }

  const queue = await igQueueSize();
  await prisma.jobRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(), ok: failed === 0,
      itemsIn: articles.length, itemsOut: posted,
      attempted: articles.length, failed,
      error: failed > 0 ? `${failed} IG пост амжилтгүй` : null,
    },
  });
  return { posted, failed, skipped: false, queue };
}

if (process.argv[1]?.endsWith("instagram.ts")) {
  postPendingInstagram()
    .then((r) => console.log(`IG: ${r.posted} постлосон, алдаа ${r.failed}, дараалалд ${r.queue}`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
