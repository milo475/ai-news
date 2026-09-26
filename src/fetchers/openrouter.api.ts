/**
 * OpenRouter API-тай харьцах цэвэр функцууд (DB-гүй).
 *
 * 1. GET /api/v1/models            — нийтийн, түлхүүр шаардахгүй. Моделийн каталог.
 * 2. GET /api/v1/datasets/rankings-daily — өдөр бүрийн топ 50 модель (токеноор).
 *    Ямар ч хүчинтэй OpenRouter түлхүүр хэрэгтэй. Хязгаар: 30 req/мин, 500 req/өдөр.
 *    Лиценз: CC BY 4.0 — сайт дээр заавал ишлэнэ:
 *    "Source: OpenRouter (openrouter.ai/rankings), as of {as_of}."
 */

const BASE = "https://openrouter.ai/api/v1";

export interface OrModel {
  id: string;                 // "openai/gpt-6-astra" эсвэл "...:free", "~openai/gpt-astra-latest"
  canonical_slug: string;     // "openai/gpt-6-astra-20260903"
  name: string;               // "OpenAI: GPT-6 Astra"
  created: number;            // unix sec
  description: string;
  context_length: number;
  hugging_face_id: string | null;
  architecture: {
    modality: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string | null;
  };
  /// USD / 1 токен (string). input_cache_read нь кэшлэгдсэн оролтын хямд тариф.
  pricing: { prompt: string; completion: string; input_cache_read?: string };
  top_provider?: {
    context_length?: number | null;
    max_completion_tokens?: number | null;
    is_moderated?: boolean | null;
  };
  alias_target?: { slug: string };                  // "~..." alias моделиуд
}

export interface RankingRow {
  date: string;              // "2026-09-19"
  model_permaslug: string;   // "openai/gpt-6-astra-20260903", "...:free", эсвэл "other"
  total_tokens: string;      // decimal string (64-bit)
}

export interface RankingsResponse {
  data: RankingRow[];
  meta: { as_of: string; start_date: string; end_date: string; version: "v1" };
}

export async function fetchModels(): Promise<OrModel[]> {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) throw new Error(`OpenRouter /models ${res.status}`);
  const json = (await res.json()) as { data: OrModel[] };
  return json.data;
}

export async function fetchRankingsDaily(
  apiKey: string,
  startDate: string,
  endDate: string,
): Promise<RankingsResponse> {
  const url = new URL(`${BASE}/datasets/rankings-daily`);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("period", "day");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`OpenRouter rankings-daily ${res.status}: ${await res.text()}`);
  return (await res.json()) as RankingsResponse;
}

// ---------- Цэвэр хувиргалтууд (тест хийхэд хялбар) ----------

/** Alias, batch, free зэрэг хувилбаруудыг хаяж, жинхэнэ моделиудыг л үлдээнэ */
export function isCanonicalModel(m: OrModel): boolean {
  if (m.id.startsWith("~")) return false;          // alias ("latest")
  if (m.id.includes(":")) return false;            // ":free", ":batch", ":thinking" ...
  if (m.alias_target) return false;
  return true;
}

/** "openai/gpt-6-astra" → "openai" */
export function companySlugOf(modelSlug: string): string {
  return modelSlug.split("/")[0] ?? "unknown";
}

/** "OpenAI: GPT-6 Astra" → { company: "OpenAI", model: "GPT-6 Astra" } */
export function splitName(name: string): { company: string; model: string } {
  const i = name.indexOf(": ");
  if (i === -1) return { company: "", model: name };
  return { company: name.slice(0, i), model: name.slice(i + 2) };
}

/** USD/токен (string) → USD/1 сая токен (number) */
export function pricePerMillion(perToken: string): number | null {
  const n = Number(perToken);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1_000_000 * 1e6) / 1e6;
}

/**
 * rankings-daily permaslug → каталогийн slug.
 * "openai/gpt-6-astra-20260903:free" → "openai/gpt-6-astra-20260903" (canonical_slug-тай тааруулна)
 * Хувилбар (":free") ба үндсэн хувилбарын токеныг нэг модель дээр нэгтгэнэ.
 */
export function permaslugBase(permaslug: string): string {
  return permaslug.split(":")[0]!;
}

export interface DayRank {
  date: string;
  /** canonical_slug → нийт токен */
  totals: Map<string, bigint>;
}

/** Мөрүүдийг өдрөөр бүлэглэж, хувилбаруудыг нэгтгэнэ. "other" мөрийг хаяна. */
export function groupByDay(rows: RankingRow[]): DayRank[] {
  const byDate = new Map<string, Map<string, bigint>>();
  for (const r of rows) {
    if (r.model_permaslug === "other") continue;
    const base = permaslugBase(r.model_permaslug);
    const day = byDate.get(r.date) ?? new Map<string, bigint>();
    day.set(base, (day.get(base) ?? 0n) + BigInt(r.total_tokens));
    byDate.set(r.date, day);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totals]) => ({ date, totals }));
}

export interface RankedEntry {
  slug: string;
  rank: number;
  score: bigint;
  rankDelta: number | null;   // + = дээшилсэн
  scoreDelta: bigint | null;
}

/**
 * Нэг өдрийн эрэмбэ + өмнөх өдөртэй харьцуулсан өөрчлөлт.
 * Өмнөх өдөр байхгүй бол delta = null. Өмнөх өдөр жагсаалтад байгаагүй модель → rankDelta null ("шинэ").
 */
export function rankDay(today: DayRank, yesterday?: DayRank): RankedEntry[] {
  const sorted = [...today.totals.entries()].sort(([sa, a], [sb, b]) =>
    a === b ? sa.localeCompare(sb) : a > b ? -1 : 1,
  );
  const prevRank = new Map<string, number>();
  if (yesterday) {
    [...yesterday.totals.entries()]
      .sort(([sa, a], [sb, b]) => (a === b ? sa.localeCompare(sb) : a > b ? -1 : 1))
      .forEach(([slug], i) => prevRank.set(slug, i + 1));
  }
  return sorted.map(([slug, score], i) => {
    const rank = i + 1;
    const pr = prevRank.get(slug);
    const ps = yesterday?.totals.get(slug);
    return {
      slug,
      rank,
      score,
      rankDelta: pr === undefined ? null : pr - rank,
      scoreDelta: ps === undefined ? null : score - ps,
    };
  });
}
