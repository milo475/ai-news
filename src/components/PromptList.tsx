import Link from "next/link";
import { BookmarkButton } from "./BookmarkButton";
import { CopyPrompt } from "./CopyPrompt";
import { LikePrompt } from "./LikePrompt";
import type { PromptCard } from "@/prompts/queries";
import { PROMPT_CATEGORY_LABEL, PROMPT_LANGUAGE_LABEL } from "@/prompts/prompt.api";

export function PromptItem({
  prompt,
  saved,
  liked,
  path,
}: {
  prompt: PromptCard;
  /** undefined = нэвтрээгүй, товч харуулахгүй */
  saved?: boolean;
  liked?: boolean;
  path?: string;
}) {
  return (
    <li className="rounded-lg border border-line p-4 space-y-2 flex flex-col hover:bg-line/20">
      <Link href={`/prompt/${prompt.slug}`} className="font-medium hover:text-accent leading-snug">
        {prompt.title}
      </Link>
      <p className="text-sm text-muted line-clamp-3">{prompt.description}</p>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span className="rounded px-1.5 py-0.5 border border-line">
          {PROMPT_CATEGORY_LABEL[prompt.category]}
        </span>
        {prompt.language !== "MN" && (
          <span className="rounded px-1.5 py-0.5 border border-line">
            {PROMPT_LANGUAGE_LABEL[prompt.language]}
          </span>
        )}
        {prompt.tools.slice(0, 3).map((t) => (
          <span key={t} className="rounded px-1.5 py-0.5 border border-line">{t}</span>
        ))}
        {prompt.variables.length > 0 && (
          <span title="Бөглөх нүхнүүд">{prompt.variables.length} хувьсагч</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        <CopyPrompt promptId={prompt.id} slug={prompt.slug} text={prompt.body} compact />
        {saved !== undefined && (
          <BookmarkButton target={{ promptId: prompt.id }} saved={saved} path={path} compact />
        )}
        {liked !== undefined ? (
          <LikePrompt
            promptId={prompt.id} slug={prompt.slug} liked={liked} count={prompt.likes} path={path}
          />
        ) : (
          <span className="text-xs text-muted">♡ {prompt.likes}</span>
        )}
        <span className="ml-auto text-xs text-muted tabular-nums">{prompt.copies} хуулсан</span>
      </div>
    </li>
  );
}

export function PromptGrid({
  items,
  savedIds,
  likedIds,
  path,
}: {
  items: PromptCard[];
  savedIds?: Set<string>;
  likedIds?: Set<string>;
  path?: string;
}) {
  return (
    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((p) => (
        <PromptItem
          key={p.id}
          prompt={p}
          saved={savedIds ? savedIds.has(p.id) : undefined}
          liked={likedIds ? likedIds.has(p.id) : undefined}
          path={path}
        />
      ))}
    </ul>
  );
}
