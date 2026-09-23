/**
 * Нийтлэгдсэн мэдээг Facebook хуудсанд постлоно.
 *
 *   npx tsx src/publish/facebook.ts
 *
 * FB_PAGE_ACCESS_TOKEN хоосон бол юу ч хийхгүй гарна.
 * Нэг ажиллуулалтад FB_POSTS_PER_RUN (default 1) ширхэг — pipeline өдөрт 3 удаа
 * ажилладаг тул өдөрт 3 пост болно. Алдаа гарвал fbPostedAt хоосон үлдэж дараагийн
 * run-д дахин оролдоно; 3 удаа унасан нийтлэлийг fbError-тэй нь дараалалаас гаргана.
 */
import "dotenv/config";
import { prisma } from "../db";
import { articleLink, buildPost, MAX_ATTEMPTS, postsPerRun } from "./facebook.api";

const GRAPH = "https://graph.facebook.com/v21.0";
/** Нэг run дотор хэд хэдэн пост явбал хооронд нь завсарлана */
const GAP_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface PostableArticle {
  id: string;
  slug: string;
  titleMn: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
  models?: { name: string }[];
  companies?: { name: string }[];
}

/** Дараалалд байгаа нийтлэлийг уншихад хэрэгтэй талбарууд */
export const POSTABLE_SELECT = {
  id: true,
  slug: true,
  titleMn: true,
  summaryMn: true,
  bodyMn: true,
  models: { select: { name: true } },
  companies: { select: { name: true } },
} as const;

/** Нэг нийтлэлийг постолж, Facebook-ийн post id-г буцаана */
export async function postToFacebook(article: PostableArticle): Promise<string> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN тохируулаагүй байна");

  const link = articleLink(article.slug);
  const message = buildPost({
    titleMn: article.titleMn,
    summaryMn: article.summaryMn,
    bodyMn: article.bodyMn,
    link,
    modelNames: article.models?.map((m) => m.name),
    companyNames: article.companies?.map((c) => c.name),
  });

  // link өгснөөр Facebook нь og:image-тэй preview-г өөрөө зурна — зураг тусад нь upload хийхгүй
  const res = await fetch(`${GRAPH}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, link, access_token: token }),
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(`Facebook ${res.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return json.id;
}

/** Амжилттай постыг тэмдэглэнэ */
export async function markPosted(articleId: string, fbPostId: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: { fbPostId, fbPostedAt: new Date(), fbError: null },
  });
}

/** Алдааг бүртгэнэ — MAX_ATTEMPTS хүрвэл дараалалаас гарна */
export async function markFailed(articleId: string, message: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: { fbAttempts: { increment: 1 }, fbError: message.slice(0, 300) },
  });
}

/** Постлохыг хүлээж буй нийтлэлийн тоо — /admin дээр харуулна */
export async function queueSize(): Promise<number> {
  return prisma.article.count({
    where: {
      status: "PUBLISHED",
      fbPostedAt: null,
      fbPostId: null,
      fbAttempts: { lt: MAX_ATTEMPTS },
    },
  });
}

/**
 * Дараалалаас FB_POSTS_PER_RUN ширхгийг постолно.
 * Эрэмбэ: хамгийн сүүлд нийтлэгдсэн, тэнцвэл оноо өндөр нь.
 */
export async function postPending(): Promise<{
  posted: number;
  failed: number;
  skipped: boolean;
  queue: number;
}> {
  if (!process.env.FB_PAGE_ACCESS_TOKEN) {
    console.log("FB тохируулаагүй, алгасав");
    return { posted: 0, failed: 0, skipped: true, queue: 0 };
  }

  const perRun = postsPerRun();
  if (perRun === 0) {
    console.log("FB_POSTS_PER_RUN=0, алгасав");
    return { posted: 0, failed: 0, skipped: true, queue: await queueSize() };
  }

  const articles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      fbPostedAt: null,
      fbPostId: null,
      fbAttempts: { lt: MAX_ATTEMPTS },
      titleMn: { not: null },
    },
    orderBy: [{ publishedAt: "desc" }, { relevance: "desc" }],
    take: perRun,
    select: POSTABLE_SELECT,
  });
  console.log(`Дараалалд ${await queueSize()} нийтлэл, энэ удаа ${articles.length} постлоно...`);

  let posted = 0;
  let failed = 0;
  for (const [i, a] of articles.entries()) {
    try {
      const fbPostId = await postToFacebook(a);
      await markPosted(a.id, fbPostId);
      posted++;
      console.log(`✓ ${a.titleMn} → ${fbPostId}`);
    } catch (e) {
      const message = (e as Error).message;
      await markFailed(a.id, message);
      failed++;
      console.error(`✗ ${a.titleMn}: ${message}`);
    }
    if (i < articles.length - 1) await sleep(GAP_MS);
  }
  return { posted, failed, skipped: false, queue: await queueSize() };
}

if (process.argv[1]?.endsWith("facebook.ts")) {
  postPending()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
