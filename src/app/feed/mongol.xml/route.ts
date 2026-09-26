/**
 * GET /feed/mongol.xml — зөвхөн Монголын AI мэдээ.
 *
 * Дотоодын мэдээг тусад нь дагахыг хүссэн уншигчдад (болон дахин нийтлэгчдэд).
 */
import { localNews } from "@/mongol/queries";
import { feedHeaders, rssXml, type FeedItem } from "@/lib/rss.api";
import { absUrl, siteUrl } from "@/lib/site";

/**
 * Хүсэлтийн үед үүснэ — статикаар prerender хийвэл SITE_URL нь build-ийн үеийнхээр
 * шатаж үлдэнэ. Кэшийг Cache-Control (feedHeaders) хариуцна.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const site = siteUrl();

  // Build үед DB байхгүй — хоосон фийд (feed.xml-тэй ижил дүрэм)
  let items: FeedItem[] = [];
  try {
    const rows = await localNews(40);
    items = rows.map((n) => ({
      title: n.titleMn,
      link: absUrl(`/medee/${n.slug}`),
      description: n.summaryMn,
      pubDate: n.publishedAt,
      categories: ["Монгол", ...n.tags.slice(0, 4)],
    }));
  } catch (e) {
    console.warn(`⚠ feed/mongol.xml: DB-гүй үүсгэв — ${(e as Error).message.slice(0, 120)}`);
  }

  const xml = rssXml({
    title: "AI News — Монголын AI мэдээ",
    description: "Монголын хиймэл оюун, технологийн мэдээ — нэг фийдэд.",
    link: `${site}/mongol`,
    selfUrl: `${site}/feed/mongol.xml`,
    items,
  });

  return new Response(xml, { headers: feedHeaders() });
}
