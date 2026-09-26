"use server";

/**
 * Хадгалах/хасах — server action.
 *
 * Нэвтрээгүй бол /nevtreh руу буцах хаягтай нь илгээнэ.
 */
import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth/session";
import { toggleBookmarkFor, type BookmarkTarget } from "./queries";
import { cuid, internalPath, parseArg, tryParse, z } from "@/lib/validate";

/**
 * Зорилтот объект: ЯГ нэг талбар байх ёстой (DB дээрх CHECK-тэй ижил дүрэм).
 * Хэрэглэгч гараас хоёуланг нь илгээвэл аль нь болохыг таахгүй, татгалзана.
 */
const target = z
  .object({
    articleId: cuid.optional(),
    guideId: cuid.optional(),
    promptId: cuid.optional(),
    toolId: cuid.optional(),
  })
  .refine((t) => Object.values(t).filter(Boolean).length === 1, "нэг зорилт сонгоно уу");

export interface ToggleResult {
  saved: boolean;
  error?: string;
}

/**
 * Хадгалсан бол хасна, үгүй бол хадгална. Идемпотент: давхар дарахад алдаа гарахгүй.
 * @param path Хуудсыг шинэчлэх зам (жагсаалт, профайл)
 */
export async function toggleBookmark(rawTarget: BookmarkTarget, path?: string): Promise<ToggleResult> {
  // `path` нь revalidatePath-д очих тул дотоод зам гэдгийг баталгаажуулна
  const safePath = tryParse(internalPath, path) ?? undefined;

  const user = await currentUser();
  if (!user) redirect(`/nevtreh?ur=${encodeURIComponent(safePath ?? "/medee")}`);

  // refine нь яг нэг талбартайг баталгаажуулсан тул BookmarkTarget-д тохирно
  const checked = parseArg(target, rawTarget, "хадгалах зорилт") as BookmarkTarget;
  const saved = await toggleBookmarkFor(user.id, checked);
  if (safePath) revalidatePath(safePath);
  return { saved };
}
