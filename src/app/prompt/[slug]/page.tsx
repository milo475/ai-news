import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/auth/session";
import { bookmarkedPromptIds, isBookmarked } from "@/bookmarks/queries";
import { BookmarkButton } from "@/components/BookmarkButton";
import { GuideGrid } from "@/components/GuideList";
import { LikePrompt } from "@/components/LikePrompt";
import { PromptFiller } from "@/components/PromptFiller";
import { PromptGrid } from "@/components/PromptList";
import { TrackEvent } from "@/components/Track";
import { fmtDate } from "@/components/format";
import { clamp, MAX_META_DESCRIPTION, MAX_META_TITLE } from "@/guides/seo.api";
import { getPrompt, guidesForPrompt, likedPromptIds, relatedPrompts } from "@/prompts/queries";
import { PROMPT_CATEGORY_LABEL, PROMPT_LANGUAGE_LABEL } from "@/prompts/prompt.api";
import { promptJsonLd } from "@/prompts/seo.api";
import { siteUrl } from "@/lib/site";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const p = await getPrompt(slug);
  if (!p) return { title: "Prompt" };

  const url = `${siteUrl()}/prompt/${slug}`;
  const title = clamp(p.title, MAX_META_TITLE);
  const description = clamp(p.description || p.body, MAX_META_DESCRIPTION);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article", title, description, url,
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary", title, description,
      images: ["/opengraph-image.png"],
    },
  };
}

export default async function PromptPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const p = await getPrompt(slug);
  if (!p) notFound();

  const user = await currentUser();
  const [related, guides] = await Promise.all([relatedPrompts(p), guidesForPrompt(p.tools)]);
  const relatedIds = related.map((r) => r.id);
  const [saved, liked, savedRelated, likedRelated] = user
    ? await Promise.all([
        isBookmarked(user.id, { promptId: p.id }),
        likedPromptIds(user.id, [p.id]).then((s) => s.has(p.id)),
        bookmarkedPromptIds(user.id, relatedIds),
        likedPromptIds(user.id, relatedIds),
      ])
    : [false, false, undefined, undefined];

  return (
    <article className="max-w-2xl space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Prompt сан", path: "/prompt" }, { name: p.title }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(promptJsonLd(p, siteUrl())) }}
      />
      <TrackEvent event="prompt_view" data={{ slug }} />

      <div className="space-y-2">
        <Link href="/prompt" className="text-sm text-muted hover:text-ink">← Prompt сан</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{p.title}</h1>
        <p className="text-muted">{p.description}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Link
            href={`/prompt?angilal=${p.category}`}
            className="rounded px-1.5 py-0.5 border border-line hover:text-accent"
          >
            {PROMPT_CATEGORY_LABEL[p.category]}
          </Link>
          <span className="rounded px-1.5 py-0.5 border border-line">
            {PROMPT_LANGUAGE_LABEL[p.language]}
          </span>
          {p.tools.map((t) => (
            <Link
              key={t}
              href={`/prompt?heregsel=${encodeURIComponent(t)}`}
              className="rounded px-1.5 py-0.5 border border-line hover:text-accent"
            >
              {t}
            </Link>
          ))}
          <span className="tabular-nums">{p.copies} хуулсан</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <BookmarkButton target={{ promptId: p.id }} saved={saved} path={`/prompt/${slug}`} />
          <LikePrompt
            promptId={p.id} slug={slug} liked={liked} count={p.likes} path={`/prompt/${slug}`}
          />
        </div>
      </div>

      <PromptFiller promptId={p.id} slug={slug} body={p.body} variables={p.variables} />

      <p className="text-xs text-muted border-t border-line pt-4">
        {p.isSite ? "AI News-ийн бэлтгэсэн prompt" : `Нэмсэн: ${p.authorName ?? "хэрэглэгч"}`}
        {" · "}Сүүлд шинэчилсэн: {fmtDate(p.updatedAt)}
      </p>

      {guides.length > 0 && (
        <section className="space-y-3 border-t border-line pt-6">
          <h2 className="text-xl font-semibold">Холбоотой заавар</h2>
          <GuideGrid items={guides} cols={2} />
        </section>
      )}

      {related.length > 0 && (
        <section className="space-y-3 border-t border-line pt-6">
          <h2 className="text-xl font-semibold">Төстэй prompt</h2>
          <PromptGrid
            items={related} savedIds={savedRelated} likedIds={likedRelated} path={`/prompt/${slug}`}
          />
        </section>
      )}
    </article>
  );
}
