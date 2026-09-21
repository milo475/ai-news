/**
 * Зохиомол өгөгдөл — DB-гүй орчинд UI-г харах, build шалгахад.
 * USE_FIXTURES=1 үед л ашиглагдана. Тоонууд бодит биш!
 */
import type { LeaderboardRow } from "@/queries/leaderboard";

interface Fx { slug: string; name: string; company: string; companySlug: string; open: boolean; base: number; drift: number }

const MODELS: Fx[] = [
  { slug: "anthropic/claude-fable-5.1", name: "Claude Fable 5.1", company: "Anthropic", companySlug: "anthropic", open: false, base: 980, drift: 1.2 },
  { slug: "openai/gpt-6-astra", name: "GPT-6 Astra", company: "OpenAI", companySlug: "openai", open: false, base: 940, drift: 0.8 },
  { slug: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash", company: "Google", companySlug: "google", open: false, base: 900, drift: 1.6 },
  { slug: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", company: "DeepSeek", companySlug: "deepseek", open: true, base: 720, drift: 2.4 },
  { slug: "x-ai/grok-4.6", name: "Grok 4.6", company: "SpaceXAI", companySlug: "x-ai", open: false, base: 610, drift: -0.4 },
  { slug: "qwen/qwen3.8-max-0902", name: "Qwen3.8 Max (0902)", company: "Qwen", companySlug: "qwen", open: false, base: 540, drift: 0.9 },
  { slug: "z-ai/glm-5.3", name: "GLM 5.3", company: "Z.ai", companySlug: "z-ai", open: true, base: 470, drift: 1.1 },
  { slug: "meta/muse-spark-1.3", name: "Muse Spark 1.3", company: "Meta", companySlug: "meta", open: false, base: 430, drift: -1.5 },
  { slug: "deepseek/deepseek-v4-pro-0813", name: "DeepSeek V4 Pro 0813", company: "DeepSeek", companySlug: "deepseek", open: true, base: 380, drift: 0.3 },
  { slug: "google/gemini-3.7-flash", name: "Gemini 3.7 Flash", company: "Google", companySlug: "google", open: false, base: 350, drift: -2.1 },
  { slug: "qwen/qwen3.8-flash", name: "Qwen3.8 Flash", company: "Qwen", companySlug: "qwen", open: true, base: 300, drift: 1.8 },
  { slug: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash", company: "Z.ai", companySlug: "z-ai", open: true, base: 260, drift: 3.0 },
  { slug: "qwen/qwen3.8-27b", name: "Qwen3.8 27B", company: "Qwen", companySlug: "qwen", open: true, base: 210, drift: 0.5 },
  { slug: "sakana/fugu-max", name: "Fugu Max", company: "Sakana", companySlug: "sakana", open: false, base: 160, drift: 2.2 },
  { slug: "inception/mercury-2.5", name: "Mercury 2.5", company: "Inception", companySlug: "inception", open: false, base: 120, drift: -0.8 },
];

const DAYS = 30;
const DAY0 = new Date(Date.UTC(2026, 8, 19)); // 2026-09-19

function seeded(i: number) { const x = Math.sin(i * 9301 + 49297) * 233280; return x - Math.floor(x); }

/** slug → [{date, score}] сүүлийн 30 өдөр, сая токеноор */
const HISTORY = new Map<string, { date: Date; score: number }[]>(
  MODELS.map((m, mi) => [
    m.slug,
    Array.from({ length: DAYS }, (_, d) => {
      const day = DAYS - 1 - d;
      const date = new Date(DAY0); date.setUTCDate(DAY0.getUTCDate() - day);
      const trend = m.base * (1 + (m.drift / 100) * (d - DAYS / 2));
      const noise = 1 + (seeded(mi * 100 + d) - 0.5) * 0.12;
      return { date, score: Math.max(5, Math.round(trend * noise)) };
    }),
  ]),
);

function rankOn(dayIndex: number): { slug: string; score: number; rank: number }[] {
  return MODELS.map((m) => ({ slug: m.slug, score: HISTORY.get(m.slug)![dayIndex]!.score }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function fixtureLeaderboard(limit = 50): { date: Date; rows: LeaderboardRow[] } {
  const today = rankOn(DAYS - 1);
  const yest = new Map(rankOn(DAYS - 2).map((r) => [r.slug, r]));
  const rows = today.slice(0, limit).map((r): LeaderboardRow => {
    const m = MODELS.find((x) => x.slug === r.slug)!;
    const y = yest.get(r.slug);
    const rankDelta = y ? y.rank - r.rank : null;
    return {
      rank: r.rank,
      rankDelta,
      trend: rankDelta === null ? "new" : rankDelta > 0 ? "up" : rankDelta < 0 ? "down" : "same",
      score: String(r.score * 1_000_000),
      scoreDeltaPct: y ? Math.round(((r.score - y.score) / y.score) * 1000) / 10 : null,
      model: { slug: m.slug, name: m.name, nameMn: null, isOpenWeights: m.open },
      company: { slug: m.companySlug, name: m.company },
    };
  });
  return { date: DAY0, rows };
}

export function fixtureHistory(slug: string) {
  const h = HISTORY.get(slug);
  if (!h) return [];
  return h.map((p, d) => ({
    date: p.date,
    rank: rankOn(d).find((r) => r.slug === slug)!.rank,
    score: String(p.score * 1_000_000),
  }));
}

export function fixtureModel(slug: string) {
  const m = MODELS.find((x) => x.slug === slug);
  if (!m) return null;
  return {
    slug: m.slug, name: m.name, nameMn: null,
    descriptionEn: `${m.name} is a frontier model from ${m.company}. (fixture)`,
    descriptionMn: null,
    isOpenWeights: m.open, contextLength: 1_000_000, modality: "text+image->text",
    releasedAt: new Date(Date.UTC(2026, 7, 20)),
    inputPricePerM: m.base > 800 ? "10" : "2", outputPricePerM: m.base > 800 ? "50" : "6",
    company: { slug: m.companySlug, name: m.company },
  };
}
