import type { HistoryPoint } from "@/data";

/** Байрны түүх — дээшээ = сайн. SVG, гадаад сангүй. */
export function RankChart({ points, maxRank = 50 }: { points: HistoryPoint[]; maxRank?: number }) {
  if (points.length < 2) return <p className="text-sm text-muted">Түүх хараахан хуримтлагдаагүй.</p>;
  const W = 640, H = 200, P = { l: 32, r: 12, t: 12, b: 24 };
  const worst = Math.min(maxRank, Math.max(...points.map((p) => p.rank)) + 2);
  const x = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (r: number) => P.t + ((r - 1) / (worst - 1)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(" ");
  const ticks = [1, Math.ceil(worst / 2), worst];
  const first = points[0]!, last = points[points.length - 1]!;
  const fmt = (dt: Date) => `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Байрны өөрчлөлт">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.55}>#{t}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last.rank)} r={4} fill="var(--color-accent)" />
      <text x={P.l} y={H - 6} fontSize={11} fill="currentColor" fillOpacity={0.55}>{fmt(first.date)}</text>
      <text x={W - P.r} y={H - 6} fontSize={11} textAnchor="end" fill="currentColor" fillOpacity={0.55}>{fmt(last.date)}</text>
    </svg>
  );
}
