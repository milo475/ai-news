import { notFound } from "next/navigation";
import Link from "next/link";
import { getNewsItem } from "@/data";
import { Markdown } from "@/components/Markdown";
import { Tags } from "@/components/NewsList";
import { NewsletterForm } from "@/components/NewsletterForm";
import { fmtDate } from "@/components/format";

export const revalidate = 3600;

type Params = { slug: string };

/** Facebook-ийн crawler-т үнэмлэхүй хаяг хэрэгтэй */
const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const n = await getNewsItem(slug);
  if (!n) return { title: "Мэдээ" };
  const image = `${SITE_URL}/api/og/${slug}`;
  return {
    title: n.titleMn,
    description: n.summaryMn,
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

  return (
    <article className="max-w-2xl space-y-6">
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
              <a href={n.sourceUrl} target="_blank" rel="noopener nofollow" className="text-accent hover:underline">
                Эх сурвалж →
              </a>
            </>
          )}
        </p>
        {n.kind === "DIGEST" && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded border border-accent/50 text-accent px-3 py-1.5 text-sm hover:bg-accent/10"
          >
            Facebook-д хуваалцах
          </a>
        )}
      </div>

      <p className="text-lg text-muted leading-relaxed">{n.summaryMn}</p>

      <div className="text-[15px]">
        <Markdown>{n.bodyMn}</Markdown>
      </div>

      <Tags tags={n.tags} />

      {(n.models.length > 0 || n.companies.length > 0) && (
        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-sm font-semibold">Холбоотой</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {n.models.map((m) => (
              <Link key={m.slug} href={`/model/${m.slug}`} className="text-accent hover:underline">
                {m.nameMn ?? m.name}
              </Link>
            ))}
            {n.companies.map((c) => (
              <span key={c.name} className="text-muted">{c.name}</span>
            ))}
          </div>
        </section>
      )}

      <NewsletterForm />

      {n.kind === "DIGEST" ? (
        <p className="text-xs text-muted border-t border-line pt-4">
          Энэ тоймыг AI agent долоо хоногийн мэдээнээс нэгтгэж, редактор хянасан. Мэдээ бүрийн эх
          сурвалжийг тухайн нийтлэл дээрээс нь үзнэ үү.
        </p>
      ) : (
        <p className="text-xs text-muted border-t border-line pt-4">
          Энэ хураангуйг AI agent эх сурвалжаас бэлтгэж, редактор хянан нийтэлсэн. Бүрэн мэдээллийг{" "}
          <a href={n.sourceUrl} target="_blank" rel="noopener nofollow" className="text-accent hover:underline">
            эх сурвалжаас
          </a>{" "}
          уншина уу.
        </p>
      )}
    </article>
  );
}
