import Link from "next/link";
import { CopyPrompt } from "./CopyPrompt";
import type { PromptCard } from "@/prompts/queries";
import { PROMPT_CATEGORY_LABEL } from "@/prompts/prompt.api";

/** Нүүрний «Өнөөдрийн prompt» — нэг prompt, шууд хуулж болно */
export function PromptOfDay({ prompt }: { prompt: PromptCard }) {
  return (
    <section className="rounded-lg border border-accent/40 bg-accent/5 p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-accent">Өнөөдрийн prompt</p>
        <Link href="/prompt" className="text-sm text-accent hover:underline">Prompt сан →</Link>
      </div>
      <Link href={`/prompt/${prompt.slug}`} className="block">
        <p className="text-xl font-semibold tracking-tight hover:text-accent">{prompt.title}</p>
      </Link>
      <p className="text-sm text-muted">{prompt.description}</p>
      <pre className="text-sm whitespace-pre-wrap break-words font-mono text-muted line-clamp-4">
        {prompt.body}
      </pre>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <CopyPrompt promptId={prompt.id} slug={prompt.slug} text={prompt.body} compact />
        <span className="rounded px-1.5 py-0.5 border border-line">
          {PROMPT_CATEGORY_LABEL[prompt.category]}
        </span>
        {prompt.variables.length > 0 && <span>{prompt.variables.length} хувьсагч</span>}
        <span className="ml-auto tabular-nums">{prompt.copies} хуулсан · ♡ {prompt.likes}</span>
      </div>
    </section>
  );
}
