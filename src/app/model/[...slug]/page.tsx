import { notFound } from "next/navigation";
import Link from "next/link";
import { getHistory, getModel, getNewsForModel, getSourceNote } from "@/data";
import { NewsList } from "@/components/NewsList";
import { RankChart } from "@/components/RankChart";
import { fmtDate, fmtTokens } from "@/components/format";

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
  const [history, arenaHistory, note, arenaNote, news] = await Promise.all([
    getHistory(slug, 30),
    getHistory(slug, 30, "ARENA_ELO"),
    getSourceNote(),
    getSourceNote("ARENA_ELO"),
    getNewsForModel(slug, 5),
  ]);
  const last = history[history.length - 1];
  const best = history.length ? Math.min(...history.map((h) => h.rank)) : null;

  const fact = (k: string, v: React.ReactNode) => (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs text-muted">{k}</p>
      <p className="font-medium tabular-nums">{v}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/jagsaalt" className="text-sm text-muted hover:text-ink">← Жагсаалт</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{m.nameMn ?? m.name}</h1>
        <p className="text-muted">
          {m.company.name} · {m.isOpenWeights ? "нээлттэй жин" : "хаалттай"} · нэмэгдсэн {fmtDate(m.releasedAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fact("Өнөөдрийн байр", last ? `#${last.rank}` : "—")}
        {fact("30 хоногийн шилдэг", best ? `#${best}` : "—")}
        {fact("Токен / өдөр", last ? fmtTokens(last.score) : "—")}
        {fact("Context", m.contextLength ? `${Math.round(m.contextLength / 1000)}K` : "—")}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Байрны өөрчлөлт, 30 хоног</h2>
        <div className="rounded-lg border border-line p-4">
          <RankChart points={history} arena={arenaHistory} />
        </div>
        <p className="text-xs text-muted">
          {note}
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
