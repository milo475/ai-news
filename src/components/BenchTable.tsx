import Link from "next/link";
import type { BoardRow } from "@/bench/queries";
import { BENCH_CATEGORIES, BENCH_CATEGORY_LABEL, BENCH_CATEGORY_SHORT } from "@/bench/task.api";
import { heat } from "@/bench/summary.api";
import type { BenchCategory } from "@/generated/prisma/enums";

/** Онооны нүд — оноо өндөр байх тусам өнгө тод */
function HeatCell({ score }: { score: number | undefined }) {
  if (score === undefined) return <td className="py-1.5 px-1 text-center text-muted">—</td>;
  return (
    <td className="py-1.5 px-1 text-center tabular-nums">
      <span
        className="inline-block w-9 rounded py-0.5 text-xs"
        style={{ backgroundColor: `color-mix(in oklch, var(--color-accent) ${heat(score) * 55}%, transparent)` }}
      >
        {score.toFixed(1)}
      </span>
    </td>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-accent text-xs">шинэ</span>;
  if (value === 0) return <span className="text-muted text-xs">—</span>;
  return (
    <span className={`text-xs ${value > 0 ? "text-up" : "text-down"}`}>
      {value > 0 ? `▲ ${value}` : `▼ ${Math.abs(value)}`}
    </span>
  );
}

export function BenchTable({
  rows,
  /** Зөвхөн энэ ангиллын оноогоор эрэмбэлж харуулах */
  category,
}: {
  rows: BoardRow[];
  category?: BenchCategory;
}) {
  const shown = category
    ? [...rows]
        .filter((r) => r.scoreByCategory[category] !== undefined)
        .sort((a, b) => (b.scoreByCategory[category] ?? 0) - (a.scoreByCategory[category] ?? 0))
    : rows;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-3xl">
        <thead>
          <tr className="text-xs text-muted border-b border-line">
            <th className="py-2 pr-2 text-left w-8">#</th>
            <th className="py-2 pr-2 text-left">Модель</th>
            <th className="py-2 px-2 text-right">Оноо</th>
            <th className="py-2 px-1 text-center w-14">Δ</th>
            {BENCH_CATEGORIES.map((c) => (
              <th key={c} className="py-2 px-1 text-center font-normal" title={BENCH_CATEGORY_LABEL[c]}>
                {BENCH_CATEGORY_SHORT[c]}
              </th>
            ))}
            <th className="py-2 px-2 text-right">Хурд</th>
            <th className="py-2 pl-2 text-right" title="Монгол 1000 үг гаргахад">1000 үг</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={r.modelSlug} className="border-b border-line last:border-0 hover:bg-line/30">
              <td className="py-1.5 pr-2 tabular-nums text-muted">{category ? i + 1 : r.rank}</td>
              <td className="py-1.5 pr-2">
                <Link href={`/benchmark/${encodeURIComponent(r.modelSlug)}`} className="hover:text-accent">
                  {r.name}
                </Link>
                <span className="block text-xs text-muted">{r.company}</span>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums font-medium">
                {(category ? (r.scoreByCategory[category] ?? 0) : r.avgScore).toFixed(2)}
              </td>
              <td className="py-1.5 px-1 text-center">
                <Delta value={r.delta.rankDelta} />
              </td>
              {BENCH_CATEGORIES.map((c) => (
                <HeatCell key={c} score={r.scoreByCategory[c]} />
              ))}
              <td className="py-1.5 px-2 text-right tabular-nums text-muted">
                {(r.avgLatency / 1000).toFixed(1)}с
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-muted">
                {r.costPer1kMn > 0 ? `$${r.costPer1kMn.toFixed(3)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
