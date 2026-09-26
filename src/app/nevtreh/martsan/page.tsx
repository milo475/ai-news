import Link from "next/link";
import { forgotAction } from "@/auth/actions";
import { ActionForm, input, Submit } from "@/components/AuthForm";

export const metadata = { title: "Нууц үгээ мартсан", robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Нууц үгээ мартсан</h1>
      <p className="text-sm text-muted">
        Бүртгэлтэй имэйл хаягаа оруулна уу. Шинэ нууц үг тохируулах холбоосыг илгээнэ (1 цаг хүчинтэй).
      </p>

      <ActionForm action={forgotAction}>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Имэйл</span>
          <input name="email" type="email" autoComplete="email" required className={input} />
        </label>
        <Submit>Холбоос илгээх</Submit>
      </ActionForm>

      <p className="text-sm text-muted">
        <Link href="/nevtreh" className="text-accent hover:underline">← Нэвтрэх</Link>
      </p>
    </div>
  );
}
