/**
 * RSS/Atom feed-тэй харьцах цэвэр функцууд (DB-гүй).
 *
 * Зөвхөн татаж, цэвэрлэж, давхардал таних түлхүүр тооцно — LLM дуудахгүй.
 */
import { createHash } from "node:crypto";
import Parser from "rss-parser";

const TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (compatible; ai-medee-bot/1.0; +https://github.com/)";

export interface FeedItem {
  url: string;
  title: string;
  excerpt: string;
  /** content:encoded / content — feed-д бүтэн агуулга байвал (эх хуудас татагдахгүй үед нөөц) */
  fullHtml?: string;
  author?: string;
  publishedAt?: Date;
}

/** Нэг feed-ийг татаж, item-үүдийг цэвэрлэсэн хэлбэрээр буцаана */
export async function fetchFeed(feedUrl: string): Promise<FeedItem[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${feedUrl} → HTTP ${res.status}`);

  const parser = new Parser<Record<string, unknown>, { author?: string; "content:encoded"?: string }>();
  const feed = await parser.parseString(await res.text());

  const items: FeedItem[] = [];
  for (const it of feed.items) {
    const url = it.link?.trim();
    // Зарим feed гарчгаа давхар кодлодог (The Verge: "doesn&#8217;t") — entity-г задална
    const title = stripHtml(it.title ?? "", 300);
    if (!url || !title) continue;          // холбоос/гарчиггүй item хэрэггүй
    const published = it.isoDate ?? it.pubDate;
    const at = published ? new Date(published) : undefined;
    items.push({
      url,
      title,
      excerpt: stripHtml(it.summary ?? it.content ?? it.contentSnippet ?? ""),
      fullHtml: it["content:encoded"] ?? it.content ?? undefined,
      author: it.author?.trim() || it.creator?.trim() || undefined,
      publishedAt: at && !Number.isNaN(at.getTime()) ? at : undefined,
    });
  }
  return items;
}

// ---------- Цэвэр хувиргалтууд (тест хийхэд хялбар) ----------

/** utm_source=..., utm_* маягийн tracking параметрүүд */
const TRACKING_PREFIX = /^(utm_|mc_|_hs)/;
const TRACKING_EXACT = new Set([
  "fbclid", "gclid", "igshid", "msclkid", "yclid", "mkt_tok", "ref", "ref_src", "ref_url", "cmpid",
]);

/**
 * Давхардал шалгахад тохирох хэлбэрт оруулна:
 * tracking параметр хасна, fragment хасна, hostname-ийг lowercase, trailing slash хасна.
 * Задлах боломжгүй хаягийг хэвээр нь буцаана.
 */
export function normalizeUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return url.trim();
  }
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (TRACKING_PREFIX.test(k) || TRACKING_EXACT.has(k)) u.searchParams.delete(key);
  }
  const query = u.searchParams.toString();
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${query ? `?${query}` : ""}`;
}

/**
 * Гарчгийн normalized sha1 — өөр сайт ижил мэдээг дамжуулсныг таних.
 * lowercase → тоо-үсгээс бусдыг зай болгоно → олон зайг нэг болгоно.
 */
export function titleHash(title: string): string {
  const norm = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return createHash("sha1").update(norm).digest("hex");
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", middot: "·",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function stripTags(s: string): string {
  return s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ");
}

/** HTML → цэвэр текст: тэг хасна, entity decode хийнэ, зайг цэгцэлнэ, max тэмдэгтээр таслана */
export function stripHtml(html: string, max = 2000): string {
  // entity-г задалсны дараа дахин тэг гарч ирж болно (&lt;p&gt; маягаар кодлогдсон HTML)
  const text = stripTags(decodeEntities(stripTags(html))).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
