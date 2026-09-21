import Link from "next/link";
import { getLeaderboard, getSourceNote } from "@/data";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { fmtDate } from "@/components/format";

export const revalidate = 3600;
export const metadata = { title: "Жагсаалт" };

type Search = { company?: string; open?: string };

export default async function Jagsaalt({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [{ date, rows }, note] = await Promise.all([getLeaderboard(50), getSourceNote()]);

  const companies = [...new Map(rows.map((r) => [r.company.slug, r.company.name])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const filtered = rows.filter(
    (r) => (!sp.company || r.company.slug === sp.company) && (!sp.open || (sp.open === "1") === r.model.isOpenWeights),
  );

  const link = (patch: Partial<Search>) => {
    const q = new URLSearchParams();
    const next = { ...sp, ...patch };
    if (next.company) q.set("company", next.company);
    if (next.open) q.set("open", next.open);
    const s = q.toString();
    return s ? `/jagsaalt?${s}` : "/jagsaalt";
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">{fmtDate(date)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Хэрэглээгээр эрэмбэлсэн топ 50</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={link({ open: undefined })} className={chip(!sp.open)}>Бүгд</Link>
        <Link href={link({ open: "1" })} className={chip(sp.open === "1")}>Нээлттэй жин</Link>
        <Link href={link({ open: "0" })} className={chip(sp.open === "0")}>Хаалттай</Link>
        <span className="w-px bg-line mx-1" />
        <Link href={link({ company: undefined })} className={chip(!sp.company)}>Бүх компани</Link>
        {companies.map(([slug, name]) => (
          <Link key={slug} href={link({ company: slug })} className={chip(sp.company === slug)}>{name}</Link>
        ))}
      </div>

      <LeaderboardTable rows={filtered} />
      <p className="text-xs text-muted">{note} Байр бүтэн жагсаалтын байр (шүүлтээр өөрчлөгдөхгүй).</p>
    </div>
  );
}
