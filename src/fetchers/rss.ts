/**
 * RSS цуглуулагч — DB-д бичнэ. Мэдээний agent-ийн 1-р шат: LLM дуудахгүй,
 * зөвхөн эх сурвалжаас татаж RAW нийтлэл болгож хадгална.
 *
 *   npx tsx src/fetchers/rss.ts
 *
 * Cron: 1–2 цаг тутам.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { closeBrowser, fetchFullText, textFromFeedHtml } from "./fulltext.api";
import { fetchFeed, normalizeUrl, titleHash, type FeedItem } from "./rss.api";

/** Үүнээс хуучин нийтлэл татахгүй — анхны татахад олон жилийн архив орохоос сэргийлнэ */
const MAX_AGE_DAYS = 7;
/** Гарчгийн hash-аар давхардал хайх цонх */
const DUPE_WINDOW_DAYS = 3;
/** Бүтэн текст татах хүсэлтүүдийн хоорондох завсар — эх сурвалжид ачаалал өгөхгүй */
const FULLTEXT_GAP_MS = 500;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Түр slug: "20260920-a3f9c1". Монгол гарчиг гарсны дараа 2-р шатанд солино. */
function rawSlug(now: Date): string {
  return `${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex")}`;
}

interface SourceResult {
  name: string;
  items: number;      // feed-ээс ирсэн
  saved: number;      // шинээр хадгалсан
  dupeUrl: number;    // ижил хаягаар өмнө орсон
  dupeTitle: number;  // өөр хаяг, ижил гарчиг (өөр сайт дамжуулсан)
  old: number;        // MAX_AGE_DAYS-ээс хуучин
  fullText: number;   // бүтэн текст олдсон
  error: string;
}

/** Нэг эх сурвалжийн item-үүдийг RAW нийтлэл болгож хадгална */
async function saveItems(
  source: { id: string; needsBrowser: boolean },
  items: FeedItem[],
  res: SourceResult,
): Promise<void> {
  const ageLimit = daysAgo(MAX_AGE_DAYS);
  for (const item of items) {
    if (item.publishedAt && item.publishedAt < ageLimit) { res.old++; continue; }

    const sourceUrl = normalizeUrl(item.url);
    if (await prisma.article.findUnique({ where: { sourceUrl }, select: { id: true } })) {
      res.dupeUrl++;
      continue;
    }

    const full = await fetchFullText(sourceUrl, { browser: source.needsBrowser });
    await sleep(FULLTEXT_GAP_MS);
    const sourceText = full?.text ?? textFromFeedHtml(item.fullHtml);
    if (sourceText) res.fullText++;

    const sourceHash = titleHash(item.title);
    const twin = await prisma.article.findFirst({
      where: { sourceHash, createdAt: { gte: daysAgo(DUPE_WINDOW_DAYS) } },
      select: { id: true },
    });
    if (twin) { res.dupeTitle++; continue; }

    await prisma.article.create({
      data: {
        slug: rawSlug(new Date()),
        status: "RAW",
        sourceId: source.id,
        sourceUrl,
        sourceTitle: item.title,
        sourceExcerpt: item.excerpt || null,
        sourceText,
        sourceAuthor: item.author ?? full?.byline ?? null,
        sourceHash,
        publishedAtSource: item.publishedAt ?? null,
      },
    });
    res.saved++;
  }
}

/** Идэвхтэй эх сурвалж бүрийг дараалан татна (зэрэг биш — сайтуудад ачаалал өгөхгүй) */
export async function fetchAllSources(): Promise<SourceResult[]> {
  const sources = await prisma.source.findMany({
    where: { isActive: true, feedUrl: { not: null } },
    orderBy: [{ weight: "desc" }, { name: "asc" }],
  });

  const results: SourceResult[] = [];
  for (const source of sources) {
    const res: SourceResult = { name: source.name, items: 0, saved: 0, dupeUrl: 0, dupeTitle: 0, old: 0, fullText: 0, error: "" };
    results.push(res);
    try {
      const items = await fetchFeed(source.feedUrl!);
      res.items = items.length;
      await saveItems(source, items, res);
      await prisma.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date(), lastError: null },
      });
    } catch (e) {
      // Нэг feed унасан нь бусдыг зогсоохгүй
      res.error = String(e instanceof Error ? e.message : e).slice(0, 500);
      console.warn(`⚠ ${source.name}: ${res.error}`);
      await prisma.source.update({ where: { id: source.id }, data: { lastError: res.error } });
    }
  }
  return results;
}

/** Pipeline болон CLI хоёулаа үүнийг дуудна */
export async function runRss(): Promise<{ items: number; saved: number; sources: number; failedSources: number }> {
  const run = await prisma.jobRun.create({ data: { job: "rss", ...jobRunMeta() } });
  try {
    const results = await fetchAllSources();
    const sum = (k: keyof SourceResult) => results.reduce((a, r) => a + (r[k] as number), 0);

    console.table(
      results.map((r) => ({
        "Эх сурвалж": r.name,
        Ирсэн: r.items,
        Шинэ: r.saved,
        "Хаяг давхардсан": r.dupeUrl,
        "Гарчиг давхардсан": r.dupeTitle,
        Хуучин: r.old,
        "Бүтэн текст": r.fullText,
        Алдаа: r.error ? r.error.slice(0, 60) : "",
      })),
    );
    console.log(
      `Нийт: ирсэн ${sum("items")}, шинэ ${sum("saved")}, ` +
        `давхардсан ${sum("dupeUrl")} (хаяг) + ${sum("dupeTitle")} (гарчиг), ` +
        `бүтэн текст ${sum("fullText")}, ` +
        `хуучин ${sum("old")}, алдаатай эх сурвалж ${results.filter((r) => r.error).length}`,
    );

    // Эх сурвалж бүр унасан бол лог дээр ч ногоон харагдах ёсгүй
    const failedSources = results.filter((r) => r.error).length;
    const allFailed = results.length > 0 && failedSources === results.length;
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: !allFailed,
        itemsIn: sum("items"),
        itemsOut: sum("saved"),
        error: allFailed ? `${failedSources}/${results.length} эх сурвалж татагдаагүй` : null,
      },
    });
    return { items: sum("items"), saved: sum("saved"), sources: results.length, failedSources };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e) },
    });
    throw e;
  } finally {
    await closeBrowser();
  }
}

if (process.argv[1]?.endsWith("rss.ts")) {
  runRss()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
