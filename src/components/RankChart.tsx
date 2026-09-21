import type { HistoryPoint } from "@/data";

/**
 * Байрны түүх — дээшээ = сайн. SVG, гадаад сангүй.
 * arena өгөгдөл байвал хоёр дахь мөрөөр (LMArena Elo-гийн байр) нэмнэ.
 */
export function RankChart({
  points,
  arena = [],
  maxRank = 50,
}: {
  points: HistoryPoint[];
  arena?: HistoryPoint[];
  maxRank?: number;
}) {
  const hasUsage = points.length >= 2;
  const hasArena = arena.length >= 2;
  if (!hasUsage && !hasArena) return <p className="text-sm text-muted">Түүх хараахан хуримтлагдаагүй.</p>;
  const W = 640, H = 200, P = { l: 32, r: 12, t: 12, b: 24 };
  const all = [...points, ...arena];
  const worst = Math.min(maxRank, Math.max(...all.map((p) => p.rank)) + 2);

  // Хоёр цувааг нэг цагийн тэнхлэг дээр тавина
  const times = all.map((p) => p.date.getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (d: Date) => P.l + (t1 === t0 ? 1 : (d.getTime() - t0) / (t1 - t0)) * (W - P.l - P.r);
  const y = (r: number) => P.t + ((r - 1) / (worst - 1)) * (H - P.t - P.b);
  const path = (ps: HistoryPoint[]) =>
    ps.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.rank).toFixed(1)}`).join(" ");

  const ticks = [1, Math.ceil(worst / 2), worst];
  const last = points[points.length - 1];
  const lastArena = arena[arena.length - 1];
  const fmt = (dt: Date) => `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Байрны өөрчлөлт">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.55}>#{t}</text>
          </g>
        ))}
        {hasArena && (
          <>
            <path d={path(arena)} fill="none" stroke="var(--color-up)" strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" />
            {lastArena && <circle cx={x(lastArena.date)} cy={y(lastArena.rank)} r={4} fill="var(--color-up)" />}
          </>
        )}
        {hasUsage && last && (
          <>
            <path d={path(points)} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
            <circle cx={x(last.date)} cy={y(last.rank)} r={4} fill="var(--color-accent)" />
          </>
        )}
        <text x={P.l} y={H - 6} fontSize={11} fill="currentColor" fillOpacity={0.55}>{fmt(new Date(t0))}</text>
        <text x={W - P.r} y={H - 6} fontSize={11} textAnchor="end" fill="currentColor" fillOpacity={0.55}>{fmt(new Date(t1))}</text>
      </svg>

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {hasUsage && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5" style={{ background: "var(--color-accent)" }} />
            Хэрэглээний байр (OpenRouter)
          </span>
        )}
        {hasArena && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5" style={{ background: "var(--color-up)" }} />
            Чанарын байр (LMArena Elo)
          </span>
        )}
      </div>
    </div>
  );
}
