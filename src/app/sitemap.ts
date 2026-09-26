import type { MetadataRoute } from "next";
import { prisma } from "@/db";
import { sitemapEntries } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import { memoTtl, TTL } from "@/lib/cache.api";

/**
 * Build үед биш, хүсэлтийн үед үүснэ.
 *
 * Статикаар prerender хийвэл SITE_URL нь build-ийн үеийнхээр «шатаж» үлддэг —
 * домэйн солиход зөвхөн орчны хувьсагч өөрчлөх нь хангалтгүй болно. Оронд нь
 * үр дүнг процесс дотроо өдөрт нэг удаа кэшлэнэ (доорх `cachedSitemap`).
 */
export const dynamic = "force-dynamic";

/** Google нэг sitemap-д 50 000 хаяг зөвшөөрдөг; бид түүнээс хол доогуур */
const MODEL_LIMIT = 1_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Build үед DB байхгүй (Docker) — тэр үед статик хуудсуудаа өгөөд, эхний
  // revalidate дээр бүтнээр нь дахин үүсгэнэ. Sitemap-ийн улмаас deploy унах ёсгүй.
  try {
    return await cachedSitemap();
  } catch (e) {
    console.warn(`⚠ sitemap: DB-гүй үүсгэв — ${(e as Error).message.slice(0, 120)}`);
    return sitemapEntries({ siteUrl: siteUrl() });
  }
}

/** Өдөрт нэг удаа — sitemap нь тэр чигтээ шинэ байх шаардлагагүй */
const cachedSitemap = memoTtl(fullSitemap, { name: "sitemap", ttlMs: TTL.guide, max: 1 });

async function fullSitemap(): Promise<MetadataRoute.Sitemap> {
  const { plannedPairs } = await import("@/compare/queries");
  const { cardSlugs } = await import("@/gallery/queries");
  const [articles, guides, prompts, tools, models, useCases, pairs, cards] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, publishedAt: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.guide.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.prompt.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.tool.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { upvotes: "desc" },
    }),
    prisma.aiModel.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: MODEL_LIMIT,
    }),
    prisma.useCase.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { order: "asc" },
    }),
    plannedPairs(),
    cardSlugs(),
  ]);

  return sitemapEntries({
    siteUrl: siteUrl(), articles, guides, prompts, tools, models, useCases, pairs, cards,
  });
}
