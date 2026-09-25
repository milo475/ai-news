import Link from "next/link";
import { currentUser } from "@/auth/session";
import { bookmarkedPromptIds } from "@/bookmarks/queries";
import { PromptGrid } from "@/components/PromptList";
import { TrackEvent } from "@/components/Track";
import { likedPromptIds, listPrompts, promptFacets } from "@/prompts/queries";
import {
  PROMPT_CATEGORIES, PROMPT_CATEGORY_LABEL, PROMPT_LANGUAGE_LABEL, PROMPT_LANGUAGES,
  SORT_LABEL, SORTS, toSort,
} from "@/prompts/prompt.api";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import type { PromptCategory, PromptLanguage } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Монгол хэлний бэлэн prompt-уудын сан. Хувьсагчаа бөглөөд хуулаад ChatGPT, Gemini дээрээ " +
  "шууд ашиглана. Өөрийнхөө prompt-ыг ч нэмж болно.";

export const metadata = {
  title: "Prompt сан",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/prompt` },
};

type Search = { angilal?: string; heregsel?: string; hel?: string; erembe?: string };

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs ${
        active ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function PromptsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const category = (PROMPT_CATEGORIES as string[]).includes(sp.angilal ?? "")
    ? (sp.angilal as PromptCategory)
    : undefined;
  const language = (PROMPT_LANGUAGES as string[]).includes(sp.hel ?? "")
    ? (sp.hel as PromptLanguage)
    : undefined;
  const tool = sp.heregsel?.trim() || undefined;
  const sort = toSort(sp.erembe);

  const [prompts, facets, user] = await Promise.all([
    listPrompts({ category, tool, language, sort }),
    promptFacets(),
    currentUser(),
  ]);
  const ids = prompts.map((p) => p.id);
  const [savedIds, likedIds] = user
    ? await Promise.all([bookmarkedPromptIds(user.id, ids), likedPromptIds(user.id, ids)])
    : [undefined, undefined];

  const withFilter = (key: keyof Search, value?: string) => {
    const next = new URLSearchParams();
    const current: Search = {
      angilal: category, heregsel: tool, hel: language,
      erembe: sort === "shine" ? undefined : sort,
    };
    for (const [k, v] of Object.entries({ ...current, [key]: value })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/prompt?${qs}` : "/prompt";
  };

  const filtered = Boolean(category || tool || language);

  return (
    <div className="space-y-6">
      {filtered && (
        <TrackEvent
          event="prompt_filter"
          data={{ category: category ?? "", tool: tool ?? "", language: language ?? "", sort }}
        />
      )}

      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Prompt сан</h1>
          <p className="text-muted max-w-2xl">{DESCRIPTION}</p>
        </div>
        <Link
          href="/prompt/nemeh"
          className="rounded border border-accent/60 px-3 py-1.5 text-sm text-accent hover:bg-accent/10 whitespace-nowrap"
        >
          Prompt нэмэх
        </Link>
      </section>

      {facets.categories.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted w-16">Ангилал</span>
            <Chip href={withFilter("angilal")} active={!category}>Бүгд</Chip>
            {PROMPT_CATEGORIES.filter((c) => facets.categories.includes(c)).map((c) => (
              <Chip key={c} href={withFilter("angilal", category === c ? undefined : c)} active={category === c}>
                {PROMPT_CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>

          {facets.tools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted w-16">Хэрэгсэл</span>
              <Chip href={withFilter("heregsel")} active={!tool}>Бүгд</Chip>
              {facets.tools.map((t) => (
                <Chip key={t} href={withFilter("heregsel", tool === t ? undefined : t)} active={tool === t}>
                  {t}
                </Chip>
              ))}
            </div>
          )}

          {facets.languages.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted w-16">Хэл</span>
              <Chip href={withFilter("hel")} active={!language}>Бүгд</Chip>
              {PROMPT_LANGUAGES.filter((l) => facets.languages.includes(l)).map((l) => (
                <Chip key={l} href={withFilter("hel", language === l ? undefined : l)} active={language === l}>
                  {PROMPT_LANGUAGE_LABEL[l]}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted w-16">Эрэмбэ</span>
            {SORTS.map((s) => (
              <Chip key={s} href={withFilter("erembe", s === "shine" ? undefined : s)} active={sort === s}>
                {SORT_LABEL[s]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          {filtered
            ? "Энэ шүүлтэд тохирох prompt алга. Шүүлтээ цуцлаад бүгдийг үзнэ үү."
            : "Prompt удахгүй нэмэгдэнэ."}
        </div>
      ) : (
        <PromptGrid items={prompts} savedIds={savedIds} likedIds={likedIds} path="/prompt" />
      )}
    </div>
  );
}
