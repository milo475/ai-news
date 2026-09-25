"use client";

import { useOptimistic, useTransition } from "react";
import { toggleBookmark } from "@/bookmarks/actions";
import { track } from "@/lib/analytics";

/**
 * «Хадгалах» товч — дарамагц төлөв нь шууд солигдоно (optimistic),
 * сервер хариу ирэхэд баталгаажна.
 */
export function BookmarkButton({
  articleId,
  saved,
  path,
  compact = false,
}: {
  articleId: string;
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
          track(optimistic ? "bookmark_remove" : "bookmark_add");
          await toggleBookmark(articleId, path);
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
