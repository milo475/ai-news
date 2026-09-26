/**
 * Каталогийн унших query-ууд.
 */
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import type { MongolianSupport, ToolCategory, ToolPlan } from "../generated/prisma/enums";
import { popularity, type ToolSort } from "./tool.api";

export interface ToolCard {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categories: ToolCategory[];
  pricing: ToolPlan;
  priceFrom: number | null;
  mongolianSupport: MongolianSupport;
  platforms: string[];
  rating: number;
  reviewCount: number;
  upvotes: number;
  hasLogo: boolean;
}

export const toolCardSelect = {
  id: true, slug: true, name: true, tagline: true, categories: true, pricing: true,
  priceFrom: true, mongolianSupport: true, platforms: true, rating: true, reviewCount: true,
  upvotes: true, logoAt: true,
} as const;

type CardRow = Prisma.ToolGetPayload<{ select: typeof toolCardSelect }>;

export function toToolCard(t: CardRow): ToolCard {
  const { logoAt, ...rest } = t;
  return { ...rest, hasLogo: logoAt !== null };
}

export interface ToolFilters {
  category?: ToolCategory;
  pricing?: ToolPlan;
  mongolianSupport?: MongolianSupport;
  platform?: string;
  sort?: ToolSort;
}

function where(f: ToolFilters): Prisma.ToolWhereInput {
  return {
    status: "PUBLISHED",
    ...(f.category ? { categories: { has: f.category } } : {}),
    ...(f.pricing ? { pricing: f.pricing } : {}),
    ...(f.mongolianSupport ? { mongolianSupport: f.mongolianSupport } : {}),
    ...(f.platform ? { platforms: { has: f.platform } } : {}),
  };
}

/**
 * Нийтлэгдсэн хэрэгслүүд.
 *
 * «Алдартай» эрэмбэ нь товшилтыг оруулдаг тул DB-д эрэмбэлж болохгүй — 30 хоногийн
 * товшилтыг тоолоод кодод эрэмбэлнэ.
 */
export async function listTools(f: ToolFilters = {}, limit?: number): Promise<ToolCard[]> {
  const sort = f.sort ?? "aldartai";

  if (sort !== "aldartai") {
    const rows = await prisma.tool.findMany({
      where: where(f),
      orderBy:
        sort === "shine"
          ? [{ publishedAt: "desc" }, { createdAt: "desc" }]
          : [{ rating: "desc" }, { reviewCount: "desc" }],
      take: limit,
      select: toolCardSelect,
    });
    return rows.map(toToolCard);
  }

  const rows = await prisma.tool.findMany({
    where: where(f),
    orderBy: { upvotes: "desc" },
    select: toolCardSelect,
  });
  const clicks = await clicksByTool(rows.map((r) => r.id));
  const sorted = rows
    .map((r) => ({ row: r, score: popularity(r.upvotes, clicks.get(r.id) ?? 0) }))
    .sort((a, b) => b.score - a.score || b.row.rating - a.row.rating)
    .map((x) => toToolCard(x.row));
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Сүүлийн 30 хоногийн товшилтын нийлбэр, хэрэгсэл тус бүрээр */
export async function clicksByTool(toolIds: string[], days = 30): Promise<Map<string, number>> {
  if (toolIds.length === 0) return new Map();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await prisma.toolClick.groupBy({
    by: ["toolId"],
    where: { toolId: { in: toolIds }, day: { gte: since } },
    _sum: { count: true },
  });
  return new Map(rows.map((r) => [r.toolId, r._sum.count ?? 0]));
}

/** Шүүлтүүрийн сонголтууд — байгаа өгөгдлөөс */
export async function toolFacets(): Promise<{
  categories: ToolCategory[];
  pricings: ToolPlan[];
  supports: MongolianSupport[];
  platforms: string[];
}> {
  const rows = await prisma.tool.findMany({
    where: { status: "PUBLISHED" },
    select: { categories: true, pricing: true, mongolianSupport: true, platforms: true },
  });
  const categories = new Set<ToolCategory>();
  const pricings = new Set<ToolPlan>();
  const supports = new Set<MongolianSupport>();
  const platforms = new Set<string>();
  for (const r of rows) {
    for (const c of r.categories) categories.add(c);
    pricings.add(r.pricing);
    supports.add(r.mongolianSupport);
    for (const p of r.platforms) platforms.add(p);
  }
  return {
    categories: [...categories],
    pricings: [...pricings],
    supports: [...supports],
    platforms: [...platforms],
  };
}

export interface ToolReviewCard {
  id: string;
  stars: number;
  text: string | null;
  authorName: string | null;
  createdAt: Date;
}

export interface ToolDetail extends ToolCard {
  descriptionMd: string;
  website: string;
  affiliateUrl: string | null;
  mnNoteMd: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
  alternatives: ToolCard[];
  guides: { slug: string; title: string; lead: string; readMinutes: number }[];
  prompts: { slug: string; title: string; description: string }[];
  reviews: ToolReviewCard[];
}

export async function getTool(slug: string): Promise<ToolDetail | null> {
  const t = await prisma.tool.findUnique({
    where: { slug },
    select: {
      ...toolCardSelect, status: true, descriptionMd: true, website: true, affiliateUrl: true,
      mnNoteMd: true, updatedAt: true, publishedAt: true,
      alternativesTo: { where: { status: "PUBLISHED" }, select: toolCardSelect, take: 6 },
      alternativeOf: { where: { status: "PUBLISHED" }, select: toolCardSelect, take: 6 },
      relatedGuides: {
        where: { status: "PUBLISHED" },
        select: { slug: true, title: true, lead: true, readMinutes: true },
        take: 3,
      },
      relatedPrompts: {
        where: { status: "PUBLISHED" },
        select: { slug: true, title: true, description: true },
        take: 4,
      },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, stars: true, text: true, createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
  });
  if (!t || t.status !== "PUBLISHED") return null;

  const {
    status: _status, alternativesTo, alternativeOf, relatedGuides, relatedPrompts, reviews, ...rest
  } = t;

  // Хувилбарын холбоос тэгш тул хоёр талыг нэгтгэнэ
  const alts = new Map<string, CardRow>();
  for (const a of [...alternativesTo, ...alternativeOf]) alts.set(a.id, a);

  return {
    ...toToolCard(rest),
    descriptionMd: t.descriptionMd,
    website: t.website,
    affiliateUrl: t.affiliateUrl,
    mnNoteMd: t.mnNoteMd,
    updatedAt: t.updatedAt,
    publishedAt: t.publishedAt,
    alternatives: [...alts.values()].map(toToolCard),
    guides: relatedGuides,
    prompts: relatedPrompts,
    reviews: reviews.map((r) => ({
      id: r.id, stars: r.stars, text: r.text, authorName: r.user?.name ?? null, createdAt: r.createdAt,
    })),
  };
}

/** Харьцуулалтын хуудсанд — хоёр хэрэгслийн бүтэн мэдээлэл */
export async function getToolsForVersus(a: string, b: string): Promise<[ToolDetail, ToolDetail] | null> {
  const [first, second] = await Promise.all([getTool(a), getTool(b)]);
  return first && second ? [first, second] : null;
}

/** Тухайн ангиллын топ хэрэгслүүд — /hereglee хуудсанд холбоход */
export async function topToolsForCategory(category: ToolCategory, limit = 5): Promise<ToolCard[]> {
  return listTools({ category, sort: "aldartai" }, limit);
}

/** Хэрэглэгчийн өөрийн шүүмж (засахад) */
export async function myReview(userId: string, toolId: string) {
  return prisma.toolReview.findUnique({
    where: { toolId_userId: { toolId, userId } },
    select: { id: true, stars: true, text: true, status: true, rejectReason: true },
  });
}

/** Хэрэглэгч ямар хэрэгслийг хадгалсан бэ */
export async function bookmarkedToolIds(userId: string, toolIds: string[]): Promise<Set<string>> {
  if (toolIds.length === 0) return new Set();
  const rows = await prisma.bookmark.findMany({
    where: { userId, toolId: { in: toolIds } },
    select: { toolId: true },
  });
  return new Set(rows.flatMap((r) => (r.toolId ? [r.toolId] : [])));
}
