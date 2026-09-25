import Link from "next/link";
import { getLeaderboard, getSourceNote } from "@/data";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { fmtDate } from "@/components/format";
import { TrackEvent } from "@/components/Track";

export const revalidate = 3600;
export const metadata = { title: "Жагсаалт" };

type Search = { company?: string; open?: string; tab?: string };

/** ?tab=chanar → LMArena Elo, үгүй бол OpenRouter хэрэглээ */
const TABS = [
  { key: "", label: "Хэрэглээ", source: "OPENROUTER_USAGE" as const, metric: "tokens" as const, event: "usage" },
  { key: "chanar", label: "Чанар", source: "ARENA_ELO" as const, metric: "elo" as const, event: "quality" },
];

export default async function Jagsaalt({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === (sp.tab ?? "")) ?? TABS[0]!;
  const [{ date, rows }, note] = await Promise.all([
    getLeaderboard(50, tab.source),
    getSourceNote(tab.source),
  ]);

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
    if (next.tab) q.set("tab", next.tab);
    const s = q.toString();
    return s ? `/jagsaalt?${s}` : "/jagsaalt";
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-accent text-accent" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="space-y-6">
      <TrackEvent event="ranking_tab" data={{ tab: tab.event }} />
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">{fmtDate(date)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tab.key === "chanar" ? "Чанараар эрэмбэлсэн топ 50" : "Хэрэглээгээр эрэмбэлсэн топ 50"}
        </h1>
      </div>

      <nav className="flex gap-4 text-sm border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key || "hereglee"}
            href={link({ tab: t.key || undefined })}
            className={`pb-2 -mb-px border-b-2 ${
              t.key === tab.key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

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

      <LeaderboardTable
        rows={filtered}
        metric={tab.metric}
        empty={
          rows.length > 0
            ? "Энэ шүүлтэд тохирох модель алга."
            : tab.key === "chanar"
              ? "Arena-гийн өгөгдөл хараахан татагдаагүй байна."
              : undefined
        }
      />
      <p className="text-xs text-muted">{note} Байр бүтэн жагсаалтын байр (шүүлтээр өөрчлөгдөхгүй).</p>
      {/* «Аргачлал» хуудсыг хассаны дараа эх сурвалжийн тайлбар энд нэг мөрөөр үлдсэн */}
      <p className="text-xs text-muted">
        Эх сурвалж: хэрэглээний жагсаалт{" "}
        <a href="https://openrouter.ai/rankings" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          OpenRouter
        </a>{" "}
        (өдөр тутмын токен, CC BY 4.0) — чанар биш хэрэглээг хэмжинэ; чанарын жагсаалт{" "}
        <a href="https://lmarena.ai" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          LMArena
        </a>{" "}
        (хүмүүсийн саналын Elo, долоо хоног тутам).
      </p>
    </div>
  );
}
