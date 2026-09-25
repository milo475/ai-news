/**
 * Prompt-ын бичих үйлдлүүд — хуулалт тоолох, таалагдах, илгээх.
 */
import { prisma } from "../db";
import { slugify } from "../agent/slug";
import { ubDayRange } from "../jobs/day";
import { extractVariables, DAILY_SUBMIT_LIMIT } from "./prompt.api";
import { isUniqueViolation } from "../bookmarks/queries";
import type { PromptCategory } from "../generated/prisma/enums";

/** Хуулсан тоог нэмнэ. Тоолуур унасан нь хуулалтыг зогсоох ёсгүй. */
export async function countCopy(promptId: string): Promise<void> {
  try {
    await prisma.prompt.update({ where: { id: promptId }, data: { copies: { increment: 1 } } });
  } catch {
    // тоолуур чухал биш
  }
}

/** Таалагдсан/болиулсан — идемпотент. Буцаах утга: одоо таалагдсан эсэх. */
export async function toggleLike(userId: string, promptId: string): Promise<boolean> {
  const existing = await prisma.promptLike.findUnique({
    where: { userId_promptId: { userId, promptId } },
    select: { promptId: true },
  });

  if (existing) {
    const { count } = await prisma.promptLike.deleteMany({ where: { userId, promptId } });
    // Зэрэг дарахад хоёулаа устгахыг оролдвол нэг нь л тоолуурыг бууруулна
    if (count > 0) await syncLikes(promptId);
    return false;
  }

  try {
    await prisma.promptLike.create({ data: { userId, promptId } });
  } catch (e) {
    if (isUniqueViolation(e)) return true;
    throw e;
  }
  await syncLikes(promptId);
  return true;
}

/**
 * likes багана нь PromptLike-ийн бодит тоог тусгана.
 *
 * increment/decrement биш дахин тоолдог нь: зэрэг дарахад тоолуур бодит байдлаас
 * салахгүй, сөрөг тоо ч гарахгүй.
 */
async function syncLikes(promptId: string): Promise<void> {
  const likes = await prisma.promptLike.count({ where: { promptId } });
  await prisma.prompt.update({ where: { id: promptId }, data: { likes } });
}

/** Хэрэглэгч өнөөдөр хэдэн prompt илгээсэн бэ (УБ цагаар) */
export async function submittedToday(userId: string, now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.prompt.count({
    where: { authorUserId: userId, createdAt: { gte: start, lt: end } },
  });
}

export async function canSubmit(userId: string, now = new Date()): Promise<boolean> {
  return (await submittedToday(userId, now)) < DAILY_SUBMIT_LIMIT;
}

/** Давхардвал -2, -3 ... залгана */
export async function uniquePromptSlug(base: string, promptId?: string): Promise<string> {
  let slug = base || "prompt";
  for (let n = 2; ; n++) {
    const taken = await prisma.prompt.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === promptId) return slug;
    slug = `${base.replace(/-\d+$/, "")}-${n}`;
  }
}

export interface NewPrompt {
  title: string;
  body: string;
  description: string;
  category: PromptCategory;
  tools: string[];
  authorUserId: string;
}

/** Хэрэглэгчийн prompt-ыг үүсгэнэ (шалгалтын дараа төлөв нь тавигдана) */
export async function createUserPrompt(
  input: NewPrompt,
  verdict: { status: "PENDING" | "REJECTED"; rejectReason: string | null; language?: string },
): Promise<{ id: string; slug: string; status: string }> {
  const slug = await uniquePromptSlug(slugify(input.title));
  const language = verdict.language;

  return prisma.prompt.create({
    data: {
      slug,
      title: input.title,
      body: input.body,
      description: input.description,
      category: input.category,
      tools: input.tools,
      language: language === "EN" || language === "MIXED" ? language : "MN",
      variables: extractVariables(input.body),
      authorUserId: input.authorUserId,
      source: "USER",
      status: verdict.status,
      rejectReason: verdict.rejectReason,
    },
    select: { id: true, slug: true, status: true },
  });
}
