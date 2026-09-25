/**
 * Сайтын үндсэн хаяг — canonical, OG, sitemap, robots бүгд эндээс авна.
 *
 * Railway дээр SITE_URL тавигдана. Локалд тавиагүй бол dev серверийн хаяг.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.SITE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");
}
