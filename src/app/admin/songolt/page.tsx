import Link from "next/link";
import { quizStats } from "@/songolt/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Асуулга — админ" };

export default async function AdminSongolt() {
  const s = await quizStats(30);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Асуулга</h1>
        </div>
        <Link href="/songolt" className="text-sm text-accent hover:underline">Асуулга харах →</Link>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Эхэлсэн" value={s.starts} hint="сүүлийн 30 хоног" />
        <Stat label="Дууссан" value={s.finishes} />
        <Stat
          label="Дуусгалт"
          value={`${s.completion}%`}
          hint={s.starts === 0 ? "өгөгдөл алга" : `${s.finishes} / ${s.starts}`}
        />
      </section>

      <section className="rounded-lg border border-line p-4 space-y-2">
        <h2 className="text-sm font-semibold">Хамгийн их санал болгогдсон (#1 байрт)</h2>
        {s.topTools.length === 0 ? (
          <p className="text-sm text-muted">Дууссан асуулга хараахан алга.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {s.topTools.map((t, i) => (
              <li key={t.slug} className="flex gap-2">
                <span className="text-muted tabular-nums w-5">{i + 1}.</span>
                <Link href={`/hereglel/${t.slug}`} className="flex-1 hover:text-accent">{t.name}</Link>
                <span className="tabular-nums text-muted">{t.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {s.recent.length > 0 && (
        <section className="rounded-lg border border-line p-4 space-y-2">
          <h2 className="text-sm font-semibold">Сүүлийн 14 хоног</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-line">
                <th className="py-1.5 text-left font-normal">Өдөр</th>
                <th className="py-1.5 text-right font-normal">Эхэлсэн</th>
                <th className="py-1.5 text-right font-normal">Дууссан</th>
                <th className="py-1.5 text-right font-normal">Дуусгалт</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((d) => (
                <tr key={d.day} className="border-b border-line last:border-0">
                  <td className="py-1.5">{d.day}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.starts}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.finishes}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">
                    {d.starts === 0 ? "—" : `${Math.round((d.finishes / d.starts) * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-muted">
        Алхам тус бүрийн уналтыг Umami-гаас үзнэ үү: <code>quiz_start</code>,{" "}
        <code>quiz_step_1</code>…<code>quiz_step_5</code>, <code>quiz_finish</code>,{" "}
        <code>quiz_share</code>.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
