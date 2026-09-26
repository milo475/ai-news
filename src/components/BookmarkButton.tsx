"use client";

import { useOptimistic, useTransition } from "react";
import { toggleBookmark } from "@/bookmarks/actions";
import type { BookmarkTarget } from "@/bookmarks/queries";
import { track } from "@/lib/analytics";

/**
 * «Хадгалах» товч — дарамагц төлөв нь шууд солигдоно (optimistic),
 * сервер хариу ирэхэд баталгаажна.
 */
export function BookmarkButton({
  target,
  saved,
  path,
  compact = false,
}: {
  /** { articleId }, { guideId }, { promptId } эсвэл { toolId } */
  target: BookmarkTarget;
  saved: boolean;
  path?: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(saved);

  const label = optimistic ? "Хадгалсан" : "Хадгалах";

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      title={optimistic ? "Хадгалсанаас хасах" : "Дараа унших бол хадгална"}
      onClick={() => {
        startTransition(async () => {
          setOptimistic(!optimistic);
          track(optimistic ? "bookmark_remove" : "bookmark_add", {
            kind: target.guideId
              ? "guide"
              : target.promptId
                ? "prompt"
                : target.toolId
                  ? "tool"
                  : "article",
          });
          await toggleBookmark(target, path);
        });
      }}
      className={
        compact
          ? `text-xs rounded border px-2 py-1 transition-colors ${
              optimistic ? "border-accent/60 text-accent" : "border-line text-muted hover:text-ink"
            }`
          : `text-sm rounded border px-3 py-1.5 transition-colors ${
              optimistic ? "border-accent/60 text-accent" : "border-line text-muted hover:text-ink"
            }`
      }
    >
      <span aria-hidden className="mr-1">{optimistic ? "★" : "☆"}</span>
      {label}
    </button>
  );
}
