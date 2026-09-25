import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackEvent } from "@/components/Track";
import { modelDetail } from "@/bench/queries";
import { BENCH_CATEGORIES, BENCH_CATEGORY_LABEL } from "@/bench/task.api";
import { heat } from "@/bench/summary.api";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { modelSlug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const slug = decodeURIComponent((await params).modelSlug);
  const d = await modelDetail(slug);
  if (!d) return { title: "Бенчмарк" };

  const title = `${d.row.name} — монгол хэлний оноо ${d.row.avgScore.toFixed(2)}/10`;
  const description =
    `${d.row.name} (${d.row.company}) нь ${d.label}-ийн монгол хэлний тестэд ${d.row.rank}-р байрт ` +
    `орлоо. Ангилал бүрийн оноо, шүүгчийн тайлбар.`;
  return {
    title,
    description: clamp(description, MAX_META_DESCRIPTION),
    alternates: { canonical: `${siteUrl()}/benchmark/${encodeURIComponent(slug)}` },
  };
}

export default async function BenchModelPage({ params }: { params: Promise<Params> }) {
  const slug = decodeURIComponent((await params).modelSlug);
  const d = await modelDetail(slug);
  if (!d) notFound();

  const { row } = d;

  return (
    <article className="max-w-3xl space-y-6">
      <TrackEvent event="bench_model_view" data={{ model: slug, month: d.month }} />

      <div className="space-y-2">
        <Link href="/benchmark" className="text-sm text-muted hover:text-ink">← Бенчмарк</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{row.name}</h1>
        <p className="text-muted">{row.company} · {d.label}</p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Нийт оноо" value={`${row.avgScore.toFixed(2)}`} hint="0–10" />
        <Stat label="Байр" value={`${row.rank}`} hint={row.delta.rankDelta === null ? "шинэ" : `Δ ${row.delta.rankDelta}`} />
        <Stat label="Хурд" value={`${(row.avgLatency / 1000).toFixed(1)}с`} hint="дунджаар" />
        <Stat
          label="1000 үгийн үнэ"
          value={row.costPer1kMn > 0 ? `$${row.costPer1kMn.toFixed(3)}` : "—"}
          hint="монголоор"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Ангилал бүрийн оноо</h2>
        <ul className="space-y-1.5">
          {BENCH_CATEGORIES.map((c) => {
            const score = row.scoreByCategory[c];
            return (
              <li key={c} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 text-muted">{BENCH_CATEGORY_LABEL[c]}</span>
                <span className="flex-1 h-2 rounded bg-line/50 overflow-hidden">
                  <span
                    className="block h-full bg-accent"
                    style={{ width: `${heat(score ?? 0) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right tabular-nums">
                  {score === undefined ? "—" : score.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {d.notes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Шүүгчийн тайлбар</h2>
          <p className="text-sm text-muted">Ангилал тус бүрээс нэг жишээ.</p>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {d.notes.map((n) => (
              <li key={n.category} className="p-3 space-y-1">
                <p className="text-xs text-muted">
                  {BENCH_CATEGORY_LABEL[n.category]} · {n.taskTitle}
                  {n.score !== null && <span className="ml-2 tabular-nums">{n.score.toFixed(1)}/10</span>}
                </p>
                <p className="text-sm">{n.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.publicSamples.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Нээлттэй даалгавар дээрх бодит хариулт</h2>
          {d.publicSamples.map((s) => (
            <div key={s.taskSlug} className="rounded-lg border border-line overflow-hidden">
              <div className="border-b border-line px-3 py-2">
                <p className="text-sm font-medium">{s.taskTitle}</p>
                {s.score !== null && (
                  <p className="text-xs text-muted tabular-nums">Оноо {s.score.toFixed(1)}/10</p>
                )}
              </div>
              <details className="border-b border-line">
                <summary className="cursor-pointer px-3 py-2 text-xs text-muted">Даалгавар</summary>
                <pre className="px-3 pb-3 text-xs whitespace-pre-wrap break-words font-mono text-muted">
                  {s.prompt}
                </pre>
              </details>
              <pre className="px-3 py-3 text-sm whitespace-pre-wrap break-words font-mono">
                {s.output}
              </pre>
              {s.note && <p className="border-t border-line px-3 py-2 text-xs text-muted">{s.note}</p>}
            </div>
          ))}
        </section>
      )}

      <p className="text-xs text-muted border-t border-line pt-4">
        Хэмжилтийн арга, хязгаарлалтыг{" "}
        <Link href="/benchmark/argachlal" className="text-accent hover:underline">аргачлалын хуудас</Link>
        {" "}дээрээс үзнэ үү.
      </p>
    </article>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
