import type { MetadataRoute } from "next";
import { prisma } from "@/db";
import { sitemapEntries } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";

/** Өдөрт нэг удаа дахин үүсгэнэ — sitemap нь тэр чигтээ шинэ байх шаардлагагүй */
export const revalidate = 86_400;

/** Google нэг sitemap-д 50 000 хаяг зөвшөөрдөг; бид түүнээс хол доогуур */
const MODEL_LIMIT = 1_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, guides, prompts, models, useCases] = await Promise.all([
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
  ]);

  return sitemapEntries({ siteUrl: siteUrl(), articles, guides, prompts, models, useCases });
}
