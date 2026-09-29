import Image from "next/image";
import { onlyMentioned } from "@/lib/text.api";
import { DIGEST_DISCLOSURE, NEWS_DISCLOSURE } from "@/lib/disclosure.api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/auth/session";
import { isBookmarked } from "@/bookmarks/queries";
import { BookmarkButton } from "@/components/BookmarkButton";
import { getNewsItem } from "@/data";
import { Markdown } from "@/components/Markdown";
import { ShareFacebook } from "@/components/ShareFacebook";
import { Tags } from "@/components/NewsList";
import { NewsletterForm } from "@/components/NewsletterForm";
import { fmtDate } from "@/components/format";
import { CardShare } from "@/components/CardShare";
import { cardImageUrl, sharePlatforms } from "@/gallery/card.api";
import { getCard } from "@/gallery/queries";
import { siteUrl } from "@/lib/site";
import { BreadcrumbLd } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { newsArticleJsonLd } from "@/lib/jsonld.api";

export const revalidate = 3600;

type Params = { slug: string };

/** Facebook-ийн crawler-т үнэмлэхүй хаяг хэрэгтэй */
const SITE_URL = siteUrl();

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const n = await getNewsItem(slug);
  if (!n) return { title: "Мэдээ" };
  const image = `${SITE_URL}/api/og/${slug}`;
  return {
    title: n.titleMn,
    description: n.summaryMn,
    alternates: { canonical: `/medee/${slug}` },
    openGraph: {
      type: "article",
      title: n.titleMn,
      description: n.summaryMn,
      url: `${SITE_URL}/medee/${slug}`,
      publishedTime: n.publishedAt?.toISOString(),
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: n.titleMn, description: n.summaryMn, images: [image] },
  };
}

export default async function NewsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const n = await getNewsItem(slug);
  if (!n) notFound();
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE_URL}/medee/${slug}`)}`;
  const user = await currentUser();
  const [saved, card] = await Promise.all([
    user ? isBookmarked(user.id, { articleId: n.id }) : Promise.resolve(false),
    getCard(slug),
  ]);

  // «Холбоотой» хэсэгт зөвхөн нийтлэлд ДУРДАГДСАН нэрс. Muse-ийн мэдээнд
  // Google, Anthropic дурдагдаагүй атал «холбоотой» гэж гарч байсан.
  const text = [n.titleMn, n.summaryMn, n.bodyMn].filter(Boolean).join(" ");
  const mentionedModels = onlyMentioned(n.models, text);
  const mentionedCompanies = onlyMentioned(n.companies, text);
  const otherModels = n.models.filter((m) => !mentionedModels.includes(m));
  const otherCompanies = n.companies.filter((c) => !mentionedCompanies.includes(c));

  return (
    <article className="max-w-2xl space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Мэдээ", path: "/medee" }, { name: n.titleMn }]} />
      <JsonLd
        data={newsArticleJsonLd({
          siteUrl: SITE_URL,
          slug,
          title: n.titleMn,
          description: n.summaryMn,
          publishedAt: n.publishedAt,
          imageUrl: `${SITE_URL}/api/og/${slug}`,
          sourceName: n.kind === "NEWS" ? n.sourceName : null,
          sourceUrl: n.kind === "NEWS" ? n.sourceUrl : null,
          tags: n.tags,
        })}
      />
      <div className="space-y-2">
        <Link href="/medee" className="text-sm text-muted hover:text-ink">← Мэдээ</Link>
        {n.kind === "DIGEST" && (
          <p className="text-xs uppercase tracking-widest text-accent">Долоо хоногийн тойм</p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{n.titleMn}</h1>
        <p className="text-sm text-muted">
          {fmtDate(n.publishedAt)}
          {n.kind === "NEWS" && (
            <>
              {" · "}{n.sourceName}{" · "}
              <a href={n.sourceUrl} target="_blank" rel="noopener nofollow" className="text-accent underline">
                Эх сурвалж →
              </a>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <BookmarkButton target={{ articleId: n.id }} saved={saved} path={`/medee/${slug}`} />
          {n.kind === "DIGEST" && <ShareFacebook slug={slug} href={shareUrl} />}
        </div>
      </div>

      {n.heroUrl && (
        // Хуудасны хамгийн том зураг — priority-гээр LCP-г түргэсгэнэ
        <Image
          src={n.heroUrl}
          alt=""
          width={1200}
          height={675}
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="w-full aspect-video object-cover rounded-lg border border-line"
        />
      )}

      <p className="text-lg text-muted leading-relaxed">{n.summaryMn}</p>

      <div className="text-[15px]">
        <Markdown>{n.bodyMn}</Markdown>
      </div>

      {n.correctionNote && (
        // Нийтлэгдсэний дараа эх сурвалжтай тулгаж хийсэн засвар. Уншигч хуучин
        // хувилбарыг уншсан байж болзошгүй тул юу өөрчлөгдсөнийг ил хэлнэ.
        <p className="rounded-lg border border-warn/40 px-4 py-3 text-sm text-muted">
          {n.correctionNote}
        </p>
      )}

      <Tags tags={n.tags} />

      {(mentionedModels.length > 0 || mentionedCompanies.length > 0) && (
        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-sm font-semibold">Холбоотой</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {mentionedModels.map((m) => (
              <Link key={m.slug} href={`/model/${m.slug}`} className="text-accent hover:underline">
                {m.nameMn ?? m.name}
              </Link>
            ))}
            {mentionedCompanies.map((c) => (
              <span key={c.name} className="text-muted">{c.name}</span>
            ))}
          </div>
        </section>
      )}

      {(otherModels.length > 0 || otherCompanies.length > 0) && (
        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-sm font-semibold">Ижил сэдвийн</h2>
          <p className="text-xs text-muted">Энэ мэдээнд дурдагдаагүй ч ойролцоо сэдэвтэй.</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {otherModels.map((m) => (
              <Link key={m.slug} href={`/model/${m.slug}`} className="text-accent hover:underline">
                {m.nameMn ?? m.name}
              </Link>
            ))}
            {otherCompanies.map((c) => (
              <span key={c.name} className="text-muted">{c.name}</span>
            ))}
          </div>
        </section>
      )}

      {card && (
        <section className="space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Энэ мэдээний карт</h2>
            <Link href={`/barimt/${slug}`} className="text-sm text-accent hover:underline">
              Картын хуудас →
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 items-start">
            <Link href={`/barimt/${slug}`} className="shrink-0">
              <Image
                src={cardImageUrl(card.id, card.cardAt)}
                alt={card.hook}
                width={1080}
                height={1350}
                sizes="160px"
                className="w-40 aspect-4/5 object-cover rounded-lg border border-line"
              />
            </Link>
            <div className="space-y-2 min-w-48 flex-1">
              <p className="text-sm text-muted">
                Facebook, Instagram-д тавьсан карт. Татаж, хуваалцаж, сайтдаа тавьж болно.
              </p>
              <CardShare
                articleId={card.id}
                slug={slug}
                title={card.hook}
                url={`${SITE_URL}/barimt/${slug}`}
                imageUrl={`/api/fb-image/${card.id}`}
                platforms={sharePlatforms()}
                appId={process.env.FB_APP_ID?.trim() || undefined}
              />
            </div>
          </div>
        </section>
      )}

      <NewsletterForm />

      {n.kind === "DIGEST" ? (
        <p className="text-xs text-muted border-t border-line pt-4">{DIGEST_DISCLOSURE}</p>
      ) : (
        <p className="text-xs text-muted border-t border-line pt-4">
          {NEWS_DISCLOSURE} Бүрэн мэдээллийг{" "}
          <a href={n.sourceUrl} target="_blank" rel="noopener nofollow" className="text-accent underline">
            эх сурвалжаас
          </a>{" "}
          уншина уу.
        </p>
      )}
    </article>
  );
}
