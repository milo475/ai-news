"use client";

/**
 * Нэвтрэх/бүртгүүлэх формуудын нийтлэг хэсгүүд.
 *
 * Server action-ыг useActionState-аар дуудаж, алдааг нэг хэлбэрээр харуулна.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { track } from "@/lib/analytics";
import type { FormState } from "@/auth/actions";

export const input =
  "w-full rounded border border-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-accent";

export function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded bg-accent text-white px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Түр хүлээнэ үү…" : children}
    </button>
  );
}

export function Message({ state }: { state: FormState }) {
  if (state.error) {
    return <p className="rounded border border-down/50 text-down text-sm px-3 py-2">{state.error}</p>;
  }
  if (state.ok) {
    return <p className="rounded border border-up/50 text-up text-sm px-3 py-2">{state.ok}</p>;
  }
  return null;
}

/** Server action-ыг ашиглах форм. `event` өгвөл илгээхэд Umami event бүртгэнэ. */
export function ActionForm({
  action,
  event,
  children,
  className = "space-y-3",
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  event?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={() => {
        if (event) track(event);
      }}
    >
      <Message state={state} />
      {children}
    </form>
  );
}
