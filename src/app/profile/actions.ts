"use server";

/** Профайлын үйлдлүүд */
import { revalidatePath } from "next/cache";
import type { FormState } from "@/auth/actions";
import { checkPassword, verifyPassword } from "@/auth/password";
import { requireUser } from "@/auth/session";
import { setPassword } from "@/auth/users";
import { prisma } from "@/db";

/** Нууц үг солих. Нууц үгтэй хэрэглэгч одоогийнхоо нууц үгийг оруулна. */
export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");

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
