"use server";

/**
 * Каталогийн server action-ууд.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser, requireVerified } from "@/auth/session";
import { AUTH_MESSAGES } from "@/auth/errors";
import {
  checkReview, checkToolSubmission, cleanCategories, DAILY_TOOL_LIMIT, MAX_REVIEW_TEXT,
  normalizeWebsite,
} from "./tool.api";
import {
  countClick, createUserTool, deleteReview, submittedToolsToday, toggleUpvote, upsertReview,
} from "./mutations";

/** «Вэбсайт руу» товшилт — нэвтрэхгүй ч ажиллана */
export async function countClickAction(toolId: string): Promise<void> {
  await countClick(toolId);
}

export interface UpvoteResult {
  upvoted: boolean;
}

export async function upvoteAction(toolId: string, path?: string): Promise<UpvoteResult> {
  const user = await currentUser();
  if (!user) redirect(`/nevtreh?ur=${encodeURIComponent(path ?? "/hereglel")}`);

  const upvoted = await toggleUpvote(user.id, toolId);
  if (path) revalidatePath(path);
  return { upvoted };
}

export interface ToolFormState {
  error?: string;
  ok?: string;
  rejected?: string;
}

/** Хэрэглэгч хэрэгсэл санал болгоно → PENDING, LLM автоматаар бөглөнө */
export async function submitToolAction(_prev: ToolFormState, form: FormData): Promise<ToolFormState> {
  let user;
  try {
    user = await requireVerified();
  } catch {
    return { error: AUTH_MESSAGES.unverified };
  }

  if ((await submittedToolsToday(user.id)) >= DAILY_TOOL_LIMIT) {
    return { error: `Өдөрт ${DAILY_TOOL_LIMIT} хэрэгсэл санал болгож болно. Маргааш дахин оролдоно уу.` };
  }

  const name = String(form.get("name") ?? "").trim();
  const websiteRaw = String(form.get("website") ?? "");
  const categories = form.getAll("categories").map(String);

  const problems = checkToolSubmission({ name, website: websiteRaw, categories });
  if (problems.length > 0) return { error: problems[0]!.detail };

  const website = normalizeWebsite(websiteRaw)!;

  // LLM унасан ч бичлэг үлдэнэ — админ гараар бөглөнө
  let enriched = null;
  try {
    const { enrichTool } = await import("./enrich");
    enriched = await enrichTool(name, website);
  } catch (e) {
    console.warn(`  ⚠ ${name}: LLM бөглөсөнгүй — ${(e as Error).message.slice(0, 120)}`);
  }

  const created = await createUserTool(
    { name, website, categories: cleanCategories(categories), submittedByUserId: user.id },
    enriched,
  );

  // Лого нь нэмэлт — бүтэхгүй байсан ч хэрэгсэл үлдэнэ
  try {
    const { saveLogo } = await import("./enrich");
    await saveLogo(created.id);
  } catch {
    // үсгэн avatar зурагдана
  }

  revalidatePath("/profile/prompt");
  return {
    ok: "Баярлалаа. Админ шалгаад нийтэлнэ — нийтлэгдмэгц каталогт харагдана.",
  };
}

/** Шүүмж бичих/шинэчлэх. Нэг хэрэглэгч нэг хэрэгсэлд нэг шүүмж. */
export async function reviewAction(_prev: ToolFormState, form: FormData): Promise<ToolFormState> {
  let user;
  try {
    user = await requireVerified();
  } catch {
    return { error: AUTH_MESSAGES.unverified };
  }

  const toolId = String(form.get("toolId") ?? "");
  const slug = String(form.get("slug") ?? "");
  const stars = Number(form.get("stars") ?? 0);
  const text = String(form.get("text") ?? "").trim().slice(0, MAX_REVIEW_TEXT);

  const problems = checkReview(stars, text);
  if (problems.length > 0) return { error: problems[0]!.detail };

  // Текстгүй, зөвхөн одтой шүүмжийг шалгах шаардлагагүй — moderation зөвхөн текст дээр
  let status: "PENDING" | "PUBLISHED" = "PUBLISHED";
  let rejectReason: string | null = null;
  if (text) {
    const { moderatePrompt } = await import("@/prompts/moderate");
    const verdict = await moderatePrompt({ title: `Шүүмж: ${slug}`, description: "", body: text });
    if (verdict.status === "REJECTED") {
      status = "PENDING";
      rejectReason = verdict.rejectReason;
    }
  }

  await upsertReview({ toolId, userId: user.id, stars, text: text || null, status, rejectReason });

  if (slug) revalidatePath(`/hereglel/${slug}`);
  revalidatePath("/hereglel");

  return rejectReason
    ? { rejected: `${rejectReason} — админ гараар хянана.` }
    : { ok: "Шүүмж нэмэгдлээ. Баярлалаа." };
}

export async function deleteReviewAction(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/nevtreh?ur=%2Fhereglel");

  const toolId = String(form.get("toolId") ?? "");
  const slug = String(form.get("slug") ?? "");
  await deleteReview(user.id, toolId);
  if (slug) revalidatePath(`/hereglel/${slug}`);
}
