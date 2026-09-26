/**
 * Prompt санг унших query-ууд.
 */
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import type { PromptCategory, PromptLanguage, PromptStatus } from "../generated/prisma/enums";
import { pickOfDay, type Sort } from "./prompt.api";
import { memoTtl, TTL } from "../lib/cache.api";

export interface PromptCard {
  id: string;
  slug: string;
  title: string;
  /** Жагсаалтын «Хуулах» товч бодит текстийг хуулдаг тул картад ч хэрэгтэй */
  body: string;
  description: string;
  category: PromptCategory;
  tools: string[];
  language: PromptLanguage;
  variables: string[];
  copies: number;
  likes: number;
  publishedAt: Date | null;
}

export interface PromptDetail extends PromptCard {
  authorName: string | null;
  isSite: boolean;
  updatedAt: Date;
}

export const promptCardSelect = {
  id: true, slug: true, title: true, body: true, description: true, category: true, tools: true,
  language: true, variables: true, copies: true, likes: true, publishedAt: true,
} as const;

type CardRow = Prisma.PromptGetPayload<{ select: typeof promptCardSelect }>;

export function toPromptCard(p: CardRow): PromptCard {
  return p;
}

export interface PromptFilters {
  category?: PromptCategory;
  tool?: string;
  language?: PromptLanguage;
  sort?: Sort;
}

const ORDER: Record<Sort, Prisma.PromptOrderByWithRelationInput[]> = {
  shine: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  huulsan: [{ copies: "desc" }, { publishedAt: "desc" }],
  taalagdsan: [{ likes: "desc" }, { publishedAt: "desc" }],
};

async function listPromptsUncached(f: PromptFilters = {}, limit?: number): Promise<PromptCard[]> {
  const rows = await prisma.prompt.findMany({
    where: {
      status: "PUBLISHED",
      ...(f.category ? { category: f.category } : {}),
      ...(f.tool ? { tools: { has: f.tool } } : {}),
      ...(f.language ? { language: f.language } : {}),
    },
    orderBy: ORDER[f.sort ?? "shine"],
    take: limit,
    select: promptCardSelect,
  });
  return rows.map(toPromptCard);
}

/** Шүүлтүүрийн сонголтууд — байгаа өгөгдлөөс */
async function promptFacetsUncached(): Promise<{
  categories: PromptCategory[];
  tools: string[];
  languages: PromptLanguage[];
}> {
  const rows = await prisma.prompt.findMany({
    where: { status: "PUBLISHED" },
    select: { category: true, tools: true, language: true },
  });
  const categories = new Set<PromptCategory>();
  const tools = new Set<string>();
  const languages = new Set<PromptLanguage>();
  for (const r of rows) {
    categories.add(r.category);
    languages.add(r.language);
    for (const t of r.tools) tools.add(t);
  }
  return {
    categories: [...categories],
    tools: [...tools].sort((a, b) => a.localeCompare(b, "mn")),
    languages: [...languages],
  };
}

async function getPromptUncached(slug: string): Promise<PromptDetail | null> {
  const p = await prisma.prompt.findUnique({
    where: { slug },
    select: {
      ...promptCardSelect, status: true, source: true, updatedAt: true,
      author: { select: { name: true } },
    },
  });
  if (!p || p.status !== "PUBLISHED") return null;
  const { status: _status, source, author, ...rest } = p;
  return { ...rest, authorName: author?.name ?? null, isSite: source === "SITE" };
}

/** Холбоотой prompt: эхлээд ижил ангилал, дутвал ижил хэрэгсэл */
async function relatedPromptsUncached(p: PromptDetail, limit = 4): Promise<PromptCard[]> {
  const picked = new Map<string, PromptCard>();
  const add = (rows: CardRow[]) => {
    for (const r of rows) if (r.id !== p.id && picked.size < limit) picked.set(r.id, toPromptCard(r));
  };
  const base = { status: "PUBLISHED", id: { not: p.id } } as const;

  add(await prisma.prompt.findMany({
    where: { ...base, category: p.category }, take: limit,
    orderBy: [{ copies: "desc" }], select: promptCardSelect,
  }));
  if (picked.size < limit && p.tools.length > 0) {
    add(await prisma.prompt.findMany({
      where: { ...base, tools: { hasSome: p.tools } }, take: limit,
      orderBy: [{ copies: "desc" }], select: promptCardSelect,
    }));
  }
  if (picked.size < limit) {
    add(await prisma.prompt.findMany({
      where: base, take: limit, orderBy: [{ publishedAt: "desc" }], select: promptCardSelect,
    }));
  }
  return [...picked.values()];
}

/** Prompt-ын хэрэгслүүдтэй давхцах заавар */
async function guidesForPromptUncached(tools: string[], limit = 2) {
  if (tools.length === 0) return [];
  const { guideCardSelect, toGuideCard } = await import("../guides/queries");
  const rows = await prisma.guide.findMany({
    where: { status: "PUBLISHED", tools: { hasSome: tools } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: guideCardSelect,
  });
  return rows.map(toGuideCard);
}

/**
 * Нүүрний «Өнөөдрийн prompt» — likes + copies-оор эрэмбэлсэн шилдгүүдээс
 * өдрийн дугаараар ээлжилнэ (өдөр бүр өөр нэг нь гарна).
 */
export async function promptOfTheDay(pool = 20, day = new Date()): Promise<PromptCard | null> {
  const rows = await prisma.prompt.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ likes: "desc" }, { copies: "desc" }, { createdAt: "desc" }],
    take: pool,
    select: promptCardSelect,
  });
  const picked = pickOfDay(rows, day);
  return picked ? toPromptCard(picked) : null;
}

/** Профайлын «Миний prompt» таб — бүх төлөвтэйгээ */
export async function myPrompts(userId: string) {
  return prisma.prompt.findMany({
    where: { authorUserId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, description: true, category: true, status: true,
      rejectReason: true, copies: true, likes: true, createdAt: true, publishedAt: true,
    },
  });
}

/** Хэрэглэгч тухайн prompt-уудаас алийг нь таалсан бэ */
export async function likedPromptIds(userId: string, promptIds: string[]): Promise<Set<string>> {
  if (promptIds.length === 0) return new Set();
  const rows = await prisma.promptLike.findMany({
    where: { userId, promptId: { in: promptIds } },
    select: { promptId: true },
  });
  return new Set(rows.map((r) => r.promptId));
}

/** Тухайн төлөвийн тоо — /admin-ийн тэмдэглэгээнд */
export async function promptCounts(): Promise<Record<PromptStatus, number>> {
  const rows = await prisma.prompt.groupBy({ by: ["status"], _count: true });
  const out: Record<PromptStatus, number> = { PENDING: 0, PUBLISHED: 0, REJECTED: 0 };
  for (const r of rows) out[r.status] = r._count;
  return out;
}

/** Prompt-ийн жагсаалт */
export const listPrompts: typeof listPromptsUncached = memoTtl(listPromptsUncached, { name: "listPrompts", ttlMs: TTL.list });

/** Шүүлтүүрийн утгууд */
export const promptFacets: typeof promptFacetsUncached = memoTtl(promptFacetsUncached, { name: "promptFacets", ttlMs: TTL.list });

/** Prompt-ийн дэлгэрэнгүй */
export const getPrompt: typeof getPromptUncached = memoTtl(getPromptUncached, { name: "getPrompt", ttlMs: TTL.list });

/** Холбоотой prompt-ууд */
export const relatedPrompts: typeof relatedPromptsUncached = memoTtl(relatedPromptsUncached, { name: "relatedPrompts", ttlMs: TTL.list, key: (p, limit = 4) => `${p.slug}:${limit}` });

/** Prompt-д тохирох заавар */
export const guidesForPrompt: typeof guidesForPromptUncached = memoTtl(guidesForPromptUncached, { name: "guidesForPrompt", ttlMs: TTL.list });
