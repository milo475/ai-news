"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitToolAction, type ToolFormState } from "@/tools/actions";
import { TOOL_CATEGORIES, TOOL_CATEGORY_HINT, TOOL_CATEGORY_LABEL } from "@/tools/tool.api";
import { track } from "@/lib/analytics";

const input = "w-full rounded border border-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-accent";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || disabled}
      className="w-full rounded bg-accent text-white px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Бэлдэж байна…" : "Санал болгох"}
    </button>
  );
}

/** Хэрэглэгч хэрэгсэл санал болгоно — LLM тайлбарыг автоматаар бөглөнө */
export function ToolSubmitForm({ remaining }: { remaining: number }) {
  const [state, formAction] = useActionState(submitToolAction, {} as ToolFormState);
  const out = remaining <= 0;

  return (
    <form action={formAction} className="space-y-4" onSubmit={() => track("tool_submit")}>
      {state.error && (
        <p className="rounded border border-down/50 text-down text-sm px-3 py-2">{state.error}</p>
      )}
      {state.ok && <p className="rounded border border-up/50 text-up text-sm px-3 py-2">{state.ok}</p>}

      <label className="block space-y-1">
        <span className="text-xs text-muted">Хэрэгслийн нэр</span>
        <input name="name" required minLength={2} maxLength={60} className={input} placeholder="Жишээ нь: Perplexity" />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Вэбсайт</span>
        <input name="website" required className={input} placeholder="perplexity.ai" />
      </label>

      <fieldset className="space-y-1">
        <legend className="text-xs text-muted">Ангилал (1–3)</legend>
        <div className="grid sm:grid-cols-2 gap-1.5">
          {TOOL_CATEGORIES.map((c) => (
            <label key={c} className="flex gap-2 items-start text-sm">
              <input type="checkbox" name="categories" value={c} className="mt-1 accent-accent" />
              <span>
                {TOOL_CATEGORY_LABEL[c]}
                <span className="block text-xs text-muted">{TOOL_CATEGORY_HINT[c]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Submit disabled={out} />
      <p className="text-xs text-muted">
        {out
          ? "Өнөөдрийн хязгаар дүүрлээ. Маргааш дахин оролдоно уу."
          : `Өнөөдөр ${remaining} хэрэгсэл санал болгож болно. Тайлбар, үнэ, монгол хэлний дэмжлэгийг ` +
            "систем автоматаар бөглөж админд бэлдэнэ — та зөвхөн нэр, хаяг, ангиллыг өгнө."}
      </p>
    </form>
  );
}
