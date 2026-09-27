/**
 * OpenRouter-ийн үлдэгдэл — студи хамгийн түрүүнд унтрахад хэрэгтэй.
 *
 * Мэдээний pipeline давуу эрхтэй: үлдэгдэл багасвал студи шинэ бүтээл
 * эхлүүлэхээ болино, харин мэдээ боловсруулалт үргэлжилнэ.
 *
 * Алдаа гарвал null — «мэдэхгүй» гэдэг нь «дууссан» гэсэн үг биш тул студи
 * хаагдахгүй (өдрийн төсөв хэвээр хамгаална).
 */
const TTL_MS = 10 * 60_000;

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
