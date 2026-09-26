/**
 * Харьцуулалтын өгөгдөл — моделийн бүх үзүүлэлтийг нэг дор цуглуулна.
 */
import { prisma } from "../db";
import { pairKey } from "./pair.api";
import type { CompareStats } from "./pair.api";
import { memoTtl, TTL } from "../lib/cache.api";

/** Decimal | null → number | null */
function dec(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Хамгийн сүүлийн бенчмаркийн дүн — бүх моделийн оноо, үнэ, хурд */
async function benchStats(): Promise<
  Map<string, { score: number; byCategory: Record<string, number>; costPer1k: number; latencyMs: number }>
> {
  const run = await prisma.benchRun.findFirst({
    where: { status: { in: ["DONE", "BUDGET"] } },
    orderBy: { month: "desc" },
    select: { id: true },
  });
  if (!run) return new Map();

  const { parseCategoryScores } = await import("../bench/queries");
  const rows = await prisma.benchModelSummary.findMany({
    where: { runId: run.id },
    select: { modelSlug: true, avgScore: true, scoreByCategory: true, costPer1kMn: true, avgLatency: true },
  });
  return new Map(
    rows.map((r) => [
      r.modelSlug,
      {
        score: r.avgScore,
        byCategory: parseCategoryScores(r.scoreByCategory) as Record<string, number>,
        costPer1k: r.costPer1kMn,
        latencyMs: r.avgLatency,
      },
    ]),
  );
}

/** Сүүлийн жагсаалтын байр, оноо (хэрэглээ ба Arena) */
async function rankStats(source: "OPENROUTER_USAGE" | "ARENA_ELO"): Promise<Map<string, { rank: number; score: number }>> {
  const latest = await prisma.rankingSnapshot.findFirst({
    where: { source },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return new Map();

  const rows = await prisma.rankingSnapshot.findMany({
    where: { source, date: latest.date },
    select: { rank: true, score: true, model: { select: { slug: true } } },
  });
  return new Map(rows.map((r) => [r.model.slug, { rank: r.rank, score: Number(r.score) }]));
}

const modelSelect = {
  slug: true, name: true, nameMn: true, contextLength: true, maxOutputTokens: true,
  inputPricePerM: true, outputPricePerM: true, modality: true, inputModalities: true,
  releasedAt: true, company: { select: { name: true } },
} as const;

/** Нэг моделийн бүх үзүүлэлт */
async function statsForUncached(slugs: string[]): Promise<Map<string, CompareStats>> {
  if (slugs.length === 0) return new Map();
  const [models, bench, usage, arena] = await Promise.all([
    prisma.aiModel.findMany({ where: { slug: { in: slugs } }, select: modelSelect }),
    benchStats(),
    rankStats("OPENROUTER_USAGE"),
    rankStats("ARENA_ELO"),
  ]);

  return new Map(
    models.map((m) => {
      const b = bench.get(m.slug);
      const u = usage.get(m.slug);
      return [
        m.slug,
        {
          slug: m.slug,
          name: m.nameMn ?? m.name,
          company: m.company.name,
          mnScore: b?.score ?? null,
          mnByCategory: b?.byCategory ?? {},
          mnCostPer1k: b?.costPer1k ?? null,
          latencyMs: b?.latencyMs ?? null,
          arenaElo: arena.get(m.slug)?.score ?? null,
          usageRank: u?.rank ?? null,
          usageTokens: u?.score ?? null,
          contextLength: m.contextLength,
          maxOutputTokens: m.maxOutputTokens,
          inputPricePerM: dec(m.inputPricePerM),
          outputPricePerM: dec(m.outputPricePerM),
          modality: m.modality,
          inputModalities: m.inputModalities,
          releasedAt: m.releasedAt,
        } satisfies CompareStats,
      ];
    }),
  );
}

/** Хоёр моделийн харьцуулалт — аль нэг нь байхгүй бол null */
async function statsPairUncached(a: string, b: string): Promise<[CompareStats, CompareStats] | null> {
  const map = await statsFor([a, b]);
  const first = map.get(a);
  const second = map.get(b);
  return first && second ? [first, second] : null;
}

/**
 * «Модель сонгох» хуудсанд — харьцуулахуйц моделиуд.
 *
 * Бенчмарк, Arena, хэрэглээний жагсаалтын аль нэгэнд байгаа моделиуд л орно;
 * каталогийн 300+ моделийг бүгдийг харуулбал сонголт утгагүй болно.
 */
async function comparableModelsUncached(limit = 40): Promise<CompareStats[]> {
  const [bench, usage, arena] = await Promise.all([
    benchStats(),
    rankStats("OPENROUTER_USAGE"),
    rankStats("ARENA_ELO"),
  ]);

  const slugs = new Set<string>([...bench.keys()]);
  // Хэрэглээ, Arena-аас топ N-ийг нэмнэ
  for (const [slug, r] of usage) if (r.rank <= limit) slugs.add(slug);
  for (const [slug, r] of arena) if (r.rank <= limit) slugs.add(slug);

  const stats = await statsFor([...slugs]);
  return [...stats.values()].filter((s) => s.mnScore !== null || s.arenaElo !== null || s.usageRank !== null);
}

/** Топ хэрэглээний моделиуд — урьдчилан үүсгэх хослолд */
async function topUsageSlugsUncached(limit = 10): Promise<string[]> {
  const usage = await rankStats("OPENROUTER_USAGE");
  return [...usage]
    .filter(([, r]) => r.rank <= limit)
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([slug]) => slug);
}

/** Бенчмаркийн топ моделиуд */
async function topBenchSlugsUncached(limit = 5): Promise<string[]> {
  const run = await prisma.benchRun.findFirst({
    where: { status: { in: ["DONE", "BUDGET"] } },
    orderBy: { month: "desc" },
    select: { id: true },
  });
  if (!run) return [];
  const rows = await prisma.benchModelSummary.findMany({
    where: { runId: run.id },
    orderBy: { rank: "asc" },
    take: limit,
    select: { modelSlug: true },
  });
  return rows.map((r) => r.modelSlug);
}

/**
 * Урьдчилан үүсгэх хослолууд: топ 10 хэрэглээ + бенчмаркийн топ 5-ын БҮХ хослол.
 *
 * Дүгнэлтийг build үед биш, эхний үзэлтэд (lazy) бичүүлнэ — build-ыг LLM-ээс хамааралгүй байлгана.
 */
async function plannedPairsUncached(): Promise<string[]> {
  const [usage, bench] = await Promise.all([topUsageSlugs(10), topBenchSlugs(5)]);
  const slugs = [...new Set([...usage, ...bench])];
  const pairs = new Set<string>();
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) pairs.add(pairKey(slugs[i]!, slugs[j]!));
  }
  return [...pairs];
}

/** Хамгийн их үзэгдсэн харьцуулалтууд */
async function topComparisonsUncached(limit = 10) {
  const rows = await prisma.aiModelComparison.findMany({
    where: { views: { gt: 0 } },
    orderBy: { views: "desc" },
    take: limit,
    select: { pairKey: true, views: true },
  });
  return rows;
}

/** Үзэлт тоолох. Тоолуур унасан нь хуудсыг унагаах ёсгүй. */
export async function countView(key: string): Promise<void> {
  try {
    await prisma.aiModelComparison.upsert({
      where: { pairKey: key },
      create: { pairKey: key, views: 1 },
      update: { views: { increment: 1 } },
    });
  } catch {
    // тоолуур чухал биш
  }
}

/** Тухайн моделийн хамгийн алдартай 5 хослол — «X vs бусад» */
async function relatedPairsForUncached(slug: string, limit = 5): Promise<string[]> {
  const encoded = slug.replaceAll("/", "~");
  const rows = await prisma.aiModelComparison.findMany({
    where: { pairKey: { contains: encoded } },
    orderBy: { views: "desc" },
    take: limit * 2,
    select: { pairKey: true },
  });
  const found = rows.map((r) => r.pairKey).filter((k) => k !== "");
  if (found.length >= limit) return found.slice(0, limit);

  // Хангалттай бүртгэл байхгүй бол төлөвлөсөн хослолуудаас гүйцээнэ
  const planned = (await plannedPairs()).filter((k) => k.includes(encoded));
  return [...new Set([...found, ...planned])].slice(0, limit);
}

/** Моделийн үзүүлэлтүүд */
export const statsFor: typeof statsForUncached = memoTtl(statsForUncached, { name: "statsFor", ttlMs: TTL.list });

/** Харьцуулах хос */
export const statsPair: typeof statsPairUncached = memoTtl(statsPairUncached, { name: "statsPair", ttlMs: TTL.list });

/** Харьцуулж болох моделиуд */
export const comparableModels: typeof comparableModelsUncached = memoTtl(comparableModelsUncached, { name: "comparableModels", ttlMs: TTL.list });

/** Хэрэглээгээр тэргүүлэгчид */
export const topUsageSlugs: typeof topUsageSlugsUncached = memoTtl(topUsageSlugsUncached, { name: "topUsageSlugs", ttlMs: TTL.list });

/** Бенчмаркаар тэргүүлэгчид */
export const topBenchSlugs: typeof topBenchSlugsUncached = memoTtl(topBenchSlugsUncached, { name: "topBenchSlugs", ttlMs: TTL.list });

/** Урьдчилан бэлтгэх хосууд */
export const plannedPairs: typeof plannedPairsUncached = memoTtl(plannedPairsUncached, { name: "plannedPairs", ttlMs: TTL.list });

/** Хамгийн их үзсэн харьцуулалт */
export const topComparisons: typeof topComparisonsUncached = memoTtl(topComparisonsUncached, { name: "topComparisons", ttlMs: TTL.list });

/** Холбоотой хосууд */
export const relatedPairsFor: typeof relatedPairsForUncached = memoTtl(relatedPairsForUncached, { name: "relatedPairsFor", ttlMs: TTL.list });
