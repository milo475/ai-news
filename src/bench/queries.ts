/**
 * Бенчмаркийн унших query-ууд.
 */
import { prisma } from "../db";
import { modelMeta } from "./models";
import { deltaVs, monthLabel, type RankDelta } from "./summary.api";
import type { BenchCategory } from "../generated/prisma/enums";

/** scoreByCategory Json-ийг аюулгүй унших */
export function parseCategoryScores(raw: unknown): Partial<Record<BenchCategory, number>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<BenchCategory, number>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k as BenchCategory] = v;
  }
  return out;
}

export interface BoardRow {
  rank: number;
  modelSlug: string;
  name: string;
  company: string;
  avgScore: number;
  scoreByCategory: Partial<Record<BenchCategory, number>>;
  avgLatency: number;
  costPer1kMn: number;
  completed: number;
  delta: RankDelta;
}

export interface Board {
  month: string;
  label: string;
  finishedAt: Date | null;
  judgeModel: string;
  taskCount: number;
  rows: BoardRow[];
}

/** Хамгийн сүүлийн дууссан run (эсвэл заасан сар) */
export async function latestBoard(month?: string): Promise<Board | null> {
  const run = await prisma.benchRun.findFirst({
    where: month ? { month } : { status: { in: ["DONE", "BUDGET"] } },
    orderBy: { month: "desc" },
    select: { id: true, month: true, finishedAt: true, judgeModel: true },
  });
  if (!run) return null;

  const summaries = await prisma.benchModelSummary.findMany({
    where: { runId: run.id },
    orderBy: { rank: "asc" },
  });
  if (summaries.length === 0) return null;

  // Өмнөх сарын дүн — Δ тооцоход
  const prevRun = await prisma.benchRun.findFirst({
    where: { month: { lt: run.month }, status: { in: ["DONE", "BUDGET"] } },
    orderBy: { month: "desc" },
    select: { id: true },
  });
  const previous = prevRun
    ? await prisma.benchModelSummary.findMany({
        where: { runId: prevRun.id },
        select: { modelSlug: true, rank: true, avgScore: true },
      })
    : [];

  const meta = await modelMeta(summaries.map((s) => s.modelSlug));
  const taskCount = await prisma.benchResult.groupBy({
    by: ["taskId"],
    where: { runId: run.id },
    _count: true,
  });

  return {
    month: run.month,
    label: monthLabel(run.month),
    finishedAt: run.finishedAt,
    judgeModel: run.judgeModel,
    taskCount: taskCount.length,
    rows: summaries.map((s) => ({
      rank: s.rank,
      modelSlug: s.modelSlug,
      name: meta.get(s.modelSlug)?.name ?? s.modelSlug,
      company: meta.get(s.modelSlug)?.company ?? "",
      avgScore: s.avgScore,
      scoreByCategory: parseCategoryScores(s.scoreByCategory),
      avgLatency: s.avgLatency,
      costPer1kMn: s.costPer1kMn,
      completed: s.completed,
      delta: deltaVs(s, previous),
    })),
  };
}

export interface ModelDetail {
  month: string;
  label: string;
  row: BoardRow;
  /** Ангилал бүрийн шүүгчийн тайлбарын жишээ */
  notes: { category: BenchCategory; taskTitle: string; score: number | null; note: string }[];
  /** Нээлттэй даалгавар дээрх бодит хариулт */
  publicSamples: {
    taskTitle: string;
    taskSlug: string;
    prompt: string;
    output: string;
    score: number | null;
    note: string | null;
  }[];
}

export async function modelDetail(modelSlug: string, month?: string): Promise<ModelDetail | null> {
  const board = await latestBoard(month);
  const row = board?.rows.find((r) => r.modelSlug === modelSlug);
  if (!board || !row) return null;

  const run = await prisma.benchRun.findUniqueOrThrow({
    where: { month: board.month },
    select: { id: true },
  });

  const results = await prisma.benchResult.findMany({
    where: { runId: run.id, modelSlug },
    orderBy: { judgeScore: "desc" },
    select: {
      output: true, judgeScore: true, judgeNotes: true, humanScore: true, humanNote: true,
      task: { select: { slug: true, title: true, category: true, prompt: true, isPublic: true } },
    },
  });

  // Ангилал тус бүрээс нэг жишээ тайлбар
  const seen = new Set<BenchCategory>();
  const notes: ModelDetail["notes"] = [];
  for (const r of results) {
    if (seen.has(r.task.category) || !r.judgeNotes) continue;
    seen.add(r.task.category);
    notes.push({
      category: r.task.category,
      taskTitle: r.task.title,
      score: r.humanScore ?? r.judgeScore,
      note: r.humanNote ?? r.judgeNotes,
    });
  }

  return {
    month: board.month,
    label: board.label,
    row,
    notes,
    publicSamples: results
      .filter((r) => r.task.isPublic)
      .map((r) => ({
        taskTitle: r.task.title,
        taskSlug: r.task.slug,
        prompt: r.task.prompt,
        output: r.output,
        score: r.humanScore ?? r.judgeScore,
        note: r.humanNote ?? r.judgeNotes,
      })),
  };
}

/** /model/[slug] хуудсанд харуулах нэг тоо */
export async function benchScoreFor(modelSlug: string): Promise<{ score: number; rank: number; month: string; label: string } | null> {
  const run = await prisma.benchRun.findFirst({
    where: { status: { in: ["DONE", "BUDGET"] } },
    orderBy: { month: "desc" },
    select: { id: true, month: true },
  });
  if (!run) return null;

  const s = await prisma.benchModelSummary.findUnique({
    where: { runId_modelSlug: { runId: run.id, modelSlug } },
    select: { avgScore: true, rank: true },
  });
  return s ? { score: s.avgScore, rank: s.rank, month: run.month, label: monthLabel(run.month) } : null;
}

/** Нүүрний Топ 10-ийн «MN» багана — олон моделийн оноог нэг дуудлагаар */
export async function benchScores(modelSlugs: string[]): Promise<Map<string, number>> {
  if (modelSlugs.length === 0) return new Map();
  const run = await prisma.benchRun.findFirst({
    where: { status: { in: ["DONE", "BUDGET"] } },
    orderBy: { month: "desc" },
    select: { id: true },
  });
  if (!run) return new Map();

  const rows = await prisma.benchModelSummary.findMany({
    where: { runId: run.id, modelSlug: { in: modelSlugs } },
    select: { modelSlug: true, avgScore: true },
  });
  return new Map(rows.map((r) => [r.modelSlug, r.avgScore]));
}

/** Нээлттэй жишээ даалгавар — /benchmark хуудсанд */
export async function publicTasks() {
  return prisma.benchTask.findMany({
    where: { isActive: true, isPublic: true },
    select: { slug: true, title: true, category: true, prompt: true },
  });
}

/** Ангиллын тоо — аргачлалын хуудсанд */
export async function taskCountByCategory(): Promise<Partial<Record<BenchCategory, number>>> {
  const rows = await prisma.benchTask.groupBy({
    by: ["category"],
    where: { isActive: true },
    _count: true,
  });
  const out: Partial<Record<BenchCategory, number>> = {};
  for (const r of rows) out[r.category] = r._count;
  return out;
}
