/**
 * Үзэлтийн тоолуурын цэвэр хэсэг.
 */

/** Танил bot-ууд — тоололд орохгүй */
const BOT = /bot|crawler|spider|crawl|slurp|facebookexternalhit|headless|preview|monitor|curl|wget|python-requests|axios|lighthouse/i;

export function isBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  // UA огт байхгүй бол ихэвчлэн скрипт — хүн гэж тооцохгүй
  if (!ua) return true;
  return BOT.test(ua);
}
