/**
 * OpenRouter-ийн үлдэгдэл — БҮХ хэсэг эндээс асууна (студи, бенчмарк, pipeline,
 * /admin, /api/health).
 *
 * Тэргүүлэх дараалал: үлдэгдэл багасахад эхлээд студи, дараа нь бенчмарк, хамгийн
 * сүүлд мэдээний pipeline-ийн LLM алхмууд унтарна. Нийтлэх алхам нь бэлэн контент,
 * бэлэн картаар үргэлжилнэ — LLM шаардахгүй.
 *
 * Алдаа гарвал null — «мэдэхгүй» гэдэг нь «дууссан» гэсэн үг биш тул юу ч
 * хаагдахгүй (өдрийн төсөв, тооцоолсон зардлын шалгалт хэвээр хамгаална).
 */
/** Pipeline run бүрийн эхэнд нэг удаа асуухад хангалттай */
export const TTL_MS = 10 * 60_000;

/** Үүнээс бага бол /admin дээр улаан баннер, /admin/aldaa-д ⚠ */
export const WARN_USD = 3;
/** Үүнээс бага бол LLM алхмууд алгасагдана */
export const HALT_USD = 0.5;
/** Студи үүнээс бага үед шинэ бүтээл эхлүүлэхгүй */
export const STUDIO_MIN_USD = 1;

export type BalanceLevel = "ok" | "low" | "halt" | "unknown";

/** Үлдэгдлийн түвшин — юу хийхээ шийдэхэд */
export function levelOf(balance: number | null): BalanceLevel {
  if (balance === null) return "unknown";
  if (balance < HALT_USD) return "halt";
  if (balance < WARN_USD) return "low";
  return "ok";
}

/** LLM шаардсан алхам ажиллуулж болох уу */
export function llmAllowed(balance: number | null): boolean {
  return levelOf(balance) !== "halt";
}

/** Хэрэглэгчид/админд харуулах мессеж */
export function balanceMessage(balance: number | null): string | null {
  const level = levelOf(balance);
  if (level === "ok" || level === "unknown") return null;
  const amount = `$${(balance ?? 0).toFixed(2)}`;
  return level === "halt"
    ? `OpenRouter кредит дууслаа: ${amount} — LLM алхмууд зогссон. Цэнэглэнэ үү.`
    : `OpenRouter кредит: ${amount} — цэнэглэнэ үү.`;
}


let cached: { at: number; value: number | null } | null = null;

export function resetBalanceCache(): void {
  cached = null;
}

export async function openRouterBalance(
  opts: { fetchFn?: typeof fetch; now?: () => number } = {},
): Promise<number | null> {
  const now = opts.now ?? Date.now;
  if (cached && now() - cached.at < TTL_MS) return cached.value;

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  try {
    const res = await (opts.fetchFn ?? fetch)("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } };
    const total = Number(json.data?.total_credits);
    const used = Number(json.data?.total_usage);
    const left = Number.isFinite(total) && Number.isFinite(used) ? total - used : null;
    cached = { at: now(), value: left };
    return left;
  } catch {
    cached = { at: now(), value: null };
    return null;
  }
}
