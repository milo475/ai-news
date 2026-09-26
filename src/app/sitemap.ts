import type { MetadataRoute } from "next";
import { prisma } from "@/db";
import { sitemapEntries } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";

/** Өдөрт нэг удаа дахин үүсгэнэ — sitemap нь тэр чигтээ шинэ байх шаардлагагүй */
export const revalidate = 86_400;

/** Google нэг sitemap-д 50 000 хаяг зөвшөөрдөг; бид түүнээс хол доогуур */
const MODEL_LIMIT = 1_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { plannedPairs } = await import("@/compare/queries");
  const [articles, guides, prompts, tools, models, useCases, pairs] = await Promise.all([
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
  ]);

  return sitemapEntries({
    siteUrl: siteUrl(), articles, guides, prompts, tools, models, useCases, pairs,
  });
}
