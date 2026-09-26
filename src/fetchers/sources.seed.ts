/**
 * Мэдээний эх сурвалжуудыг Source хүснэгтэд бичнэ.
 *
 *   npm run seed:sources
 *
 * Idempotent: `url`-аар upsert хийнэ. Байгаа эх сурвалж дээр зөвхөн name/feedUrl/
 * defaultCategory/needsBrowser-ийг шинэчилнэ — гараар тохируулсан `isActive`, `weight`-ийг
 * хэзээ ч дарж бичихгүй (гараар унтраасан feed автоматаар асахгүй).
 *
 * `start:cron` дээр `prisma migrate deploy`-ийн дараа автоматаар ажиллана — шинэ эх сурвалж
 * нэмэхэд deploy хийхэд л хангалттай, гараар seed хийх шаардлагагүй.
 */
import "dotenv/config";
import { prisma } from "../db";
import type { ArticleCategory, Region } from "../generated/prisma/enums";

export interface SeedSource {
  name: string;
  url: string;
  /** RSS/Atom хаяг. HTML fetcher-ээр татдаг эх сурвалжид хоосон. */
  feedUrl?: string;
  weight: number;
  /** MN = дотоодын хэвлэл (/mongol) */
  region?: Region;
  /** RSS байхгүй сайт: жагсаалтын хуудас + CSS selector (src/fetchers/html.ts) */
  listUrl?: string;
  linkSelector?: string;
  /** Энэ эх сурвалжийн мэдээ ихэвчлэн ямар ангилалд ордог (LLM өөрөөр шийдвэл түүнийг нь авна) */
  category?: ArticleCategory;
  /** Зөвхөн шинээр үүсгэхэд хэрэглэнэ (RSS нь ажиллахгүй эх сурвалж) */
  isActive?: boolean;
  /** JS-ээр зурагддаг сайт — бүтэн текстэд Playwright хэрэгтэй */
  needsBrowser?: boolean;
}

export const SOURCES: SeedSource[] = [
  // ════════ Монголын хэвлэл (region: MN) ════════
  // 2026-09-26: RSS байгаа эсэхийг тус бүрд шалгасан. Дотоодын сайтууд ерөнхий
  // мэдээний сайт тул AI/технологийн шүүлт (src/mongol/filter.api.ts) хийгдэнэ.

  // ---- RSS-тэй ----
  // application/xml, /rss ба /rss.xml хоёул ажиллана
  { name: "iKon.mn", url: "https://ikon.mn", feedUrl: "https://ikon.mn/rss", weight: 6, region: "MN" },
  // ITOIM — технологи, медиад тусгайлсан тул хамгийн өндөр жин
  { name: "ITOIM", url: "https://itoim.mn", feedUrl: "https://itoim.mn/rss.xml", weight: 8, region: "MN" },
  { name: "Eguur.mn", url: "https://eguur.mn", feedUrl: "https://eguur.mn/feed/", weight: 5, region: "MN" },

  // ---- RSS байхгүй → HTML fetcher (listUrl + linkSelector) ----
  { name: "News.mn", url: "https://news.mn", weight: 6, region: "MN", listUrl: "https://news.mn", linkSelector: "article a" },
  // Бизнес, технологийн тойм — «AI Academy» зэрэг дотоодын төслүүдийг бичдэг
  { name: "Unread.today", url: "https://unread.today", weight: 7, region: "MN", listUrl: "https://unread.today", linkSelector: "h3 a" },
  { name: "UB Life", url: "http://ublife.mn", weight: 4, region: "MN", listUrl: "http://ublife.mn", linkSelector: "article a" },
  { name: "МУИС", url: "https://num.edu.mn", weight: 5, region: "MN", listUrl: "https://num.edu.mn/news", linkSelector: "article a" },

  // ---- Одоохондоо ажиллахгүй (шалгасан, шалтгаантай) ----
  // 2026-09-26: жагсаалт нь JS-ээр зурагддаг — static HTML-д холбоос 0.
  // HTML fetcher нь Playwright хэрэглэдэггүй тул одоохондоо унтраав.
  { name: "Gogo.mn", url: "https://gogo.mn", weight: 6, region: "MN", listUrl: "https://gogo.mn", linkSelector: "article a", isActive: false },
  { name: "Zindaa.mn", url: "https://zindaa.mn", weight: 5, region: "MN", listUrl: "https://zindaa.mn", linkSelector: "article a", isActive: false },
  // 2026-09-26: montsame.mn нь бот бүрд 403 буцаана (robots.txt ч татагдахгүй).
  { name: "МОНЦАМЭ", url: "https://montsame.mn", weight: 6, region: "MN", listUrl: "https://montsame.mn/mn/list/159", linkSelector: "article a", isActive: false },
  // 2026-09-26: ШУТИС-ийн мэдээний хуудас static HTML-д холбоос гаргахгүй.
  { name: "ШУТИС", url: "https://www.must.edu.mn", weight: 5, region: "MN", listUrl: "https://www.must.edu.mn/mn/news", linkSelector: "article a", isActive: false },
  // 2026-09-26: crc.gov.mn-ийн мэдээний listing олдсонгүй (/n/news → 404, нүүр дээр 0).
  { name: "ХХЗХ", url: "https://crc.gov.mn", weight: 5, region: "MN", listUrl: "https://crc.gov.mn", linkSelector: "article a", isActive: false },

  // ---- Компанийн албан ёсны ----
  { name: "OpenAI Blog", url: "https://openai.com/blog", feedUrl: "https://openai.com/blog/rss.xml", weight: 9, needsBrowser: true },
  // 2026-09-20: anthropic.com дээр RSS/Atom олдсонгүй (rss.xml, feed.xml, news/rss.xml бүгд 404;
  // HTML-д <link rel="alternate"> байхгүй) — feed гарах хүртэл идэвхгүй.
  { name: "Anthropic News", url: "https://www.anthropic.com/news", feedUrl: "https://www.anthropic.com/rss.xml", weight: 9, isActive: false },
  { name: "Google DeepMind Blog", url: "https://deepmind.google/discover/blog", feedUrl: "https://deepmind.google/blog/rss.xml", weight: 9 },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog", feedUrl: "https://huggingface.co/blog/feed.xml", weight: 8, category: "PROJECT" },

  // ---- Мэдээний хэвлэл ----
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence", feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/", weight: 7 },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence", feedUrl: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", weight: 7 },
  { name: "Ars Technica AI", url: "https://arstechnica.com/ai", feedUrl: "https://arstechnica.com/ai/feed/", weight: 7 },
  { name: "MIT Technology Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence", feedUrl: "https://www.technologyreview.com/topic/artificial-intelligence/feed", weight: 7 },
  { name: "Wired AI", url: "https://www.wired.com/tag/artificial-intelligence", feedUrl: "https://www.wired.com/feed/tag/ai/latest/rss", weight: 7 },
  { name: "The Guardian AI", url: "https://www.theguardian.com/technology/artificialintelligenceai", feedUrl: "https://www.theguardian.com/technology/artificialintelligenceai/rss", weight: 7 },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai", feedUrl: "https://venturebeat.com/category/ai/feed/", weight: 6 },
  // 2026-09-23: Reuters RSS хаагдсан (reuters.com/technology/rss → 401, reutersagency.com → 404).
  { name: "Reuters Technology", url: "https://www.reuters.com/technology", feedUrl: "https://www.reuters.com/technology/rss", weight: 8, isActive: false },

  // ---- Бизнес, хэрэглээ, төсөл ----
  { name: "Fast Company AI", url: "https://www.fastcompany.com/section/artificial-intelligence", feedUrl: "https://www.fastcompany.com/section/artificial-intelligence/rss", weight: 6, category: "BUSINESS" },
  { name: "Product Hunt", url: "https://www.producthunt.com", feedUrl: "https://www.producthunt.com/feed?category=artificial-intelligence", weight: 5, category: "PROJECT" },
  { name: "TLDR AI", url: "https://tldr.tech/ai", feedUrl: "https://tldr.tech/api/rss/ai", weight: 6, category: "HOWTO" },
  { name: "Simon Willison", url: "https://simonwillison.net", feedUrl: "https://simonwillison.net/atom/everything/", weight: 4, category: "HOWTO" },   // хувийн блог
  // 2026-09-23: hnrss.org 502 буцааж байна (үйлчилгээ унасан) — сэргэвэл isActive = true болгоно.
  { name: "Hacker News AI", url: "https://news.ycombinator.com", feedUrl: "https://hnrss.org/newest?q=AI&points=100", weight: 5, category: "PROJECT", isActive: false },
  // 2026-09-23: bensbites.com, theneurondaily.com дээр RSS олдсонгүй (feed → HTML/404).

  // ---- Баримт, судалгаа, эрсдэл ----
  { name: "Futurism", url: "https://futurism.com", feedUrl: "https://futurism.com/feed", weight: 5, category: "FACT" },
  { name: "Rest of World", url: "https://restofworld.org", feedUrl: "https://restofworld.org/feed/latest/", weight: 6, category: "FACT" },
  { name: "AI Incident Database", url: "https://incidentdatabase.ai", feedUrl: "https://incidentdatabase.ai/rss.xml", weight: 7, category: "RISK" },
];

/** SOURCES-ийг DB-тэй тааруулна. Шинэ/шинэчилсэн тоог буцаана. */
export async function seedSources(): Promise<{ created: number; updated: number; active: number }> {
  let created = 0;
  let updated = 0;
  let active = 0;

  for (const s of SOURCES) {
    const existing = await prisma.source.findUnique({ where: { url: s.url }, select: { id: true } });
    const row = await prisma.source.upsert({
      where: { url: s.url },
      create: {
        name: s.name, url: s.url, feedUrl: s.feedUrl ?? null, weight: s.weight,
        defaultCategory: s.category ?? "NEWS",
        region: s.region ?? "GLOBAL",
        listUrl: s.listUrl ?? null, linkSelector: s.linkSelector ?? null,
        language: s.region === "MN" ? "mn" : "en",
        isActive: s.isActive ?? true, needsBrowser: s.needsBrowser ?? false,
      },
      // Гараар тохируулсан isActive/weight-ийг дарж бичихгүй; бусад нь seed-ийн мэдэлд
      update: {
        name: s.name, feedUrl: s.feedUrl ?? null, defaultCategory: s.category ?? "NEWS",
        region: s.region ?? "GLOBAL",
        listUrl: s.listUrl ?? null, linkSelector: s.linkSelector ?? null,
        needsBrowser: s.needsBrowser ?? false,
      },
      select: { isActive: true, weight: true, defaultCategory: true },
    });
    if (existing) updated++;
    else created++;
    if (row.isActive) active++;
    console.log(
      `${existing ? " " : "+"} ${row.isActive ? "✓" : "·"} ${s.name} (жин ${row.weight}, ${row.defaultCategory})`,
    );
  }

  console.log(`Эх сурвалж: нийт ${SOURCES.length} (шинэ ${created}, шинэчилсэн ${updated}), идэвхтэй ${active}.`);
  return { created, updated, active };
}

if (process.argv[1]?.endsWith("sources.seed.ts")) {
  seedSources()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
