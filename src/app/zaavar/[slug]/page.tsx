import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/auth/session";
import { bookmarkedGuideIds, isBookmarked } from "@/bookmarks/queries";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Faq } from "@/components/Faq";
import { GuideBody } from "@/components/GuideBody";
import { GuideGrid, LevelBadge } from "@/components/GuideList";
import { GuideToc } from "@/components/GuideToc";
import { NewsletterForm } from "@/components/NewsletterForm";
import { TrackEvent } from "@/components/Track";
import { fmtDate } from "@/components/format";
import { getUseCase } from "@/data";
import { getGuide, relatedGuides } from "@/guides/queries";
import { tocFromMarkdown } from "@/guides/markdown.api";
import { clamp, faqJsonLd, guideUrl, howToJsonLd, MAX_META_DESCRIPTION, MAX_META_TITLE } from "@/guides/seo.api";
import { bumpViews } from "@/guides/views";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const g = await getGuide(slug);
  if (!g) return { title: "Заавар" };

  const site = siteUrl();
  const url = guideUrl(site, slug);
  const image = g.hasHero ? `${site}/api/guide-image/${slug}` : `${site}/opengraph-image.png`;
  const title = clamp(g.title, MAX_META_TITLE);
  const description = clamp(g.lead, MAX_META_DESCRIPTION);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title, description, url,
      publishedTime: g.publishedAt?.toISOString(),
      modifiedTime: g.updatedAt.toISOString(),
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const g = await getGuide(slug);
  if (!g) notFound();

  const [user, related, useCase, ua] = await Promise.all([
    currentUser(),
    relatedGuides(g),
    g.usecaseSlug ? getUseCase(g.usecaseSlug) : null,
    headers().then((h) => h.get("user-agent")),
  ]);
  const [saved, savedRelated] = await Promise.all([
    user ? isBookmarked(user.id, { guideId: g.id }) : false,
    user ? bookmarkedGuideIds(user.id, related.map((r) => r.id)) : undefined,
  ]);

  void bumpViews(g.id, ua);

  const toc = tocFromMarkdown(g.bodyMd);
  const site = siteUrl();
  const howTo = howToJsonLd(g, site);
  const faq = faqJsonLd(g.faq);

  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq ? [howTo, faq] : howTo) }}
      />
      <TrackEvent event="guide_view" data={{ slug }} />

      <aside className="hidden lg:block">
        <GuideToc items={toc} />
      </aside>

      <article className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Link href="/zaavar" className="text-sm text-muted hover:text-ink">← Заавар</Link>
          <h1 className="text-3xl font-semibold tracking-tight">{g.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <LevelBadge level={g.level} />
            <span>{g.readMinutes} мин уншина</span>
            {g.audience.length > 0 && <span>· {g.audience.join(", ")}-д</span>}
          </div>
          <div className="pt-1">
            <BookmarkButton target={{ guideId: g.id }} saved={saved} path={`/zaavar/${slug}`} />
          </div>
        </div>

        {g.hasHero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/guide-image/${slug}`}
            alt=""
            className="w-full aspect-video object-cover rounded-lg border border-line"
          />
        )}

        <p className="text-lg text-muted leading-relaxed">{g.lead}</p>

        {/* Гар утсанд sticky TOC зай эзэлнэ — дээр нь эвхэгддэг байдлаар */}
        {toc.length > 1 && (
          <details className="lg:hidden rounded-lg border border-line p-4">
            <summary className="cursor-pointer text-sm font-medium">Агуулга</summary>
            <div className="pt-3">
              <GuideToc items={toc} />
            </div>
          </details>
        )}

        <GuideBody md={g.bodyMd} slug={slug} />

        {g.tools.length > 0 && (
          <section className="space-y-2 border-t border-line pt-4">
            <h2 className="text-sm font-semibold">Хэрэгтэй хэрэгслүүд</h2>
            <div className="flex flex-wrap gap-1.5">
              {g.tools.map((t) => (
                <Link
                  key={t}
                  href={`/zaavar?heregsel=${encodeURIComponent(t)}`}
                  className="text-xs rounded-full border border-line px-2.5 py-1 text-muted hover:text-accent hover:border-accent/50"
                >
                  {t}
                </Link>
              ))}
            </div>
          </section>
        )}

        <Faq items={g.faq} />

        <p className="text-xs text-muted border-t border-line pt-4">
          Сүүлд шинэчилсэн: {fmtDate(g.updatedAt)}
          {g.publishedAt && ` · Нийтэлсэн: ${fmtDate(g.publishedAt)}`}
        </p>

        {useCase && (
          <Link
            href={`/hereglee/${useCase.slug}`}
            className="block rounded-lg border border-line p-4 hover:bg-line/30"
          >
            <p className="text-xs text-muted">Холбоотой хэрэглээ</p>
            <p className="font-medium">{useCase.nameMn}</p>
            <p className="text-sm text-muted">{useCase.descriptionMn}</p>
          </Link>
        )}

        {related.length > 0 && (
          <section className="space-y-3 border-t border-line pt-6">
            <h2 className="text-xl font-semibold">Бас уншаарай</h2>
            <GuideGrid items={related} savedIds={savedRelated} path={`/zaavar/${slug}`} cols={2} />
          </section>
        )}

        <NewsletterForm />
      </article>
    </div>
  );
}
