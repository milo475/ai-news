"use server";

/**
 * Хадгалах/хасах — server action.
 *
 * Нэвтрээгүй бол /nevtreh руу буцах хаягтай нь илгээнэ.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth/session";
import { toggleBookmarkFor, type BookmarkTarget } from "./queries";

export interface ToggleResult {
  saved: boolean;
  error?: string;
}

/**
 * Хадгалсан бол хасна, үгүй бол хадгална. Идемпотент: давхар дарахад алдаа гарахгүй.
 * @param path Хуудсыг шинэчлэх зам (жагсаалт, профайл)
 */
export async function toggleBookmark(target: BookmarkTarget, path?: string): Promise<ToggleResult> {
  const user = await currentUser();
  if (!user) redirect(`/nevtreh?ur=${encodeURIComponent(path ?? "/medee")}`);

  const saved = await toggleBookmarkFor(user.id, target);
  if (path) revalidatePath(path);
  return { saved };
}
