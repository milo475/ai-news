import Link from "next/link";
import type { LeaderboardRow } from "@/queries/leaderboard";
import { fmtPct, fmtTokens } from "./format";

export function Trend({ row }: { row: LeaderboardRow }) {
  if (row.trend === "new") return <span className="text-accent text-xs font-medium">шинэ</span>;
  if (row.trend === "same") return <span className="text-muted">–</span>;
  const up = row.trend === "up";
  return (
    <span className={up ? "text-up" : "text-down"}>
      {up ? "▲" : "▼"} {Math.abs(row.rankDelta ?? 0)}
    </span>
  );
}

const pctClass = (p: number | null) => (p === null ? "text-muted" : p >= 0 ? "text-up" : "text-down");

/** Elo-г бүхэл тоогоор, өөрчлөлтийг оноогоор */
const fmtElo = (s: string) => Math.round(Number(s)).toString();
const fmtEloDelta = (s: string | null) => {
  if (s === null) return "";
  const n = Math.round(Number(s) * 10) / 10;
  return `${n > 0 ? "+" : ""}${n}`;
};

export function LeaderboardTable({
  rows,
  compact = false,
  metric = "tokens",
  empty = "Жагсаалтын өгөгдөл хараахан бэлэн болоогүй байна.",
}: {
  rows: LeaderboardRow[];
  compact?: boolean;
  /** tokens = OpenRouter хэрэглээ, elo = LMArena Elo */
  metric?: "tokens" | "elo";
  empty?: string;
}) {
  const elo = metric === "elo";
  const value = (r: LeaderboardRow) => (elo ? fmtElo(r.score) : fmtTokens(r.score));
  const change = (r: LeaderboardRow) => (elo ? fmtEloDelta(r.scoreDelta) : fmtPct(r.scoreDeltaPct));
  const changeClass = (r: LeaderboardRow) =>
    elo ? (r.scoreDelta === null ? "text-muted" : Number(r.scoreDelta) >= 0 ? "text-up" : "text-down") : pctClass(r.scoreDeltaPct);
  if (rows.length === 0) {
    return <div className="rounded-lg border border-line p-8 text-center text-sm text-muted">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
        <thead className="text-xs uppercase tracking-wide text-muted border-b border-line">
          <tr>
            <th className="text-left px-3 py-2 w-12">#</th>
            <th className="text-left px-3 py-2 w-14">Δ</th>
            <th className="text-left px-3 py-2">Модель</th>
            <th className="text-left px-3 py-2 hidden sm:table-cell">Компани</th>
            {!compact && <th className="text-left px-3 py-2">Төрөл</th>}
            <th className="text-right px-3 py-2">{elo ? "Elo" : "Токен / өдөр"}</th>
            <th className="text-right px-3 py-2 w-20 hidden sm:table-cell">Өөрчлөлт</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model.slug} className="border-b border-line last:border-0 hover:bg-line/30">
              <td className="px-3 py-2 tabular-nums text-muted">{r.rank}</td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap"><Trend row={r} /></td>
              <td className="px-3 py-2 font-medium">
                <Link href={`/model/${r.model.slug}`} className="hover:text-accent">
                  {r.model.nameMn ?? r.model.name}
                </Link>
                <span className="block sm:hidden text-xs text-muted font-normal">{r.company.name}</span>
              </td>
              <td className="px-3 py-2 text-muted hidden sm:table-cell">{r.company.name}</td>
              {!compact && (
                <td className="px-3 py-2">
                  <span className={`text-xs rounded px-1.5 py-0.5 border ${r.model.isOpenWeights ? "border-up/40 text-up" : "border-line text-muted"}`}>
                    {r.model.isOpenWeights ? "нээлттэй" : "хаалттай"}
                  </span>
                </td>
              )}
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {value(r)}
                <span className={`block sm:hidden text-xs ${changeClass(r)}`}>{change(r)}</span>
              </td>
              <td className={`px-3 py-2 text-right tabular-nums hidden sm:table-cell ${changeClass(r)}`}>
                {change(r)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
