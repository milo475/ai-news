"use server";

/** Профайлын үйлдлүүд */
import { revalidatePath } from "@/lib/revalidate";
import type { FormState } from "@/auth/actions";
import { signOut } from "@/auth/config";
import { CATEGORIES } from "@/agent/category";
import { cleanCategories, cleanUsecases } from "@/bookmarks/preferences.api";
import { syncDigestEmail } from "@/bookmarks/digest-sync";
import { checkPassword, verifyPassword } from "@/auth/password";
import { requireUser } from "@/auth/session";
import { setPassword } from "@/auth/users";
import { prisma } from "@/db";
import { parseForm, z } from "@/lib/validate";

const passwordField = z.string().max(200, "Нууц үг хэтэрхий урт байна.");

/** Нууц үг солих. Нууц үгтэй хэрэглэгч одоогийнхоо нууц үгийг оруулна. */
export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseForm(
    z.object({ current: passwordField.default(""), password: passwordField }),
    form,
  );
  if (!parsed.ok) return { error: parsed.error };
  const { current, password: next } = parsed.data;

  const problems = checkPassword(next);
  if (problems.length) return { error: problems[0]!.detail };

  const db = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (db.passwordHash && !(await verifyPassword(current, db.passwordHash))) {
    return { error: "Одоогийн нууц үг буруу байна." };
  }

  await setPassword(user.email, next);
  revalidatePath("/profile");
  return { ok: "Нууц үг шинэчлэгдлээ." };
}

/** Нэр солих */
export async function saveNameAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseForm(
    z.object({
      name: z.string().trim().min(2, "Нэр 2-оос доошгүй тэмдэгт байх ёстой.").max(80, "Нэр хэтэрхий урт байна."),
    }),
    form,
  );
  if (!parsed.ok) return { error: parsed.error };
  const { name } = parsed.data;

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/profile");
  return { ok: "Нэр шинэчлэгдлээ." };
}

/** Сонирхлын тохиргоо — ангилал, хэрэглээ, долоо хоногийн имэйл */
export async function savePreferencesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const slugs = await prisma.useCase.findMany({ where: { isActive: true }, select: { slug: true } });
  // cleanCategories/cleanUsecases нь зөвшөөрөгдсөн утгуудтай тулгаж шүүдэг — дээр нь тоог хязгаарлана
  const categories = cleanCategories(
    form.getAll("categories").map(String).slice(0, 20), CATEGORIES,
  );
  const usecases = cleanUsecases(
    form.getAll("usecases").map(String).slice(0, 20), slugs.map((u) => u.slug),
  );
  const digestEmail = form.get("digestEmail") === "on";

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, categories, usecases, digestEmail },
    update: { categories, usecases, digestEmail },
  });

  // Долоо хоногийн имэйлийг Subscriber-тэй синк хийнэ
  await syncDigestEmail(user.id, user.email, digestEmail);

  revalidatePath("/profile/sonirhol");
  revalidatePath("/");
  return { ok: "Сонирхол хадгалагдлаа." };
}

/** Бүх төхөөрөмжөөс гарах — sessionVersion нэмэхэд хуучин JWT хүчингүй болно */
export async function signOutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  await signOut({ redirectTo: "/" });
}

/** Бүртгэл устгах — Bookmark, UserPreference (cascade) ба Subscriber хамт */
export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "УСТГАХ") {
    return { error: "Баталгаажуулахын тулд УСТГАХ гэж бичнэ үү." };
  }

  // Subscriber нь SetNull тул гараар устгана; Bookmark/Preference/Account/Session нь cascade
  await prisma.subscriber.deleteMany({ where: { OR: [{ userId: user.id }, { email: user.email }] } });
  await prisma.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/" });
  return {};
}
