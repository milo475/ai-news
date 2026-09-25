import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/auth/actions";
import { currentUser } from "@/auth/session";
import { MIN_PASSWORD } from "@/auth/password";
import { ActionForm, input, Submit } from "@/components/AuthForm";
import { GoogleButton } from "@/components/GoogleButton";

export const metadata = { title: "Бүртгүүлэх" };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/profile");

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Бүртгүүлэх</h1>

      <ActionForm action={registerAction} event="register">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Нэр</span>
          <input name="name" autoComplete="name" required minLength={2} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Имэйл</span>
          <input name="email" type="email" autoComplete="email" required className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Нууц үг ({MIN_PASSWORD}+ тэмдэгт)</span>
          <input
            name="password" type="password" autoComplete="new-password"
            required minLength={MIN_PASSWORD} className={input}
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="newsletter" className="mt-1" />
          <span className="text-muted">Долоо хоногийн AI-ийн тоймыг имэйлээр авах</span>
        </label>
        <Submit>Бүртгүүлэх</Submit>
      </ActionForm>

      <GoogleButton label="Google-ээр бүртгүүлэх" />

      <p className="text-sm text-muted">
        Бүртгэлтэй юу? <Link href="/nevtreh" className="text-accent hover:underline">Нэвтрэх</Link>
      </p>
    </div>
  );
}
