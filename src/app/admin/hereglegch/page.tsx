import Link from "next/link";
import { fmtDate } from "@/components/format";
import { userStats } from "@/queries/user-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Хэрэглэгчид — админ" };

export default async function AdminUsers() {
  const s = await userStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Хэрэглэгчид</h1>
        <Link href="/admin" className="text-sm text-accent hover:underline">← Админ</Link>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Нийт бүртгэл" value={s.total} />
        <Stat label="Баталгаажсан" value={`${s.verifiedPct}%`} hint={`${s.verified} / ${s.total}`} />
        <Stat label="Сонирхол тохируулсан" value={s.withPreference} />
        <Stat label="Хадгалсан нийтлэл" value={s.topBookmarked.reduce((n, a) => n + a.count, 0)} hint="топ 10-ын дүн" />
      </section>

      <section className="rounded-lg border border-line p-4 space-y-2">
        <h2 className="text-sm font-semibold">Сүүлийн 20 бүртгэл</h2>
        {s.recent.length === 0 ? (
          <p className="text-sm text-muted">Бүртгэл алга.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {s.recent.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="py-1 pr-2 break-all">
                    {u.email}
                    {u.name && <span className="text-muted"> · {u.name}</span>}
                  </td>
                  <td className="py-1 text-xs text-muted w-16">{u.provider}</td>
                  <td className="py-1 text-xs w-24">
                    {u.verified ? <span className="text-up">баталгаажсан</span> : <span className="text-warn">хүлээгдэж буй</span>}
                  </td>
                  <td className="py-1 text-right text-xs text-muted tabular-nums w-24">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-line p-4 space-y-2">
        <h2 className="text-sm font-semibold">Хамгийн их хадгалагдсан топ 10</h2>
        {s.topBookmarked.length === 0 ? (
          <p className="text-sm text-muted">Хэн ч нийтлэл хадгалаагүй байна.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {s.topBookmarked.map((a, i) => (
              <li key={a.id} className="flex gap-2">
                <span className="text-muted tabular-nums w-5">{i + 1}.</span>
                <Link href={`/medee/${a.slug}`} className="flex-1 hover:text-accent">{a.titleMn}</Link>
                <span className="tabular-nums text-muted">{a.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
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
