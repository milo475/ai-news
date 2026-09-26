/**
 * Embed хуудасны HTML — цэвэр функц (тесттэй).
 *
 * Скрипт агуулахгүй: бусад сайтын хуудсанд iframe-ээр орох тул JS байх нь тэдний
 * аюулгүй байдлын эрсдэл болно. Зөвхөн зураг, гарчиг, эх сурвалжийн холбоос.
 */
import { CARD_H, CARD_W } from "./card.api";

/** HTML-д тавих текстийг escape хийнэ */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmbedInput {
  slug: string;
  hook: string;
  articleId: string;
  siteUrl: string;
}

/** Embed-ийн бүтэн HTML. `<script>`, inline handler агуулахгүй. */
export function embedHtml(e: EmbedInput): string {
  const site = e.siteUrl.replace(/\/+$/, "");
  const card = `${site}/api/fb-image/${e.articleId}`;
  const article = `${site}/medee/${e.slug}`;
  const host = site.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const hook = esc(e.hook);

  return `<!doctype html>
<html lang="mn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${hook} — AI News</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #f7f6f2; color: #1b1b23;
  }
  @media (prefers-color-scheme: dark) { body { background: #16161a; color: #eceaf0; } }
  a { color: inherit; text-decoration: none; display: block; }
  figure { margin: 0; }
  img { display: block; width: 100%; height: auto; aspect-ratio: ${CARD_W} / ${CARD_H}; object-fit: cover; }
  figcaption { padding: 8px 10px; font-size: 13px; line-height: 1.4; }
  .src { display: flex; gap: 6px; align-items: baseline; padding: 0 10px 10px; font-size: 11px; opacity: .65; }
  .brand { font-weight: 600; }
</style>
</head>
<body>
<a href="${article}" target="_blank" rel="noopener">
  <figure>
    <img src="${card}" width="${CARD_W}" height="${CARD_H}" alt="${hook}" loading="lazy">
    <figcaption>${hook}</figcaption>
  </figure>
  <p class="src"><span class="brand">AI News</span><span>${esc(host)}</span></p>
</a>
</body>
</html>`;
}

/**
 * Embed-ийн HTTP header-ууд.
 *
 * `frame-ancestors *` — ямар ч сайт тавьж болно (энэ нь мөн чанар).
 * `script-src 'none'` — хуудас өөрөө JS ажиллуулахгүй.
 */
export function embedHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy":
      "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; " +
      "script-src 'none'; frame-ancestors *; base-uri 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer-when-downgrade",
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "X-Robots-Tag": "noindex",
  };
}
