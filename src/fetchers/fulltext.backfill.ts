/**
 * sourceText хоосон RAW/DRAFT нийтлэлүүдэд бүтэн текстийг нөхөж татна.
 *
 *   npx tsx src/fetchers/fulltext.backfill.ts
 *
 * Эх хуудас татагдахгүй бол (JS-ээр зурагддаг сайт) feed-ийн content:encoded-ийг нөөцөд хэрэглэнэ.
 * Тиймээс эх сурвалж бүрийн feed-ийг нэг удаа татаж, хаягаар нь тааруулна.
 */
import "dotenv/config";
import { prisma } from "../db";
import { closeBrowser, fetchFullText, textFromFeedHtml } from "./fulltext.api";
import { fetchFeed, normalizeUrl } from "./rss.api";

const GAP_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Нэг эх сурвалжийн feed-ийг татаж, normalize хийсэн хаяг → бүтэн HTML болгон буулгана */
async function feedHtmlByUrl(feedUrl: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    for (const item of await fetchFeed(feedUrl)) {
      if (item.fullHtml) map.set(normalizeUrl(item.url), item.fullHtml);
    }
  } catch (e) {
    console.warn(`⚠ feed: ${(e as Error).message}`);
  }
  return map;
}

async function main() {
  const articles = await prisma.article.findMany({
    where: { sourceText: null, status: { in: ["RAW", "DRAFT"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, sourceUrl: true, sourceAuthor: true, sourceId: true, source: { select: { name: true, feedUrl: true, needsBrowser: true } } },
  });
  console.log(`sourceText хоосон ${articles.length} нийтлэл...`);

  const feeds = new Map<string, Map<string, string>>();
  const stat = new Map<string, { page: number; feed: number; fail: number }>();

  for (const a of articles) {
    const s = stat.get(a.source.name) ?? { page: 0, feed: 0, fail: 0 };
    stat.set(a.source.name, s);

    let text = (await fetchFullText(a.sourceUrl, { browser: a.source.needsBrowser }))?.text ?? null;
    await sleep(GAP_MS);
    if (text) {
      s.page++;
    } else if (a.source.feedUrl) {
      if (!feeds.has(a.sourceId)) feeds.set(a.sourceId, await feedHtmlByUrl(a.source.feedUrl));
      text = textFromFeedHtml(feeds.get(a.sourceId)!.get(a.sourceUrl));
      if (text) s.feed++;
    }
    if (!text) { s.fail++; continue; }

    await prisma.article.update({ where: { id: a.id }, data: { sourceText: text } });
  }

  console.table(
    [...stat.entries()].map(([name, s]) => ({
      "Эх сурвалж": name,
      "Хуудаснаас": s.page,
      "Feed-ээс": s.feed,
      Олдоогүй: s.fail,
    })),
  );
  const ok = [...stat.values()].reduce((a, s) => a + s.page + s.feed, 0);
  console.log(`Бүтэн текст олдсон: ${ok} / ${articles.length}`);
  await closeBrowser();
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith("fulltext.backfill.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
