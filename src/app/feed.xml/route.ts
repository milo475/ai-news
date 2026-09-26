/**
 * GET /feed.xml — сайтын үндсэн RSS: мэдээ + заавар нэг урсгалд.
 *
 * Уншигчид нэг л фийд дагахад сайтын бүх шинэ агуулга ирнэ.
 */
import { prisma } from "@/db";
import { feedHeaders, rssXml, type FeedItem } from "@/lib/rss.api";
import { absUrl, siteUrl } from "@/lib/site";
import { memoTtl, TTL } from "@/lib/cache.api";

/**
 * Хүсэлтийн үед үүснэ — статикаар prerender хийвэл SITE_URL нь build-ийн үеийнхээр
 * шатаж үлдэнэ. Кэшийг Cache-Control (feedHeaders) хариуцна.
 */
export const dynamic = "force-dynamic";

const LIMIT = 40;

async function loadArticlesUncached() {
  return prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: LIMIT,
    select: {
      slug: true, titleMn: true, summaryMn: true, publishedAt: true,
      tags: true, kind: true, region: true,
    },
  });
}

async function loadGuidesUncached() {
  return prisma.guide.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { slug: true, title: true, lead: true, publishedAt: true, level: true },
  });
}

// Фийд нь force-dynamic — DB-д хүсэлт бүрт очихгүйн тулд кэшлэнэ
const loadArticles: typeof loadArticlesUncached = memoTtl(loadArticlesUncached, {
  name: "feedArticles", ttlMs: TTL.news, max: 1,
});
const loadGuides: typeof loadGuidesUncached = memoTtl(loadGuidesUncached, {
  name: "feedGuides", ttlMs: TTL.guide, max: 1,
});

type Articles = Awaited<ReturnType<typeof loadArticles>>;
type Guides = Awaited<ReturnType<typeof loadGuides>>;

function buildItems(articles: Articles, guides: Guides): FeedItem[] {
  return [
    // Нийтлэгдсэн мэдээ гарчиггүй байх ёсгүй — байвал алгасна
    ...articles
      .filter((a) => a.titleMn)
      .map((a) => ({
        title: a.titleMn!,
        link: absUrl(`/medee/${a.slug}`),
        description: a.summaryMn ?? "",
        pubDate: a.publishedAt,
        categories: [
          a.kind === "DIGEST" ? "Долоо хоногийн тойм" : "Мэдээ",
          ...(a.region === "MN" ? ["Монгол"] : []),
          ...a.tags.slice(0, 4),
        ],
        imageUrl: absUrl(`/api/og/${a.slug}`),
      })),
    ...guides.map((g) => ({
      title: g.title,
      link: absUrl(`/zaavar/${g.slug}`),
      description: g.lead,
      pubDate: g.publishedAt,
      categories: ["Заавар", g.level],
    })),
  ]
    .sort((x, y) => (y.pubDate?.getTime() ?? 0) - (x.pubDate?.getTime() ?? 0))
    .slice(0, LIMIT);
}

export async function GET() {
  const site = siteUrl();

  // Build үед DB байхгүй (Docker) — хоосон фийд гаргаад, revalidate дээр дүүргэнэ.
  // Фийдийн улмаас deploy унах ёсгүй.
  let items: FeedItem[] = [];
  try {
    const [articles, guides] = await Promise.all([loadArticles(), loadGuides()]);
    items = buildItems(articles, guides);
  } catch (e) {
    console.warn(`⚠ feed.xml: DB-гүй үүсгэв — ${(e as Error).message.slice(0, 120)}`);
  }

  const xml = rssXml({
    title: "AI News — хиймэл оюуны мэдээ монголоор",
    description: "Дэлхийн AI мэдээ, гарын авлага, моделийн жагсаалт — монгол хэлээр, өдөр бүр.",
    link: `${site}/`,
    selfUrl: `${site}/feed.xml`,
    items,
  });

  return new Response(xml, { headers: feedHeaders() });
}
