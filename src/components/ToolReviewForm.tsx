"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { reviewAction, type ToolFormState } from "@/tools/actions";
import { MAX_REVIEW_TEXT, MAX_STARS } from "@/tools/tool.api";
import { track } from "@/lib/analytics";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded bg-accent text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Илгээж байна…" : label}
    </button>
  );
}

/** Шүүмж бичих — нэг хэрэглэгч нэг шүүмж, дахин бичвэл хуучин нь шинэчлэгдэнэ */
export function ToolReviewForm({
  toolId,
  slug,
  mine,
}: {
  toolId: string;
  slug: string;
  mine: { stars: number; text: string | null; status: string; rejectReason: string | null } | null;
}) {
  const [state, formAction] = useActionState(reviewAction, {} as ToolFormState);
  const [stars, setStars] = useState(mine?.stars ?? 0);

  return (
    <form action={formAction} className="space-y-3" onSubmit={() => track("tool_review", { slug, stars })}>
      <input type="hidden" name="toolId" value={toolId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="stars" value={stars} />

      {state.error && (
        <p className="rounded border border-down/50 text-down text-sm px-3 py-2">{state.error}</p>
      )}
      {state.rejected && (
        <p className="rounded border border-warn/50 text-sm px-3 py-2">{state.rejected}</p>
      )}
      {state.ok && <p className="rounded border border-up/50 text-up text-sm px-3 py-2">{state.ok}</p>}
      {mine?.status === "PENDING" && mine.rejectReason && (
        <p className="rounded border border-warn/50 text-xs px-3 py-2">
          Таны шүүмж хянагдаж байна: {mine.rejectReason}
        </p>
      )}

      <fieldset className="space-y-1">
        <legend className="text-xs text-muted">Үнэлгээ</legend>
        <div className="flex gap-1">
          {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              aria-label={`${n} од`}
              aria-pressed={stars === n}
              className={`text-xl leading-none px-1 ${n <= stars ? "text-accent" : "text-muted hover:text-ink"}`}
            >
              {n <= stars ? "★" : "☆"}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Танд юу таалагдав, юу дутав? (сонголт)</span>
        <textarea
          name="text"
          rows={3}
          maxLength={MAX_REVIEW_TEXT}
          defaultValue={mine?.text ?? ""}
          className="w-full rounded border border-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="Монголоор хэр сайн ажилладаг, төлбөр төлж чадсан эсэх гэх мэт"
        />
      </label>

      <div className="flex items-center gap-3">
        <Submit label={mine ? "Шүүмжээ шинэчлэх" : "Шүүмж нэмэх"} />
        {stars === 0 && <span className="text-xs text-muted">Од сонгоно уу</span>}
      </div>
    </form>
  );
}
