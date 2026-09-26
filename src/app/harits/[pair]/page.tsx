import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTable } from "@/components/CompareTable";
import { TrackEvent } from "@/components/Track";
import {
  pairKey, pairPath, parsePair, recommend, USE_CASE_HINT, USE_CASE_LABEL,
} from "@/compare/pair.api";
import { countView, relatedPairsFor, statsPair } from "@/compare/queries";
import { summaryFor } from "@/compare/summary";
import { compareDescription, compareJsonLd, compareTitle } from "@/compare/seo.api";
import { clamp, MAX_META_DESCRIPTION, MAX_META_TITLE } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import { prisma } from "@/db";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

/** Өдөрт нэг удаа дахин үүсгэнэ — оноо, үнэ өдөр бүр л хувирдаг */
export const revalidate = 86_400;

type Params = { pair: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) return { title: "Харьцуулалт" };

  const stats = await statsPair(parsed[0], parsed[1]);
  if (!stats) return { title: "Харьцуулалт" };
  const [a, b] = stats;

  const canonical = `${siteUrl()}${pairPath(a.slug, b.slug)}`;
  const title = compareTitle(a.name, b.name);
  const description = compareDescription(a, b);
  return {
    title: clamp(title, MAX_META_TITLE),
    description: clamp(description, MAX_META_DESCRIPTION),
    alternates: { canonical },
    openGraph: {
      type: "website", url: canonical,
      title: clamp(title, MAX_META_TITLE),
      description: clamp(description, MAX_META_DESCRIPTION),
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    },
  };
}

export default async function ComparePage({ params }: { params: Promise<Params> }) {
  const { pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) notFound();

  // Эсрэг дараалалтай хаягийг middleware аль хэдийн 301-ээр canonical руу явуулсан байна.

  const stats = await statsPair(parsed[0], parsed[1]);
  if (!stats) notFound();
  const [a, b] = stats;

  const key = pairKey(a.slug, b.slug);
  const [summary, related] = await Promise.all([
    summaryFor(a, b),
    relatedPairsFor(a.slug, 5),
  ]);
  void countView(key);

  const recs = recommend(a, b);
  const site = siteUrl();

  // «X vs бусад» — өөрийгөө орхино
  const otherPairs = related.filter((k) => k !== key).slice(0, 5);
  const otherSlugs = await slugsFor(otherPairs);

  return (
    <div className="max-w-3xl space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Харьцуулах", path: "/harits" }, { name: `${a.name} vs ${b.name}` }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(compareJsonLd(a, b, `${site}${pairPath(a.slug, b.slug)}`)),
        }}
      />
      <TrackEvent event="compare_view" data={{ pair: key }} />

      <div className="space-y-2">
        <Link href="/harits" className="text-sm text-muted hover:text-ink">← Модель сонгох</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{a.name} vs {b.name}</h1>
        <p className="text-muted">{a.company} · {b.company}</p>
      </div>

      <section className="rounded-lg border border-accent/40 bg-accent/5 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Аль нь дээр вэ? Товч дүгнэлт</h2>
        {summary.summaryMn ? (
          <p className="text-[15px] leading-relaxed">{summary.summaryMn}</p>
        ) : (
          <p className="text-sm text-muted">
            Дүгнэлт хараахан бэлэн болоогүй. Доорх хүснэгтээс хэмжсэн өгөгдлийг харна уу.
          </p>
        )}
      </section>

      <CompareTable a={a} b={b} />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Хэн юунд сонгох вэ</h2>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {recs.map((r) => {
            const who = r.winner === "a" ? a : r.winner === "b" ? b : null;
            return (
              <li key={r.useCase} className="p-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium w-44">{USE_CASE_LABEL[r.useCase]}</span>
                <span className="text-sm">
                  {who ? (
                    <Link href={`/model/${who.slug}`} className="text-accent hover:underline">{who.name}</Link>
                  ) : (
                    <span className="text-muted">хоёулаа ойролцоо</span>
                  )}
                </span>
                <span className="text-xs text-muted basis-full sm:basis-auto sm:ml-auto">{r.reason}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">
          Эдгээр дүгнэлтийг хэмжсэн өгөгдлөөс <strong>дүрмээр</strong> гаргасан — LLM-ийн санаа биш.
          Дүрмийг аргачлалын хуудаснаас үзнэ үү:{" "}
          {recs.map((r, i) => (
            <span key={r.useCase}>
              {i > 0 && "; "}
              {USE_CASE_LABEL[r.useCase]} — {USE_CASE_HINT[r.useCase]}
            </span>
          ))}
        </p>
      </section>

      {otherSlugs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{a.name} vs бусад</h2>
          <ul className="flex flex-wrap gap-2">
            {otherSlugs.map((p) => (
              <li key={p.key}>
                <Link
                  href={`/harits/${p.key}`}
                  className="text-sm rounded-full border border-line px-3 py-1 text-muted hover:text-accent hover:border-accent/50"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap gap-3 border-t border-line pt-4 text-sm">
        <Link href={`/model/${a.slug}`} className="text-accent hover:underline">{a.name}-ийн хуудас →</Link>
        <Link href={`/model/${b.slug}`} className="text-accent hover:underline">{b.name}-ийн хуудас →</Link>
        <Link href="/benchmark" className="text-accent hover:underline">Монгол хэлний бенчмарк →</Link>
        <Link href="/zaavar" className="text-accent hover:underline">Заавар →</Link>
      </section>
    </div>
  );
}

/** pairKey-үүдээс харагдах нэр гаргана */
async function slugsFor(keys: string[]): Promise<{ key: string; label: string }[]> {
  if (keys.length === 0) return [];
  const slugs = new Set<string>();
  for (const k of keys) {
    const parsed = parsePair(k);
    if (parsed) {
      slugs.add(parsed[0]);
      slugs.add(parsed[1]);
    }
  }
  const rows = await prisma.aiModel.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, name: true, nameMn: true },
  });
  const names = new Map(rows.map((r) => [r.slug, r.nameMn ?? r.name]));

  return keys.flatMap((k) => {
    const parsed = parsePair(k);
    if (!parsed) return [];
    const [x, y] = parsed;
    const nx = names.get(x);
    const ny = names.get(y);
    if (!nx || !ny) return [];
    return [{ key: k, label: `${nx} vs ${ny}` }];
  });
}
