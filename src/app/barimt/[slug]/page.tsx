import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardShare } from "@/components/CardShare";
import { TrackEvent } from "@/components/Track";
import { fmtDate } from "@/components/format";
import { CATEGORY_LABEL } from "@/agent/category";
import { CARD_H, CARD_W, cardImageUrl, embedCode, sharePlatforms } from "@/gallery/card.api";
import { getCard } from "@/gallery/queries";
import { imageJsonLd } from "@/gallery/seo.api";
import { clamp, MAX_META_DESCRIPTION, MAX_META_TITLE } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

/** Карт нь нэг үүсээд хувирдаггүй — өдөрт нэг удаа шинэчлэхэд хангалттай */
export const revalidate = 86_400;

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const c = await getCard(slug);
  if (!c) return { title: "Баримт" };

  const site = siteUrl();
  const url = `${site}/barimt/${slug}`;
  // OG зураг = карт өөрөө (4:5). FB/IG-д хуваалцахад яг карт preview болно.
  const image = `${site}/api/fb-image/${c.id}`;
  const title = clamp(c.hook, MAX_META_TITLE);
  const description = clamp(c.summaryMn || c.titleMn, MAX_META_DESCRIPTION);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article", title, description, url,
      images: [{ url: image, width: CARD_W, height: CARD_H, alt: c.hook }],
      publishedTime: c.publishedAt?.toISOString(),
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function CardPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const c = await getCard(slug);
  if (!c) notFound();

  const site = siteUrl();
  const url = `${site}/barimt/${slug}`;
  const platforms = sharePlatforms();
  const appId = process.env.FB_APP_ID?.trim() || undefined;

  return (
    <article className="max-w-md mx-auto space-y-4">
      <BreadcrumbLd crumbs={[{ name: "Өдрийн баримт", path: "/barimt" }, { name: c.hook }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            imageJsonLd(
              {
                slug, hook: c.hook, titleMn: c.titleMn, summaryMn: c.summaryMn,
                publishedAt: c.publishedAt, cardAt: c.cardAt, articleId: c.id,
              },
              site,
            ),
          ),
        }}
      />
      <TrackEvent event="card_view" data={{ slug, from: "page" }} />

      <div className="space-y-1">
        <Link href="/barimt" className="text-sm text-muted hover:text-ink">← Өдрийн баримт</Link>
        <p className="text-xs text-muted">
          {CATEGORY_LABEL[c.category]} · {fmtDate(c.publishedAt)}
          {c.sourceName && ` · ${c.sourceName}`}
        </p>
      </div>

      <Image
        src={cardImageUrl(c.id, c.cardAt)}
        alt={c.hook}
        width={CARD_W}
        height={CARD_H}
        priority
        sizes="(max-width: 448px) 100vw, 448px"
        className="w-full aspect-4/5 object-cover rounded-lg border border-line"
      />

      <h1 className="text-xl font-semibold leading-snug">{c.hook}</h1>

      <CardShare
        articleId={c.id}
        slug={slug}
        title={c.hook}
        url={url}
        imageUrl={`/api/fb-image/${c.id}`}
        platforms={platforms}
        appId={appId}
      />

      {c.summaryMn && <p className="text-[15px] text-muted leading-relaxed">{c.summaryMn}</p>}

      <div className="flex flex-wrap gap-3 text-sm border-t border-line pt-3">
        <Link href={`/medee/${slug}`} className="text-accent hover:underline">
          Бүтэн мэдээг унших →
        </Link>
        <Link href="/barimt" className="text-muted hover:text-ink">Бусад карт</Link>
      </div>

      <details className="rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-sm text-muted">Өөрийн сайтдаа тавих (embed)</summary>
        <pre className="mt-2 text-xs whitespace-pre-wrap break-all font-mono text-muted">
          {embedCode(site, slug, c.hook)}
        </pre>
        <p className="mt-2 text-xs text-muted">
          Дээрх кодыг блог, сайтдаа тавибал карт харагдаж, AI News рүү холбоос орно.
        </p>
      </details>
    </article>
  );
}
