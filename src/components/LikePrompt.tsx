"use client";

import { useOptimistic, useTransition } from "react";
import { likeAction } from "@/prompts/actions";
import { track } from "@/lib/analytics";

/** Зүрх — нэвтрээгүй бол /nevtreh руу явуулна */
export function LikePrompt({
  promptId,
  slug,
  liked,
  count,
  path,
}: {
  promptId: string;
  slug: string;
  liked: boolean;
  count: number;
  path?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({ liked, count });

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic.liked}
      title={optimistic.liked ? "Таалагдсанаас хасах" : "Таалагдсан"}
      onClick={() => {
        startTransition(async () => {
          setOptimistic({
            liked: !optimistic.liked,
            count: optimistic.count + (optimistic.liked ? -1 : 1),
          });
          if (!optimistic.liked) track("prompt_like", { slug });
          await likeAction(promptId, path);
        });
      }}
      className={`text-xs rounded border px-2 py-1 transition-colors ${
        optimistic.liked ? "border-accent/60 text-accent" : "border-line text-muted hover:text-ink"
      }`}
    >
      <span aria-hidden className="mr-1">{optimistic.liked ? "♥" : "♡"}</span>
      <span className="tabular-nums">{optimistic.count}</span>
    </button>
  );
}
