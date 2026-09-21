import { notFound } from "next/navigation";
import Link from "next/link";
import { getNewsItem } from "@/data";
import { Markdown } from "@/components/Markdown";
import { Tags } from "@/components/NewsList";
import { fmtDate } from "@/components/format";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const n = await getNewsItem((await params).slug);
  if (!n) return { title: "Мэдээ" };
  return {
    title: n.titleMn,
    description: n.summaryMn,
    openGraph: {
      type: "article",
      title: n.titleMn,
      description: n.summaryMn,
      publishedTime: n.publishedAt?.toISOString(),
    },
  };
}

export default async function NewsPage({ params }: { params: Promise<Params> }) {
  const n = await getNewsItem((await params).slug);
  if (!n) notFound();

  return (
    <article className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link href="/medee" className="text-sm text-muted hover:text-ink">← Мэдээ</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{n.titleMn}</h1>
        <p className="text-sm text-muted">
          {fmtDate(n.publishedAt)} · {n.sourceName} ·{" "}
          <a href={n.sourceUrl} target="_blank" rel="noopener nofollow" className="text-accent hover:underline">
            Эх сурвалж →
          </a>
        </p>
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

      <p className="text-xs text-muted border-t border-line pt-4">
        Энэ хураангуйг AI agent эх сурвалжаас бэлтгэж, редактор хянан нийтэлсэн. Бүрэн мэдээллийг{" "}
        <a href={n.sourceUrl} target="_blank" rel="noopener nofollow" className="text-accent hover:underline">
          эх сурвалжаас
        </a>{" "}
        уншина уу.
      </p>
    </article>
  );
}
