/**
 * Моделийн дүн — жигнэсэн дундаж, ангиллын оноо, эрэмбэ, өмнөх сартай харьцуулалт.
 */
import { finalScore } from "./judge.api";
import type { BenchCategory } from "../generated/prisma/enums";

export interface ScoredResult {
  modelSlug: string;
  category: BenchCategory;
  /** Даалгаврын жин */
  weight: number;
  latencyMs: number;
  costUsd: number;
  outputWords: number;
  humanScore?: number | null;
  checkerPass?: boolean | null;
  judgeScore?: number | null;
  error?: string | null;
}

export interface ModelSummary {
  modelSlug: string;
  avgScore: number;
  scoreByCategory: Record<string, number>;
  avgLatency: number;
  /** Монгол 1000 үг гаргахад USD — бодит хэмжилтээс */
  costPer1kMn: number;
  completed: number;
  rank: number;
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Жигнэсэн дундаж. Жин нийлбэр 0 бол 0. */
function weightedAvg(items: { score: number; weight: number }[]): number {
  const total = items.reduce((n, i) => n + i.weight, 0);
  if (total === 0) return 0;
  return items.reduce((n, i) => n + i.score * i.weight, 0) / total;
}

/**
 * Үр дүнгээс моделийн дүнг гаргана.
 *
 * Эрэмбэ нь оноогоор; тэнцвэл хурдан нь дээгүүр (ижил чанартай бол хурд шийднэ).
 */
export function summarize(results: ScoredResult[]): ModelSummary[] {
  const byModel = new Map<string, ScoredResult[]>();
  for (const r of results) {
    const list = byModel.get(r.modelSlug) ?? [];
    list.push(r);
    byModel.set(r.modelSlug, list);
  }

  const summaries = [...byModel].map(([modelSlug, rows]) => {
    const scored = rows.map((r) => ({ score: finalScore(r), weight: r.weight, row: r }));

    const byCategory: Record<string, number> = {};
    const categories = new Set(rows.map((r) => r.category));
    for (const c of categories) {
      const inCat = scored.filter((s) => s.row.category === c);
      byCategory[c] = round(weightedAvg(inCat), 1);
    }

    const done = rows.filter((r) => !r.error);
    const words = done.reduce((n, r) => n + r.outputWords, 0);
    const cost = done.reduce((n, r) => n + r.costUsd, 0);

    return {
      modelSlug,
      avgScore: round(weightedAvg(scored), 2),
      scoreByCategory: byCategory,
      avgLatency: done.length ? Math.round(done.reduce((n, r) => n + r.latencyMs, 0) / done.length) : 0,
      costPer1kMn: words > 0 ? round((cost / words) * 1_000, 4) : 0,
      completed: done.length,
      rank: 0,
    };
  });

  summaries.sort((a, b) => b.avgScore - a.avgScore || a.avgLatency - b.avgLatency);
  return summaries.map((s, i) => ({ ...s, rank: i + 1 }));
}

export interface RankDelta {
  /** +2 = 2 байр дээшилсэн. null = өмнөх сард байгаагүй. */
  rankDelta: number | null;
  /** Оноо хэдээр өөрчлөгдсөн. null = өмнөх сард байгаагүй. */
  scoreDelta: number | null;
}

/** Өмнөх сарын дүнтэй харьцуулна */
export function deltaVs(
  current: { modelSlug: string; rank: number; avgScore: number },
  previous: { modelSlug: string; rank: number; avgScore: number }[],
): RankDelta {
  const before = previous.find((p) => p.modelSlug === current.modelSlug);
  if (!before) return { rankDelta: null, scoreDelta: null };
  return {
    // Байр 1 болж дээшилвэл эерэг тоо
    rankDelta: before.rank - current.rank,
    scoreDelta: round(current.avgScore - before.avgScore, 2),
  };
}

/** Heat cell-ийн өнгөний эрч — 0–10 оноог 0–1 болгоно */
export function heat(score: number): number {
  return Math.min(1, Math.max(0, score / 10));
}

/** "2026-10" → "2026 оны 10-р сар" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return y && m ? `${y} оны ${Number(m)}-р сар` : month;
}

/** Өнөөдрийн сарын түлхүүр (УБ цагаар) */
export function currentMonth(now = new Date()): string {
  const ub = new Date(now.getTime() + 8 * 3_600_000);
  return `${ub.getUTCFullYear()}-${String(ub.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10"-ийн өмнөх сар */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
