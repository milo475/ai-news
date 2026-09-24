/**
 * Мэдээний эх сурвалжуудыг Source хүснэгтэд бичнэ.
 *
 *   npm run db:seed:sources
 *
 * url-аар unique. Байгаа эх сурвалж дээр зөвхөн name/feedUrl-ийг шинэчилнэ —
 * гараар тохируулсан isActive/weight-ийг дарж бичихгүй.
 */
import "dotenv/config";
import { prisma } from "../db";
import type { ArticleCategory } from "../generated/prisma/enums";

export interface SeedSource {
  name: string;
  url: string;
  feedUrl: string;
  weight: number;
  /** Энэ эх сурвалжийн мэдээ ихэвчлэн ямар ангилалд ордог (LLM өөрөөр шийдвэл түүнийг нь авна) */
  category?: ArticleCategory;
  /** Зөвхөн шинээр үүсгэхэд хэрэглэнэ (RSS нь ажиллахгүй эх сурвалж) */
  isActive?: boolean;
  /** JS-ээр зурагддаг сайт — бүтэн текстэд Playwright хэрэгтэй */
  needsBrowser?: boolean;
}

export const SOURCES: SeedSource[] = [
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

async function main() {
  for (const s of SOURCES) {
    const row = await prisma.source.upsert({
      where: { url: s.url },
      create: {
        name: s.name, url: s.url, feedUrl: s.feedUrl, weight: s.weight,
        defaultCategory: s.category ?? "NEWS",
        isActive: s.isActive ?? true, needsBrowser: s.needsBrowser ?? false,
      },
      // Гараар тохируулсан isActive/weight-ийг дарж бичихгүй; defaultCategory нь seed-ийн мэдэлд
      update: { name: s.name, feedUrl: s.feedUrl, defaultCategory: s.category ?? "NEWS", needsBrowser: s.needsBrowser ?? false },
      select: { isActive: true, weight: true, defaultCategory: true },
    });
    console.log(`${row.isActive ? "✓" : "·"} ${s.name} (жин ${row.weight}, ${row.defaultCategory})`);
  }
  console.log(`Нийт ${SOURCES.length} эх сурвалж.`);
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith("sources.seed.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
