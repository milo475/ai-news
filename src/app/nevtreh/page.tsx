import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/auth/actions";
import { currentUser } from "@/auth/session";
import { ActionForm, input, Submit } from "@/components/AuthForm";
import { GoogleButton } from "@/components/GoogleButton";

export const metadata = { title: "Нэвтрэх", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ burtgel?: string; mail?: string; nuuts?: string; batalgaa?: string }>;
}) {
  if (await currentUser()) redirect("/profile");
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Нэвтрэх</h1>

      {sp.burtgel && (
        <p className="rounded border border-up/50 text-up text-sm px-3 py-2">
          Бүртгэл үүслээ. {sp.mail ? <b>{sp.mail}</b> : "Имэйл"} хаяг руу баталгаажуулах холбоос илгээсэн —
          шалгаад баталгаажуулна уу. Одоо ч нэвтэрч болно.
        </p>
      )}
      {sp.nuuts && (
        <p className="rounded border border-up/50 text-up text-sm px-3 py-2">
          Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.
        </p>
      )}
      {sp.batalgaa && (
        <p className="rounded border border-up/50 text-up text-sm px-3 py-2">Имэйл баталгаажлаа.</p>
      )}

      <ActionForm action={loginAction} event="login">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Имэйл</span>
          <input name="email" type="email" autoComplete="email" required className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Нууц үг</span>
          <input name="password" type="password" autoComplete="current-password" required className={input} />
        </label>
        <Submit>Нэвтрэх</Submit>
      </ActionForm>

      <GoogleButton />

      <p className="text-sm text-muted">
        Бүртгэлгүй юу? <Link href="/burtguuleh" className="text-accent hover:underline">Бүртгүүлэх</Link>
        {" · "}
        <Link href="/nevtreh/martsan" className="text-accent hover:underline">Нууц үгээ мартсан</Link>
      </p>
    </div>
  );
}
