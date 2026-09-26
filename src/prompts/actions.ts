"use server";

/**
 * Prompt-ын server action-ууд.
 */
import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { currentUser, requireVerified } from "@/auth/session";
import { AUTH_MESSAGES } from "@/auth/errors";
import { prisma } from "@/db";
import {
  checkSubmission, DAILY_SUBMIT_LIMIT, MAX_DESCRIPTION, PROMPT_CATEGORIES,
} from "./prompt.api";
import { canSubmit, countCopy, createUserPrompt, toggleLike } from "./mutations";
import type { PromptCategory } from "@/generated/prisma/enums";
import { cuid, internalPath, parseForm, tryParse, z } from "@/lib/validate";

/** «Хуулах» товч — нэвтрээгүй ч ажиллана, зөвхөн тоолуур нэмнэ */
export async function countCopyAction(promptId: string): Promise<void> {
  const id = tryParse(cuid, promptId);
  if (!id) return;
  await countCopy(id);
}

export interface LikeResult {
  liked: boolean;
}

/** Зүрх — нэвтрэхийг шаардана */
export async function likeAction(promptId: string, path?: string): Promise<LikeResult> {
  const safePath = tryParse(internalPath, path) ?? undefined;
  const user = await currentUser();
  if (!user) redirect(`/nevtreh?ur=${encodeURIComponent(safePath ?? "/prompt")}`);

  const id = tryParse(cuid, promptId);
  if (!id) return { liked: false };

  const liked = await toggleLike(user.id, id);
  if (safePath) revalidatePath(safePath);
  return { liked };
}

export interface SubmitState {
  error?: string;
  ok?: string;
  /** Татгалзсан бол шалтгаан */
  rejected?: string;
}

/**
 * Prompt илгээх. Баталгаажсан хэрэглэгч, өдөрт 5 хүртэл.
 * LLM илт муу гэж үзвэл шууд REJECTED, эс тэгвээс PENDING — админ баталгаажуулна.
 */
export async function submitPromptAction(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  let user;
  try {
    user = await requireVerified();
  } catch {
    return { error: AUTH_MESSAGES.unverified };
  }

  if (!(await canSubmit(user.id))) {
    return { error: `Өдөрт ${DAILY_SUBMIT_LIMIT} prompt илгээх боломжтой. Маргааш дахин оролдоно уу.` };
  }

  // Сервер тал нь UI-д юу байгаагаас хамаарахгүй — урт, төрлийг өөрөө шалгана
  const parsed = parseForm(
    z.object({
      title: z.string().trim().max(200),
      body: z.string().trim().max(10_000),
      description: z.string().trim().max(MAX_DESCRIPTION).default(""),
      category: z.string().trim().max(40).default(""),
    }),
    form,
  );
  if (!parsed.ok) return { error: parsed.error };
  const { title, body, description, category } = parsed.data;
  const tools = form
    .getAll("tools")
    .map(String)
    .map((t) => t.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 10);

  const problems = checkSubmission({ title, body, description, category });
  if (problems.length > 0) return { error: problems[0]!.detail };

  const { moderatePrompt } = await import("./moderate");
  const verdict = await moderatePrompt({ title, description, body });

  const created = await createUserPrompt(
    {
      title, body, description,
      category: (PROMPT_CATEGORIES as string[]).includes(category)
        ? (category as PromptCategory)
        : ((verdict.category ?? "BUSAD") as PromptCategory),
      tools,
      authorUserId: user.id,
    },
    verdict,
  );

  revalidatePath("/profile/prompt");
  if (created.status === "REJECTED") {
    return { rejected: verdict.rejectReason ?? "Автомат шалгалт татгалзлаа." };
  }
  return { ok: "Илгээлээ. Админ шалгаад нийтлэх бөгөөд «Миний prompt» хэсгээс төлөвийг харна." };
}

/** Хэрэглэгч өөрийн prompt-оо устгах */
export async function deleteMyPromptAction(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/nevtreh?ur=%2Fprofile%2Fprompt");

  const parsed = parseForm(z.object({ id: cuid }), form);
  if (!parsed.ok) return;
  // authorUserId-г where-т оруулснаар бусдын prompt-ыг устгах боломжгүй
  await prisma.prompt.deleteMany({ where: { id: parsed.data.id, authorUserId: user.id } });
  revalidatePath("/profile/prompt");
  revalidatePath("/prompt");
}
