import { redirect } from "next/navigation";
import { resendVerifyAction } from "@/auth/actions";
import { currentUser } from "@/auth/session";
import { changePasswordAction } from "./actions";
import { ActionForm, input, Submit } from "@/components/AuthForm";
import { MIN_PASSWORD } from "@/auth/password";
import { prisma } from "@/db";

export const metadata = { title: "Профайл" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/nevtreh");

  const [db, subscriber] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true, passwordHash: true },
    }),
    prisma.subscriber.findFirst({ where: { userId: user.id }, select: { status: true } }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Профайл</h1>

      <section className="rounded-lg border border-line p-4 space-y-2 text-sm">
        <p><span className="text-muted">Нэр:</span> {user.name ?? "—"}</p>
        <p><span className="text-muted">Имэйл:</span> {user.email}</p>
        <p>
          <span className="text-muted">Төлөв:</span>{" "}
          {user.verified ? (
            <span className="text-up">баталгаажсан</span>
          ) : (
            <span className="text-warn">баталгаажаагүй</span>
          )}
        </p>
        {subscriber && (
          <p><span className="text-muted">Долоо хоногийн имэйл:</span> {subscriber.status}</p>
        )}
        {db?.createdAt && (
          <p className="text-xs text-muted">
            Бүртгүүлсэн: {db.createdAt.toLocaleDateString("mn-MN", { timeZone: "UTC" })}
          </p>
        )}
      </section>

      {!user.verified && (
        <section className="rounded-lg border border-line p-4 space-y-3">
          <h2 className="text-sm font-semibold">Имэйлээ баталгаажуулах</h2>
          <p className="text-xs text-muted">
            Коммент бичих, prompt нэмэх зэрэг үйлдэлд имэйл баталгаажсан байх шаардлагатай.
          </p>
          <ActionForm action={resendVerifyAction} className="space-y-2">
            <input type="hidden" name="email" value={user.email} />
            <Submit>Баталгаажуулах холбоос дахин илгээх</Submit>
          </ActionForm>
        </section>
      )}

      <section className="rounded-lg border border-line p-4 space-y-3">
        <h2 className="text-sm font-semibold">Нууц үг солих</h2>
        <ActionForm action={changePasswordAction}>
          {db?.passwordHash && (
            <label className="block space-y-1">
              <span className="text-xs text-muted">Одоогийн нууц үг</span>
              <input name="current" type="password" autoComplete="current-password" required className={input} />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-muted">Шинэ нууц үг ({MIN_PASSWORD}+ тэмдэгт)</span>
            <input
              name="password" type="password" autoComplete="new-password"
              required minLength={MIN_PASSWORD} className={input}
            />
          </label>
          <Submit>Хадгалах</Submit>
        </ActionForm>
      </section>
    </div>
  );
}
