/**
 * GET /barimt/<slug>/embed — iframe-д зориулсан цэвэр хуудас.
 *
 * Route handler (page биш) — ингэснээр сайтын layout, nav, аналитикийн скрипт орохгүй.
 * Бусад сайтын хуудсанд ажиллах тул JS-гүй байх нь тэдний аюулгүй байдлын шаардлага.
 */
import { embedHeaders, embedHtml } from "@/gallery/embed.api";
import { getCard } from "@/gallery/queries";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const revalidate = 3_600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCard(slug);
  if (!c) return new Response("Not found", { status: 404 });

  return new Response(
    embedHtml({ slug, hook: c.hook, articleId: c.id, siteUrl: siteUrl() }),
    { headers: embedHeaders() },
  );
}
