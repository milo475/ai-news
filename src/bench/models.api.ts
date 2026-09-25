/**
 * Тестлэх моделийн сонголт — цэвэр логик.
 */

/** Хэрэглээний топ хэдийг авах вэ */
export const TOP_MODELS = 15;

/**
 * Flagship моделиуд заавал орно — хэрэглээний топ-д байхгүй ч харьцуулалт утгагүй болно.
 * BENCH_EXTRA_MODELS-оор нэмж/дарж болно.
 */
export const DEFAULT_EXTRA = [
  "openai/gpt-5.2",
  "anthropic/claude-opus-5",
  "google/gemini-3.8-flash",
];

export function extraModels(env: Record<string, string | undefined> = process.env): string[] {
  const raw = (env.BENCH_EXTRA_MODELS ?? "").trim();
  if (!raw) return DEFAULT_EXTRA;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Хэрэглээний топ + заавал орох flagship-ууд, давхардалгүй.
 * Дараалал: топ нь эхэлнэ (төсөв дуусвал flagship нь хасагдахгүйн тулд flagship эхэлнэ).
 */
export function pickModels(topSlugs: string[], extra: string[], limit = TOP_MODELS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Flagship-уудыг эхэнд — төсөв дуусахад эдгээр нь заавал тестлэгдсэн байна
  for (const slug of [...extra, ...topSlugs]) {
    const key = slug.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(slug.trim());
    if (out.length >= limit + extra.length) break;
  }
  return out;
}

export function judgeModel(env: Record<string, string | undefined> = process.env): string {
  return (env.BENCH_JUDGE_MODEL ?? "").trim() || "anthropic/claude-sonnet-5";
}

/** Хоёр дахь шүүгч — шүүгчтэй ижил компанийн моделийг давхар үнэлнэ */
export function judgeModel2(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.BENCH_JUDGE_MODEL_2 ?? "").trim();
  if (raw) return raw;
  // Тохируулаагүй бол өөр компанийн ямар нэг хүчтэй моделийг анхдагчаар авна
  const first = judgeModel(env).split("/")[0]?.toLowerCase();
  const fallback = ["openai/gpt-5.2", "google/gemini-3.8-flash", "anthropic/claude-sonnet-5"];
  return fallback.find((m) => m.split("/")[0]?.toLowerCase() !== first) ?? null;
}
