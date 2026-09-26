import { resetPasswordAction } from "@/auth/actions";
import { MIN_PASSWORD } from "@/auth/password";
import { ActionForm, input, Submit } from "@/components/AuthForm";

export const metadata = { title: "Шинэ нууц үг", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Шинэ нууц үг</h1>

      <ActionForm action={resetPasswordAction}>
        <input type="hidden" name="token" value={token} />
        <label className="block space-y-1">
          <span className="text-xs text-muted">Шинэ нууц үг ({MIN_PASSWORD}+ тэмдэгт)</span>
          <input
            name="password" type="password" autoComplete="new-password"
            required minLength={MIN_PASSWORD} className={input}
          />
        </label>
        <Submit>Нууц үг тохируулах</Submit>
      </ActionForm>
    </div>
  );
}
