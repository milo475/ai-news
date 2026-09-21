/**
 * Нийтлэгдсэн мэдээг Facebook хуудсанд постлоно.
 *
 *   npx tsx src/publish/facebook.ts
 *
 * FB_PAGE_ACCESS_TOKEN хоосон бол юу ч хийхгүй гарна.
 * Нэг ажиллуулалтад дээд тал нь 5 пост, хооронд 30 сек — spam болгохгүй.
 */
import "dotenv/config";
import { prisma } from "../db";

const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_PER_RUN = 5;
const GAP_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface PostableArticle {
  id: string;
  slug: string;
  titleMn: string | null;
  summaryMn: string | null;
}

/** Нэг нийтлэлийг постолж, Facebook-ийн post id-г буцаана */
export async function postToFacebook(article: PostableArticle): Promise<string> {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN тохируулаагүй байна");

  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const link = `${siteUrl}/medee/${article.slug}`;
  const message = `${article.titleMn ?? ""}\n\n${article.summaryMn ?? ""}\n\n👉 ${link}`;

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

/** Постлоогүй PUBLISHED нийтлэлүүдийг дараалан постолно */
export async function postPending(): Promise<{ posted: number; failed: number; skipped: boolean }> {
  if (!process.env.FB_PAGE_ACCESS_TOKEN) {
    console.log("FB тохируулаагүй, алгасав");
    return { posted: 0, failed: 0, skipped: true };
  }

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED", fbPostId: null },
    orderBy: { publishedAt: "asc" },
    take: MAX_PER_RUN,
    select: { id: true, slug: true, titleMn: true, summaryMn: true },
  });
  console.log(`Постлох ${articles.length} нийтлэл...`);

  let posted = 0;
  let failed = 0;
  for (const [i, a] of articles.entries()) {
    try {
      const fbPostId = await postToFacebook(a);
      await prisma.article.update({ where: { id: a.id }, data: { fbPostId } });
      posted++;
      console.log(`✓ ${a.titleMn} → ${fbPostId}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${a.titleMn}: ${(e as Error).message}`);
    }
    if (i < articles.length - 1) await sleep(GAP_MS);
  }
  return { posted, failed, skipped: false };
}

if (process.argv[1]?.endsWith("facebook.ts")) {
  postPending()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
