/**
 * Асуулгын DB тал — хэрэгслийн өгөгдөл цуглуулах, статистик.
 */
import { prisma } from "../db";
import { ubDateLabel } from "../jobs/day";
import { recommend, vendorForTool, type Answers, type Recommendation, type ScorableTool } from "./score.api";

/**
 * Онооход хэрэгтэй бүх өгөгдлийг нэг дор: каталог + 30 хоногийн товшилт +
 * бенчмаркийн MN оноо (нийлүүлэгчээр холбогдоно).
 */
export async function scorableTools(): Promise<ScorableTool[]> {
  const [tools, benchByVendor] = await Promise.all([
    prisma.tool.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true, slug: true, name: true, tagline: true, categories: true, pricing: true,
        priceFrom: true, mongolianSupport: true, platforms: true, upvotes: true,
      },
    }),
    bestScoreByVendor(),
  ]);

  const { clicksByTool } = await import("../tools/queries");
  const clicks = await clicksByTool(tools.map((t) => t.id));

  return tools.map((t) => {
    const vendor = vendorForTool(t.slug);
    return {
      ...t,
      clicks: clicks.get(t.id) ?? 0,
      mnScore: vendor ? (benchByVendor.get(vendor) ?? null) : null,
    };
  });
}

/**
 * Нийлүүлэгч бүрийн хамгийн өндөр MN оноо.
 *
 * Бенчмарк нь моделиудыг хэмждэг, каталог нь бүтээгдэхүүнийг. «ChatGPT» гэдэг нь
 * OpenAI-ийн аль ч моделийг хэрэглэж болох тул компанийн хамгийн сайныг авна.
 */
export async function bestScoreByVendor(): Promise<Map<string, number>> {
  const run = await prisma.benchRun.findFirst({
    where: { status: { in: ["DONE", "BUDGET"] } },
    orderBy: { month: "desc" },
    select: { id: true },
  });
  if (!run) return new Map();

  const rows = await prisma.benchModelSummary.findMany({
    where: { runId: run.id },
    select: { modelSlug: true, avgScore: true },
  });

  const best = new Map<string, number>();
  for (const r of rows) {
    const vendor = r.modelSlug.split("/")[0]?.toLowerCase();
    if (!vendor) continue;
    const current = best.get(vendor);
    if (current === undefined || r.avgScore > current) best.set(vendor, r.avgScore);
  }
  return best;
}

export interface ResultTool {
  rec: Recommendation;
  /** Энэ хэрэгслийн тухай заавар (tools-оор холбогдоно) */
  guide: { slug: string; title: string } | null;
  /** Энэ хэрэгсэлд тохирох prompt */
  prompt: { slug: string; title: string } | null;
}

/** Үр дүнгийн хуудсанд хэрэгтэй бүх зүйл */
export async function resultFor(answers: Answers): Promise<ResultTool[]> {
  const recs = recommend(await scorableTools(), answers, 3);
  if (recs.length === 0) return [];

  const names = recs.map((r) => r.tool.name);
  const [guides, prompts] = await Promise.all([
    prisma.guide.findMany({
      where: { status: "PUBLISHED", tools: { hasSome: names } },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, title: true, tools: true },
    }),
    prisma.prompt.findMany({
      where: { status: "PUBLISHED", tools: { hasSome: names } },
      orderBy: { copies: "desc" },
      select: { slug: true, title: true, tools: true },
    }),
  ]);

  return recs.map((rec) => ({
    rec,
    guide: guides.find((g) => g.tools.includes(rec.tool.name)) ?? null,
    prompt: prompts.find((p) => p.tools.includes(rec.tool.name)) ?? null,
  }));
}

// ——— Статистик ———

/** Асуулга эхэлсэн — дуусгалтын хувь тооцоход */
export async function countStart(now = new Date()): Promise<void> {
  const day = ubDateLabel(now);
  try {
    await prisma.quizDaily.upsert({
      where: { day },
      create: { day, starts: 1 },
      update: { starts: { increment: 1 } },
    });
  } catch {
    // тоолуур чухал биш
  }
}

/** Асуулга дууссан — үр дүнг хадгална */
export async function countFinish(code: string, toolSlugs: string[], now = new Date()): Promise<void> {
  const day = ubDateLabel(now);
  try {
    await prisma.$transaction([
      prisma.quizDaily.upsert({
        where: { day },
        create: { day, starts: 0, finishes: 1 },
        update: { finishes: { increment: 1 } },
      }),
      prisma.quizResult.create({ data: { code, toolSlugs } }),
    ]);
  } catch {
    // тоолуур чухал биш
  }
}

export interface QuizStats {
  starts: number;
  finishes: number;
  /** Дуусгалтын хувь, 0–100 */
  completion: number;
  topTools: { slug: string; name: string; count: number }[];
  recent: { day: string; starts: number; finishes: number }[];
}

export async function quizStats(days = 30): Promise<QuizStats> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const [daily, results] = await Promise.all([
    prisma.quizDaily.findMany({ where: { day: { gte: since } }, orderBy: { day: "desc" } }),
    prisma.quizResult.findMany({
      where: { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } },
      select: { toolSlugs: true },
    }),
  ]);

  const starts = daily.reduce((n, d) => n + d.starts, 0);
  const finishes = daily.reduce((n, d) => n + d.finishes, 0);

  // Эхний байрт санал болгогдсоныг л тоолно — «хамгийн их санал болгогдсон»
  const counts = new Map<string, number>();
  for (const r of results) {
    const first = r.toolSlugs[0];
    if (first) counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  const slugs = [...counts.keys()];
  const names = slugs.length
    ? new Map(
        (await prisma.tool.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } }))
          .map((t) => [t.slug, t.name]),
      )
    : new Map<string, string>();

  return {
    starts,
    finishes,
    completion: starts === 0 ? 0 : Math.round((finishes / starts) * 100),
    topTools: [...counts]
      .map(([slug, count]) => ({ slug, name: names.get(slug) ?? slug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    recent: daily.slice(0, 14),
  };
}
