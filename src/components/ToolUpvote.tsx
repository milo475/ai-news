"use client";

import { useOptimistic, useTransition } from "react";
import { upvoteAction } from "@/tools/actions";
import { track } from "@/lib/analytics";

/** ▲ Upvote — нэвтрээгүй бол /nevtreh руу */
export function ToolUpvote({
  toolId,
  slug,
  upvoted,
  count,
  path,
}: {
  toolId: string;
  slug: string;
  upvoted: boolean;
  count: number;
  path?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({ upvoted, count });

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic.upvoted}
      title={optimistic.upvoted ? "Дуугаа буцаах" : "Санал болгох"}
      onClick={() => {
        startTransition(async () => {
          setOptimistic({
            upvoted: !optimistic.upvoted,
            count: optimistic.count + (optimistic.upvoted ? -1 : 1),
          });
          if (!optimistic.upvoted) track("tool_upvote", { slug });
          await upvoteAction(toolId, path);
        });
      }}
      className={`text-xs rounded border px-2 py-1 transition-colors ${
        optimistic.upvoted ? "border-accent/60 text-accent" : "border-line text-muted hover:text-ink"
      }`}
    >
      <span aria-hidden className="mr-1">▲</span>
      <span className="tabular-nums">{optimistic.count}</span>
    </button>
  );
}
