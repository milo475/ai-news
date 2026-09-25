import { notFound } from "next/navigation";
import Link from "next/link";
import { getHistory, getModel, getNewsForModel, getSourceNote } from "@/data";
import { NewsList } from "@/components/NewsList";
import { RankChart } from "@/components/RankChart";
import { fmtDate, fmtTokens } from "@/components/format";
import { TrackEvent } from "@/components/Track";
import { benchScoreFor } from "@/bench/queries";

export const revalidate = 3600;

type Params = { slug: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const slug = (await params).slug.join("/");
  const m = await getModel(slug);
  return { title: m ? m.nameMn ?? m.name : "Модель" };
}

export default async function ModelPage({ params }: { params: Promise<Params> }) {
  const slug = (await params).slug.join("/");
  const m = await getModel(slug);
  if (!m) notFound();
  const [history, arenaHistory, note, arenaNote, news, bench] = await Promise.all([
    getHistory(slug, 30),
    getHistory(slug, 30, "ARENA_ELO"),
    getSourceNote(),
    getSourceNote("ARENA_ELO"),
    getNewsForModel(slug, 5),
    benchScoreFor(slug),
  ]);
  const last = history[history.length - 1];
  const best = history.length ? Math.min(...history.map((h) => h.rank)) : null;
  const lastArena = arenaHistory[arenaHistory.length - 1];

  const fact = (k: string, v: React.ReactNode) => (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs text-muted">{k}</p>
      <p className="font-medium tabular-nums">{v}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <TrackEvent event="model_view" data={{ slug }} />
      <div className="space-y-2">
        <Link href="/jagsaalt" className="text-sm text-muted hover:text-ink">← Жагсаалт</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{m.nameMn ?? m.name}</h1>
        <p className="text-muted">
          {m.company.name} · {m.isOpenWeights ? "нээлттэй жин" : "хаалттай"}
          {!m.arenaOnly && <> · нэмэгдсэн {fmtDate(m.releasedAt)}</>}
        </p>
        {m.arenaOnly && (
          <p className="text-xs text-muted">
            Энэ модель зөвхөн LMArena-д байдаг — OpenRouter-ээр хэрэглээний өгөгдөл байхгүй.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {!m.arenaOnly && fact("Өнөөдрийн байр", last ? `#${last.rank}` : "—")}
        {!m.arenaOnly && fact("30 хоногийн шилдэг", best ? `#${best}` : "—")}
        {!m.arenaOnly && fact("Токен / өдөр", last ? fmtTokens(last.score) : "—")}
        {lastArena && fact("Чанарын байр", `#${lastArena.rank}`)}
        {lastArena && fact("Elo", Math.round(Number(lastArena.score)).toString())}
        {fact("Context", m.contextLength ? `${Math.round(m.contextLength / 1000)}K` : "—")}
      </div>

      {bench && (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Монгол хэлний оноо</h2>
            <Link href="/benchmark" className="text-sm text-accent hover:underline">Бүтэн эрэмбэ →</Link>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {bench.score.toFixed(2)}
            <span className="text-base text-muted font-normal"> / 10 · {bench.rank}-р байр</span>
          </p>
          <p className="text-xs text-muted">
            {bench.label}-ийн хэмжилт. Орчуулга, товчлол, албан бичиг, тоон бодлого, монгол соёлын
            даалгаварт өгсөн оноо.{" "}
            <Link href={`/benchmark/${encodeURIComponent(slug)}`} className="text-accent hover:underline">
              дэлгэрэнгүй
            </Link>
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Байрны өөрчлөлт, 30 хоног</h2>
        <div className="rounded-lg border border-line p-4">
          <RankChart points={history} arena={arenaHistory} />
        </div>
        <p className="text-xs text-muted">
          {!m.arenaOnly && note}
          {arenaHistory.length > 0 && <> {arenaNote}</>}
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Тухай</h2>
          <p className="text-sm leading-relaxed">
            {m.descriptionMn ?? m.descriptionEn ?? "Тайлбар алга."}
          </p>
          {!m.descriptionMn && m.descriptionEn && (
            <p className="text-xs text-muted">Монгол тайлбар удахгүй нэмэгдэнэ.</p>
          )}
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Үнэ (1 сая токен, USD)</h2>
          <table className="text-sm w-full">
            <tbody>
              <tr className="border-b border-line"><td className="py-1.5 text-muted">Оролт</td><td className="py-1.5 text-right tabular-nums">{m.inputPricePerM ? `$${Number(m.inputPricePerM)}` : "—"}</td></tr>
              <tr className="border-b border-line"><td className="py-1.5 text-muted">Гаралт</td><td className="py-1.5 text-right tabular-nums">{m.outputPricePerM ? `$${Number(m.outputPricePerM)}` : "—"}</td></tr>
              <tr><td className="py-1.5 text-muted">Оролтын төрөл</td><td className="py-1.5 text-right">{m.modality ?? "—"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {news.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Холбоотой мэдээ</h2>
          <NewsList items={news} />
        </section>
      )}
    </div>
  );
}
