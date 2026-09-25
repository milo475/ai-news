"use server";

/**
 * Бүртгэл, нэвтрэлт, нууц үг сэргээх server action-ууд.
 *
 * Аюулгүй байдал: IP-ээр хязгаарлана, алдааг ерөнхий мессежээр буцаана
 * (имэйл бүртгэлтэй эсэхийг задруулахгүй).
 */
import { AuthError as NextAuthError } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { emailSchema } from "@/newsletter/subscribe";
import { subscribe } from "@/newsletter/subscribe";
import { GENERIC_LOGIN_ERROR, signIn } from "./config";
import { sendResetEmail, sendVerifyEmail } from "./mail";
import { checkPassword } from "./password";
import { allowLogin, allowRegister, allowReset } from "./rate-limit";
import { createToken, useToken } from "./tokens";
import { createUser, markVerified, setPassword } from "./users";

export interface FormState {
  error?: string;
  ok?: string;
}

const TOO_MANY = "Хэт олон оролдлого боллоо. Хэсэг хүлээгээд дахин оролдоно уу.";

function email(raw: FormDataEntryValue | null): string | null {
  const parsed = emailSchema.safeParse(String(raw ?? ""));
  return parsed.success ? parsed.data : null;
}

/** Нэвтрэх — амжилттай бол redirect, үгүй бол ерөнхий алдаа */
export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowLogin())) return { error: TOO_MANY };

  const mail = email(form.get("email"));
  const password = String(form.get("password") ?? "");
  if (!mail || !password) return { error: GENERIC_LOGIN_ERROR };

  try {
    await signIn("credentials", { email: mail, password, redirectTo: "/profile" });
  } catch (e) {
    // signIn нь амжилттай үед NEXT_REDIRECT шидэх тул түүнийг дамжуулна
    if (e instanceof NextAuthError) return { error: GENERIC_LOGIN_ERROR };
    throw e;
  }
  return {};
}

/** Бүртгүүлэх → баталгаажуулах холбоос илгээнэ */
export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowRegister())) return { error: TOO_MANY };

  const mail = email(form.get("email"));
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const wantsNewsletter = form.get("newsletter") === "on";

  if (!mail) return { error: "Имэйл хаяг буруу байна." };
  if (name.length < 2) return { error: "Нэрээ оруулна уу." };
  const passwordProblems = checkPassword(password);
  if (passwordProblems.length) return { error: passwordProblems[0]!.detail };

  const user = await createUser({ email: mail, name, password });
  if (!user) {
    // Имэйл бүртгэлтэй эсэхийг задруулахгүй — нэвтрэх санал болгоно
    return { error: "Энэ имэйлээр бүртгүүлэх боломжгүй байна. Нэвтрэхийг оролдоно уу." };
  }

  if (wantsNewsletter) await subscribe(mail);
  await sendVerifyEmail(mail, await createToken("verify", mail), name);

  redirect(`/nevtreh?burtgel=1&mail=${encodeURIComponent(mail)}`);
}

/** Баталгаажуулах холбоосыг дахин илгээх */
export async function resendVerifyAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowReset())) return { error: TOO_MANY };
  const mail = email(form.get("email"));
  if (!mail) return { error: "Имэйл хаяг буруу байна." };

  const user = await prisma.user.findUnique({
    where: { email: mail },
    select: { name: true, emailVerifiedAt: true },
  });
  if (user && !user.emailVerifiedAt) {
    await sendVerifyEmail(mail, await createToken("verify", mail), user.name);
  }
  // Бүртгэлтэй эсэхийг задруулахгүй — үргэлж ижил хариу
  return { ok: "Хэрэв энэ хаяг бүртгэлтэй бол баталгаажуулах холбоос илгээлээ." };
}

/** Нууц үг сэргээх хүсэлт */
export async function forgotAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await allowReset())) return { error: TOO_MANY };
  const mail = email(form.get("email"));
  if (!mail) return { error: "Имэйл хаяг буруу байна." };

  const user = await prisma.user.findUnique({ where: { email: mail }, select: { id: true } });
  if (user) await sendResetEmail(mail, await createToken("reset", mail));

  return { ok: "Хэрэв энэ хаяг бүртгэлтэй бол сэргээх холбоосыг илгээлээ." };
}

/** Шинэ нууц үг тохируулах (сэргээх холбоосоор) */
export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");

  const problems = checkPassword(password);
  if (problems.length) return { error: problems[0]!.detail };

  const mail = await useToken("reset", token);
  if (!mail) return { error: "Холбоосын хугацаа дууссан эсвэл буруу байна. Дахин хүсэлт илгээнэ үү." };

  await setPassword(mail, password);
  // Нууц үг сэргээсэн нь имэйлээ эзэмшдэгийг батална
  await markVerified(mail);
  redirect("/nevtreh?nuuts=1");
}

/** Имэйл баталгаажуулах (холбоосоор орж ирэхэд) */
export async function verifyEmail(token: string): Promise<{ ok: boolean; email?: string }> {
  const mail = await useToken("verify", token);
  if (!mail) return { ok: false };
  await markVerified(mail);
  return { ok: true, email: mail };
}
