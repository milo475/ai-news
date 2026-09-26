/**
 * Аюулгүй байдлын HTTP header-ууд — middleware бүх хариунд тавина.
 */
import { siteUrl } from "./site";

/**
 * Content-Security-Policy.
 *
 * Эхний ээлжид **report-only**: байгаа функцийг эвдэхгүйгээр зөрчлийг ажиглана.
 * `CSP_ENFORCE=true` тавьснаар хатуу горимд шилжинэ.
 *
 * `unsafe-inline` нь Next-ийн inline script (theme, hydration) болон Umami-д хэрэгтэй.
 * Nonce ашиглавал арилгаж болох ч Next-ийн streaming-тай нийцүүлэх нь тусдаа ажил.
 */
export function cspValue(env: Record<string, string | undefined> = process.env): string {
  const umami = (env.NEXT_PUBLIC_UMAMI_URL ?? "").trim().replace(/\/+$/, "");
  const scriptSrc = ["'self'", "'unsafe-inline'", umami].filter(Boolean).join(" ");
  const connectSrc = ["'self'", umami].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // Зураг: өөрийн сервер, data URI, гадны favicon (каталогийн лого fallback)
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    // Embed хуудсыг бусад сайт тавьдаг тул frame-ancestors-ыг тэр route өөрөө тавина
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // report-only горимд хөтөч үүнийг үл тоомсорлож консолд сануулга бичдэг —
    // зөвхөн хатуу горимд нэмнэ
    ...(cspEnforced(env) ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function cspEnforced(env: Record<string, string | undefined> = process.env): boolean {
  return (env.CSP_ENFORCE ?? "").trim().toLowerCase() === "true";
}

export function securityHeaders(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const https = siteUrl(env).startsWith("https://");
  const csp = cspValue(env);

  return {
    [cspEnforced(env) ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"]: csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    // HSTS нь зөвхөн https дээр утгатай — локал http дээр тавибал хөтөч дараа нь
    // localhost руу https-ээр хандаж эвдэрнэ
    ...(https ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains" } : {}),
  };
}
