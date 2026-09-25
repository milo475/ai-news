/**
 * Зааврын унших талын query-ууд.
 */
import { prisma } from "../db";
import type { GuideLevel } from "../generated/prisma/enums";
import type { Prisma } from "../generated/prisma/client";

export interface GuideCard {
  id: string;
  slug: string;
  title: string;
  lead: string;
  level: GuideLevel;
  audience: string[];
  tools: string[];
  readMinutes: number;
  hasHero: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface GuideDetail extends GuideCard {
  bodyMd: string;
  usecaseSlug: string | null;
  faq: FaqItem[];
  views: number;
}

export const guideCardSelect = {
  id: true, slug: true, title: true, lead: true, level: true, audience: true, tools: true,
  readMinutes: true, publishedAt: true, updatedAt: true, heroImageAt: true,
} as const;

type CardRow = Prisma.GuideGetPayload<{ select: typeof guideCardSelect }>;

export function toGuideCard(g: CardRow): GuideCard {
  const { heroImageAt, ...rest } = g;
  return { ...rest, hasHero: heroImageAt !== null };
}

/** faq баганад Json хадгалагддаг тул хэлбэрийг нь шалгаж авна */
export function parseFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { q, a } = item as { q?: unknown; a?: unknown };
    return typeof q === "string" && typeof a === "string" && q.trim() && a.trim()
      ? [{ q: q.trim(), a: a.trim() }]
      : [];
  });
}

export interface GuideFilters {
  level?: GuideLevel;
  audience?: string;
  tool?: string;
}

/** Нийтлэгдсэн зааврууд, шүүлтүүртэй */
export async function listGuides(f: GuideFilters = {}, limit?: number): Promise<GuideCard[]> {
  const rows = await prisma.guide.findMany({
    where: {
      status: "PUBLISHED",
      ...(f.level ? { level: f.level } : {}),
      ...(f.audience ? { audience: { has: f.audience } } : {}),
      ...(f.tool ? { tools: { has: f.tool } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: guideCardSelect,
  });
  return rows.map(toGuideCard);
}

/** Шүүлтүүрийн сонголтууд — байгаа өгөгдлөөс л бүрдэнэ */
export async function guideFacets(): Promise<{ levels: GuideLevel[]; audiences: string[]; tools: string[] }> {
  const rows = await prisma.guide.findMany({
    where: { status: "PUBLISHED" },
    select: { level: true, audience: true, tools: true },
  });
  const levels = new Set<GuideLevel>();
  const audiences = new Set<string>();
  const tools = new Set<string>();
  for (const r of rows) {
    levels.add(r.level);
    for (const a of r.audience) audiences.add(a);
    for (const t of r.tools) tools.add(t);
  }
  return {
    levels: [...levels],
    audiences: [...audiences].sort((a, b) => a.localeCompare(b, "mn")),
    tools: [...tools].sort((a, b) => a.localeCompare(b, "mn")),
  };
}

export async function getGuide(slug: string): Promise<GuideDetail | null> {
  const g = await prisma.guide.findUnique({
    where: { slug },
    select: { ...guideCardSelect, status: true, bodyMd: true, usecaseSlug: true, faq: true, views: true },
  });
  if (!g || g.status !== "PUBLISHED") return null;
  const { status: _status, faq, bodyMd, usecaseSlug, views, ...card } = g;
  return { ...toGuideCard(card), bodyMd, usecaseSlug, views, faq: parseFaq(faq) };
}

/**
 * Холбоотой 3 заавар: эхлээд ижил хэрэглээний ангилал, дараа нь ижил хэрэгсэл,
 * дутвал сүүлийн үеийнхээр гүйцээнэ.
 */
export async function relatedGuides(g: GuideDetail, limit = 3): Promise<GuideCard[]> {
  const picked = new Map<string, GuideCard>();
  const add = (rows: CardRow[]) => {
    for (const r of rows) {
      if (r.id !== g.id && picked.size < limit) picked.set(r.id, toGuideCard(r));
    }
  };

  const base = { status: "PUBLISHED", id: { not: g.id } } as const;
  if (g.usecaseSlug) {
    add(await prisma.guide.findMany({
      where: { ...base, usecaseSlug: g.usecaseSlug }, take: limit, select: guideCardSelect,
      orderBy: { publishedAt: "desc" },
    }));
  }
  if (picked.size < limit && g.tools.length > 0) {
    add(await prisma.guide.findMany({
      where: { ...base, tools: { hasSome: g.tools } }, take: limit, select: guideCardSelect,
      orderBy: { publishedAt: "desc" },
    }));
  }
  if (picked.size < limit) {
    add(await prisma.guide.findMany({
      where: base, take: limit, select: guideCardSelect, orderBy: { publishedAt: "desc" },
    }));
  }
  return [...picked.values()];
}

/** Нүүрний "Шинэ заавар" блок */
export async function latestGuides(limit = 3): Promise<GuideCard[]> {
  return listGuides({}, limit);
}
