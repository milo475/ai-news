/**
 * Сайтын хаягийн ЦОРЫН ГАНЦ эх сурвалж.
 *
 * Домэйн солиход `SITE_URL` env-ийг л өөрчилнө — код дотор хаяг бичигдээгүй байх ёстой
 * (`npm run audit:seo` үүнийг шалгана).
 */

/** Локал dev-ийн анхдагч — Railway дээр SITE_URL заавал тавигдана */
export const DEFAULT_SITE_URL = "http://localhost:3000";

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.SITE_URL ?? DEFAULT_SITE_URL).trim().replace(/\/+$/, "");
}

/** Үнэмлэхүй хаяг: absUrl("/medee/x") → "https://домэйн/medee/x" */
export function absUrl(path: string, env: Record<string, string | undefined> = process.env): string {
  const base = siteUrl(env);
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Харагдах хэлбэр — карт, имэйл, footer-т ("ainews.mn"). www хасагдана. */
export function siteHost(env: Record<string, string | undefined> = process.env): string {
  try {
    return new URL(siteUrl(env)).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Бот өөрийгөө танилцуулах мөр — гадны сайт руу хандахад */
export function userAgent(env: Record<string, string | undefined> = process.env): string {
  return `AINewsBot/1.0 (+${siteUrl(env)})`;
}

/**
 * Хуучин домэйнууд — эдгээрээр ирсэн хүсэлтийг шинэ рүү 301-ээр шилжүүлнэ.
 *
 * `OLD_HOSTS` нь таслалаар: "shop-demo.up.railway.app,ai-medee.up.railway.app"
 */
export function oldHosts(env: Record<string, string | undefined> = process.env): string[] {
  return (env.OLD_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean);
}

/**
 * Хүсэлтийн host нь хуучин домэйн мөн үү.
 *
 * Порт нь тохиролцоонд нөлөөлөхгүй (локал туршилтад чухал).
 */
export function isOldHost(host: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!host) return false;
  const clean = host.trim().toLowerCase().split(":")[0]!;
  return oldHosts(env).some((h) => h.split(":")[0] === clean);
}

/** Холбоо барих хаяг — footer, имэйл, схемийн өгөгдөлд */
export const CONTACT_EMAIL = "mnkhochir3@gmail.com";

export interface SocialLinks {
  facebook: string | null;
  instagram: string | null;
}

/**
 * Нийгмийн сүлжээний хуудсууд. Хатуу бичихгүй — env-ээс гаргана, ингэснээр
 * хуудсаа солиход код өөрчлөхгүй.
 */
export function socialLinks(env = process.env): SocialLinks {
  const fbId = (env.FB_PAGE_ID ?? "").trim();
  const ig = (env.IG_USERNAME ?? "").trim().replace(/^@/, "");
  return {
    facebook: fbId ? `https://www.facebook.com/${fbId}` : null,
    instagram: ig ? `https://www.instagram.com/${ig}` : null,
  };
}

/** sameAs-д зориулсан жагсаалт */
export function sameAs(env = process.env): string[] {
  const s = socialLinks(env);
  return [s.facebook, s.instagram].filter((x): x is string => Boolean(x));
}
