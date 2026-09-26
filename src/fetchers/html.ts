/**
 * RSS-гүй сайтаас нийтлэл татах generic fetcher — DB-д бичнэ.
 *
 *   npx tsx src/fetchers/html.ts                    # бүх listUrl-тай эх сурвалж
 *   npx tsx src/fetchers/html.ts --test <sourceId>  # зөвхөн холбоосуудыг хэвлэнэ
 *
 * robots.txt-г хүндэтгэнэ, эх сурвалж бүрийг 24 цагт нэг удаа татна.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { fetchFullText } from "./fulltext.api";
import { titleHash } from "./rss.api";
import {
  allowedByRobots, dueForFetch, extractLinks, parseRobots, USER_AGENT, type FoundLink,
  type RobotsRules,
} from "./html.api";
import { prefilter } from "../mongol/filter.api";

/** Хүсэлт хоорондын анхдагч завсар (robots-ийн crawl-delay илүү бол түүнийг авна) */
const GAP_MS = 1_500;
const TIMEOUT_MS = 20_000;
/** Үүнээс хуучин нийтлэл татахгүй */
const MAX_AGE_DAYS = 7;
const DUPE_WINDOW_DAYS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function rawSlug(now: Date): string {
  return `${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex")}`;
}

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Сайтын robots.txt. Татагдахгүй бол хоосон дүрэм (зөвшөөрөгдсөн гэж үзнэ). */
export async function loadRobots(siteUrl: string): Promise<RobotsRules> {
  try {
    const robotsUrl = new URL("/robots.txt", siteUrl).toString();
    const text = await getText(robotsUrl);
    return text ? parseRobots(text) : { disallow: [], crawlDelay: null };
  } catch {
    return { disallow: [], crawlDelay: null };
  }
}

/** Жагсаалтын хуудаснаас холбоосууд — /admin дээрх «Татаж үзэх» товч ч үүнийг дуудна */
export async function previewLinks(
  listUrl: string,
  selector: string,
): Promise<{ links: FoundLink[]; error: string | null; blocked: boolean }> {
  const robots = await loadRobots(listUrl);
  if (!allowedByRobots(robots, listUrl)) {
    return { links: [], error: "robots.txt хориглосон", blocked: true };
  }
  const html = await getText(listUrl);
  if (!html) return { links: [], error: "хуудас татагдсангүй", blocked: false };
  return { links: extractLinks(html, listUrl, selector), error: null, blocked: false };
}

export interface HtmlSourceResult {
  name: string;
  found: number;
  /** Түлхүүр үгийн шүүлт давсан */
  relevant: number;
  saved: number;
  dupe: number;
  error: string;
}

async function saveLink(
  source: { id: string; needsBrowser: boolean; defaultCategory: string; region: string },
  link: FoundLink,
  res: HtmlSourceResult,
  robots: RobotsRules,
): Promise<void> {
  if (!allowedByRobots(robots, link.url)) return;

  if (await prisma.article.findUnique({ where: { sourceUrl: link.url }, select: { id: true } })) {
    res.dupe++;
    return;
  }

  // Урьдчилсан шүүлт нь зөвхөн гарчиг дээр — бүтэн текст татахаас өмнө
  const byTitle = prefilter(link.title);
  const full = await fetchFullText(link.url, { browser: source.needsBrowser });
  await sleep(GAP_MS);

  const text = full?.text ?? "";
  // Гарчиг дээр таараагүй бол текстийн эхний хэсэг дээр дахин шалгана
  const check = byTitle.pass ? byTitle : prefilter(link.title, text.slice(0, 1_200));
  if (!check.pass) return;
  res.relevant++;

  const sourceHash = titleHash(link.title);
  const twin = await prisma.article.findFirst({
    where: { sourceHash, createdAt: { gte: new Date(Date.now() - DUPE_WINDOW_DAYS * 86_400_000) } },
    select: { id: true },
  });
  if (twin) {
    res.dupe++;
    return;
  }

  await prisma.article.create({
    data: {
      slug: rawSlug(new Date()),
      status: "RAW",
      category: source.defaultCategory as never,
      region: source.region as never,
      isLocal: source.region === "MN",
      sourceId: source.id,
      sourceUrl: link.url,
      sourceTitle: link.title,
      sourceText: text || null,
      sourceAuthor: full?.byline ?? null,
      sourceImageUrl: full?.imageUrl ?? null,
      sourceHash,
      // HTML жагсаалтад огноо байдаггүй — agent нь текстээс тооцно
      publishedAtSource: null,
    },
  });
  res.saved++;
}

/** listUrl-тай бүх идэвхтэй эх сурвалжийг татна */
export async function fetchHtmlSources(): Promise<HtmlSourceResult[]> {
  const sources = await prisma.source.findMany({
    where: { isActive: true, listUrl: { not: null }, linkSelector: { not: null } },
    orderBy: [{ weight: "desc" }, { name: "asc" }],
  });

  const results: HtmlSourceResult[] = [];
  for (const source of sources) {
    const res: HtmlSourceResult = { name: source.name, found: 0, relevant: 0, saved: 0, dupe: 0, error: "" };
    results.push(res);

    // 24 цагт нэг удаа — сайтад ачаалал өгөхгүй
    if (!dueForFetch(source.lastFetchedAt)) {
      res.error = "24 цаг болоогүй, алгасав";
      continue;
    }

    try {
      const robots = await loadRobots(source.listUrl!);
      if (!allowedByRobots(robots, source.listUrl!)) {
        res.error = "robots.txt хориглосон";
        await prisma.source.update({ where: { id: source.id }, data: { lastError: res.error } });
        continue;
      }

      const html = await getText(source.listUrl!);
      if (!html) throw new Error("жагсаалтын хуудас татагдсангүй");

      const links = extractLinks(html, source.listUrl!, source.linkSelector!);
      res.found = links.length;
      if (links.length === 0) throw new Error("selector-оор холбоос олдсонгүй");

      for (const link of links) {
        await saveLink(source, link, res, robots);
      }
      await prisma.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date(), lastError: null },
      });
    } catch (e) {
      res.error = String(e instanceof Error ? e.message : e).slice(0, 500);
      console.warn(`⚠ ${source.name}: ${res.error}`);
      await prisma.source.update({ where: { id: source.id }, data: { lastError: res.error } });
    }
  }
  return results;
}

export async function runHtml(): Promise<{ sources: number; found: number; saved: number; failed: number }> {
  const run = await prisma.jobRun.create({ data: { job: "html", ...jobRunMeta() } });
  try {
    const results = await fetchHtmlSources();
    const sum = (k: "found" | "relevant" | "saved" | "dupe") => results.reduce((a, r) => a + r[k], 0);

    if (results.length > 0) {
      console.table(
        results.map((r) => ({
          "Эх сурвалж": r.name,
          Холбоос: r.found,
          Хамааралтай: r.relevant,
          Шинэ: r.saved,
          Давхардсан: r.dupe,
          Алдаа: r.error.slice(0, 40),
        })),
      );
    }

    const failed = results.filter((r) => r.error && !r.error.includes("алгасав")).length;
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, itemsIn: sum("found"), itemsOut: sum("saved"), failed },
    });
    const { closeBrowser } = await import("./fulltext.api");
    await closeBrowser();
    return { sources: results.length, found: sum("found"), saved: sum("saved"), failed };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 1000) },
    });
    throw e;
  }
}

if (process.argv[1]?.endsWith("html.ts")) {
  const testArg = process.argv.indexOf("--test");
  if (testArg > -1) {
    const id = process.argv[testArg + 1];
    const s = await prisma.source.findUniqueOrThrow({
      where: { id },
      select: { name: true, listUrl: true, linkSelector: true },
    });
    const r = await previewLinks(s.listUrl ?? "", s.linkSelector ?? "");
    console.log(`${s.name}: ${r.links.length} холбоос${r.error ? ` — ${r.error}` : ""}`);
    for (const l of r.links.slice(0, 10)) console.log(`  ${l.title.slice(0, 70)}\n    ${l.url}`);
  } else {
    const r = await runHtml();
    console.log(`${r.sources} эх сурвалж, ${r.found} холбоос, ${r.saved} шинэ, ${r.failed} алдаатай`);
  }
  await prisma.$disconnect();
}
