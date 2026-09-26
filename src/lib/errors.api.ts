/**
 * Алдааны бүртгэлийн цэвэр хэсэг — hash, товчлол (DB-гүй, тесттэй).
 */

/** Стектэй байж ч болно, зүгээр мөр ч байж болно */
export function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e).slice(0, 500);
  } catch {
    return String(e);
  }
}

export function stackOf(e: unknown): string | null {
  return e instanceof Error && e.stack ? e.stack.slice(0, 4_000) : null;
}

/**
 * Ижил алдааг нэг мөрөнд цуглуулах түлхүүр.
 *
 * Мессеж доторх өөрчлөгддөг хэсгүүдийг (id, тоо, хаяг) орлуулна — эс тэгвээс
 * нэг л алдаа хэдэн зуун мөр үүсгэнэ.
 */
export function normalizeMessage(msg: string): string {
  return msg
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hex>")
    .replace(/\b[a-z0-9]{20,}\b/gi, "<id>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Node-гүй орчинд ч ажиллах энгийн тогтвортой hash (FNV-1a, 32 бит) */
export function fingerprint(source: string, path: string | null, message: string): string {
  const raw = `${source}|${path ?? ""}|${normalizeMessage(message)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${source}:${h.toString(16).padStart(8, "0")}`;
}

/** /admin дээр харуулах товч мөр */
export function shortMessage(msg: string, max = 140): string {
  const one = msg.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}
