/**
 * RSS 2.0 фийд үүсгэгч — цэвэр функц (DB-гүй, тесттэй).
 *
 * Уншигчид (Feedly, Inoreader) болон дахин нийтлэгчид сайтыг дагах боломж олгоно.
 * Atom биш RSS 2.0 — монголын уншигчдын хэрэглэдэг апп бүр дэмждэг.
 */

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  /** Тогтвортой танигч — ихэвчлэн link */
  guid?: string;
  pubDate?: Date | null;
  categories?: string[];
  /** Зургийн бүтэн хаяг — enclosure */
  imageUrl?: string | null;
}

export interface FeedInput {
  title: string;
  description: string;
  /** Сайт дээрх холбогдох хуудас */
  link: string;
  /** Энэ фийдийн өөрийн хаяг — atom:link rel=self */
  selfUrl: string;
  items: FeedItem[];
  language?: string;
  /** Тестэд тогтмол утга өгнө */
  now?: Date;
}

/** XML-д аюултай 5 тэмдэгт */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** XML 1.0-д зөвшөөрөгдөөгүй хяналтын тэмдэгтүүдийг хасна */
export function stripControl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** RFC-822 огноо (RSS-ийн шаардлага) — UTC-гээр */
export function rfc822(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${DAYS[d.getUTCDay()]}, ${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT`
  );
}

function tag(name: string, value: string): string {
  return `<${name}>${escapeXml(stripControl(value))}</${name}>`;
}

export function rssXml(f: FeedInput): string {
  const now = f.now ?? new Date();
  const latest = f.items.reduce<Date | null>((acc, i) => {
    if (!i.pubDate) return acc;
    return !acc || i.pubDate > acc ? i.pubDate : acc;
  }, null);

  const items = f.items
    .map((i) => {
      const guid = i.guid ?? i.link;
      return [
        "    <item>",
        `      ${tag("title", i.title)}`,
        `      ${tag("link", i.link)}`,
        `      <guid isPermaLink="${guid === i.link ? "true" : "false"}">${escapeXml(stripControl(guid))}</guid>`,
        i.pubDate ? `      <pubDate>${rfc822(i.pubDate)}</pubDate>` : null,
        `      ${tag("description", i.description)}`,
        ...(i.categories ?? []).map((c) => `      ${tag("category", c)}`),
        i.imageUrl
          ? `      <enclosure url="${escapeXml(i.imageUrl)}" type="image/png" length="0" />`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .map((s) => `${s}\n    </item>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    ${tag("title", f.title)}`,
    `    ${tag("link", f.link)}`,
    `    ${tag("description", f.description)}`,
    `    ${tag("language", f.language ?? "mn")}`,
    `    <lastBuildDate>${rfc822(latest ?? now)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(f.selfUrl)}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

/** Route handler-ийн header-үүд */
export function feedHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=86400",
  };
}
