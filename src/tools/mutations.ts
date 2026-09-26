/**
 * Каталогийн бичих үйлдлүүд — товшилт, upvote, шүүмж, дүнгийн шинэчлэл.
 */
import { prisma } from "../db";
import { slugify } from "../agent/slug";
import { ubDateLabel } from "../jobs/day";
import { isUniqueViolation } from "../bookmarks/queries";
import { averageStars } from "./tool.api";

/**
 * Вэбсайт/affiliate товшилтыг өдрөөр тоолно.
 *
 * Тоолуур унасан нь хэрэглэгчийг сайт руу явахад саад болох ёсгүй.
 */
export async function countClick(toolId: string, now = new Date()): Promise<void> {
  const day = ubDateLabel(now);
  try {
    await prisma.toolClick.upsert({
      where: { toolId_day: { toolId, day } },
      create: { toolId, day, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    // тоолуур чухал биш
  }
}

/**
 * Upvote — нэвтэрсэн хэрэглэгч. Дахин дарвал буцаана (идемпотент).
 *
 * `upvotes` баганыг increment биш, ToolUpvote-ийн бодит тооноос дахин бодно —
 * зэрэг дарахад тоолуур бодит байдлаас салахгүй.
 */
export async function toggleUpvote(userId: string, toolId: string): Promise<boolean> {
  const existing = await prisma.toolUpvote.findUnique({
    where: { userId_toolId: { userId, toolId } },
    select: { toolId: true },
  });

  if (existing) {
    await prisma.toolUpvote.deleteMany({ where: { userId, toolId } });
    await syncUpvotes(toolId);
    return false;
  }

  try {
    await prisma.toolUpvote.create({ data: { userId, toolId } });
  } catch (e) {
    if (isUniqueViolation(e)) return true;
    throw e;
  }
  await syncUpvotes(toolId);
  return true;
}

async function syncUpvotes(toolId: string): Promise<void> {
  const upvotes = await prisma.toolUpvote.count({ where: { toolId } });
  await prisma.tool.update({ where: { id: toolId }, data: { upvotes } });
}

/** Хэрэглэгч ямар хэрэгслийг upvote-лосон бэ */
export async function upvotedToolIds(userId: string, toolIds: string[]): Promise<Set<string>> {
  if (toolIds.length === 0) return new Set();
  const rows = await prisma.toolUpvote.findMany({
    where: { userId, toolId: { in: toolIds } },
    select: { toolId: true },
  });
  return new Set(rows.map((r) => r.toolId));
}

/** Хэрэгслийн дүн — нийтлэгдсэн шүүмжүүдээс дахин бодно (increment биш) */
export async function syncRating(toolId: string): Promise<{ rating: number; reviewCount: number }> {
  const rows = await prisma.toolReview.findMany({
    where: { toolId, status: "PUBLISHED" },
    select: { stars: true },
  });
  const rating = averageStars(rows.map((r) => r.stars));
  const reviewCount = rows.length;
  await prisma.tool.update({ where: { id: toolId }, data: { rating, reviewCount } });
  return { rating, reviewCount };
}

export interface NewReview {
  toolId: string;
  userId: string;
  stars: number;
  text: string | null;
  status: "PENDING" | "PUBLISHED";
  rejectReason: string | null;
}

/**
 * Шүүмж үүсгэх/шинэчлэх. Нэг хэрэглэгч нэг хэрэгсэлд нэг шүүмж —
 * дахин бичвэл хуучныг шинэчилнэ.
 */
export async function upsertReview(r: NewReview): Promise<{ id: string; status: string }> {
  const row = await prisma.toolReview.upsert({
    where: { toolId_userId: { toolId: r.toolId, userId: r.userId } },
    create: {
      toolId: r.toolId, userId: r.userId, stars: r.stars, text: r.text,
      status: r.status, rejectReason: r.rejectReason,
    },
    update: { stars: r.stars, text: r.text, status: r.status, rejectReason: r.rejectReason },
    select: { id: true, status: true },
  });
  await syncRating(r.toolId);
  return row;
}

export async function deleteReview(userId: string, toolId: string): Promise<void> {
  await prisma.toolReview.deleteMany({ where: { userId, toolId } });
  await syncRating(toolId);
}

/** Давхардвал -2, -3 ... залгана */
export async function uniqueToolSlug(base: string, toolId?: string): Promise<string> {
  let slug = base || "heregsel";
  for (let n = 2; ; n++) {
    const taken = await prisma.tool.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === toolId) return slug;
    slug = `${base.replace(/-\d+$/, "")}-${n}`;
  }
}

export interface NewTool {
  name: string;
  website: string;
  categories: string[];
  submittedByUserId: string;
}

/** Хэрэглэгчийн санал болгосон хэрэгсэл — PENDING */
export async function createUserTool(
  input: NewTool,
  enriched: {
    tagline: string;
    descriptionMd: string;
    categories: string[];
    pricing: string;
    priceFrom: number;
    platforms: string[];
    mongolianSupport: string;
    mnNoteMd: string;
  } | null,
): Promise<{ id: string; slug: string }> {
  const slug = await uniqueToolSlug(slugify(input.name));
  try {
    return await prisma.tool.create({
      data: {
        slug,
        name: input.name,
        website: input.website,
        // LLM бүтэхгүй байсан ч бичлэг үлдэнэ — админ гараар бөглөнө
        tagline: enriched?.tagline ?? input.name,
        descriptionMd: enriched?.descriptionMd ?? "",
        categories: (enriched?.categories ?? input.categories) as never,
        pricing: (enriched?.pricing ?? "FREEMIUM") as never,
        priceFrom: enriched?.priceFrom ? enriched.priceFrom : null,
        platforms: enriched?.platforms ?? ["web"],
        mongolianSupport: (enriched?.mongolianSupport ?? "PARTIAL") as never,
        mnNoteMd: enriched?.mnNoteMd ?? null,
        status: "PENDING",
        source: "USER",
        submittedByUserId: input.submittedByUserId,
      },
      select: { id: true, slug: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Хоёр хэрэглэгч зэрэг ижил нэрээр илгээвэл slug дахин авна
      const retry = await uniqueToolSlug(`${slugify(input.name)}-2`);
      return prisma.tool.create({
        data: {
          slug: retry, name: input.name, website: input.website,
          tagline: enriched?.tagline ?? input.name,
          descriptionMd: enriched?.descriptionMd ?? "",
          categories: (enriched?.categories ?? input.categories) as never,
          pricing: "FREEMIUM", platforms: ["web"], status: "PENDING", source: "USER",
          submittedByUserId: input.submittedByUserId,
        },
        select: { id: true, slug: true },
      });
    }
    throw e;
  }
}

/** Хэрэглэгч өнөөдөр хэдэн хэрэгсэл илгээсэн бэ (өдрийн хязгаарт) */
export async function submittedToolsToday(userId: string, now = new Date()): Promise<number> {
  const { ubDayRange } = await import("../jobs/day");
  const { start, end } = ubDayRange(now);
  return prisma.tool.count({
    where: { submittedByUserId: userId, createdAt: { gte: start, lt: end } },
  });
}
