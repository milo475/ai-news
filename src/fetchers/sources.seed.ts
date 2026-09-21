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

export interface SeedSource {
  name: string;
  url: string;
  feedUrl: string;
  weight: number;
  /** Зөвхөн шинээр үүсгэхэд хэрэглэнэ (RSS нь ажиллахгүй эх сурвалж) */
  isActive?: boolean;
  /** JS-ээр зурагддаг сайт — бүтэн текстэд Playwright хэрэгтэй */
  needsBrowser?: boolean;
}

export const SOURCES: SeedSource[] = [
  { name: "OpenAI Blog", url: "https://openai.com/blog", feedUrl: "https://openai.com/blog/rss.xml", weight: 9, needsBrowser: true },
  // 2026-09-20: anthropic.com дээр RSS/Atom олдсонгүй (rss.xml, feed.xml, news/rss.xml бүгд 404;
  // HTML-д <link rel="alternate"> байхгүй) — feed гарах хүртэл идэвхгүй.
  { name: "Anthropic News", url: "https://www.anthropic.com/news", feedUrl: "https://www.anthropic.com/rss.xml", weight: 9, isActive: false },
  { name: "Google DeepMind Blog", url: "https://deepmind.google/discover/blog", feedUrl: "https://deepmind.google/blog/rss.xml", weight: 9 },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog", feedUrl: "https://huggingface.co/blog/feed.xml", weight: 8 },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence", feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/", weight: 7 },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence", feedUrl: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", weight: 7 },
  { name: "Ars Technica AI", url: "https://arstechnica.com/ai", feedUrl: "https://arstechnica.com/ai/feed/", weight: 7 },
  { name: "MIT Technology Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence", feedUrl: "https://www.technologyreview.com/topic/artificial-intelligence/feed", weight: 7 },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai", feedUrl: "https://venturebeat.com/category/ai/feed/", weight: 6 },
  { name: "Simon Willison", url: "https://simonwillison.net", feedUrl: "https://simonwillison.net/atom/everything/", weight: 4 },   // хувийн блог
];

async function main() {
  for (const s of SOURCES) {
    const row = await prisma.source.upsert({
      where: { url: s.url },
      create: { name: s.name, url: s.url, feedUrl: s.feedUrl, weight: s.weight, isActive: s.isActive ?? true, needsBrowser: s.needsBrowser ?? false },
      update: { name: s.name, feedUrl: s.feedUrl, needsBrowser: s.needsBrowser ?? false },
      select: { isActive: true, weight: true },
    });
    console.log(`${row.isActive ? "✓" : "·"} ${s.name} (жин ${row.weight})`);
  }
  console.log(`Нийт ${SOURCES.length} эх сурвалж.`);
  await prisma.$disconnect();
}

if (process.argv[1]?.endsWith("sources.seed.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
