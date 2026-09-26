/**
 * RSS-гүй сайтаас нийтлэлийн холбоос татах generic fetcher — цэвэр хэсэг.
 *
 * Source.listUrl (жагсаалтын хуудас) + Source.linkSelector (CSS) → холбоосууд.
 */
import { parseHTML } from "linkedom";

/** Бүх хүсэлтэд явах нэр — сайт эздэд бид хэн болохыг мэдэгдэнэ */
export const USER_AGENT = "AINewsBot/1.0 (+https://ai-news.mn)";

/** Нэг жагсаалтын хуудаснаас хамгийн ихдээ хэдэн холбоос авах вэ */
export const MAX_LINKS = 40;

export interface FoundLink {
  url: string;
  /** <a> тэгийн текст — гарчиг болгож хэрэглэнэ */
  title: string;
}

/**
 * Жагсаалтын HTML-ээс холбоосуудыг гаргана.
 *
 * - Зөвхөн listUrl-тай ижил хостын холбоос (гадны зар, сошиал холбоос орохгүй).
 * - Давхардлыг хаягаар нь шүүнэ.
 * - Гарчиг хоосон холбоос орохгүй (зураг, «цааш» товч).
 */
export function extractLinks(html: string, listUrl: string, selector: string): FoundLink[] {
  const { document } = parseHTML(html);
  const base = new URL(listUrl);
  const out: FoundLink[] = [];
  const seen = new Set<string>();

  let nodes: ArrayLike<Element>;
  try {
    nodes = document.querySelectorAll(selector) as unknown as ArrayLike<Element>;
  } catch {
    // Буруу selector — хоосон буцаана, /admin дээр «0 холбоос» гэж харагдана
    return [];
  }

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]!;
    // Selector нь <a>-г өөрийг нь ч, түүний эцгийг ч заасан байж болно
    const a = el.tagName === "A" ? el : el.querySelector("a");
    const href = a?.getAttribute("href");
    if (!href) continue;

    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname !== base.hostname) continue;
    if (!/^https?:$/.test(url.protocol)) continue;

    // Fragment нь ижил хуудсыг давхар оруулна
    url.hash = "";
    const clean = url.toString();
    if (seen.has(clean) || clean === listUrl) continue;

    const title = (a?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (title.length < 10) continue;

    seen.add(clean);
    out.push({ url: clean, title });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

// ——— robots.txt ———

export interface RobotsRules {
  /** Бидэнд (эсвэл *) хориглосон замууд */
  disallow: string[];
  /** Хүсэлт хоорондын хамгийн бага завсар, секунд */
  crawlDelay: number | null;
}

/**
 * robots.txt-г задална.
 *
 * Бидний нэрд (AINewsBot) тусгай блок байвал түүнийг, эс тэгвээс `*`-ийн блокийг авна.
 * Тусгай блок байгаа үед `*`-ийнхийг НЭМЭХГҮЙ — стандартын дагуу зөвхөн хамгийн
 * тодорхой таарсан блок хүчинтэй.
 */
export function parseRobots(text: string, agent = "ainewsbot"): RobotsRules {
  const lines = text.split("\n").map((l) => l.replace(/#.*$/, "").trim());
  const blocks: { agents: string[]; disallow: string[]; delay: number | null }[] = [];
  let current: { agents: string[]; disallow: string[]; delay: number | null } | null = null;
  let lastWasAgent = false;

  for (const line of lines) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();

    if (key === "user-agent") {
      // Дараалсан User-agent мөрүүд нэг блокт хамаарна
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], delay: null };
        blocks.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow" && value) current.disallow.push(value);
    else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) current.delay = n;
    }
  }

  const mine = blocks.find((b) => b.agents.some((a) => agent.includes(a) && a !== "*"));
  const star = blocks.find((b) => b.agents.includes("*"));
  const chosen = mine ?? star;
  return { disallow: chosen?.disallow ?? [], crawlDelay: chosen?.delay ?? null };
}

/**
 * Хаяг robots.txt-аар зөвшөөрөгдсөн эсэх.
 *
 * "Disallow: /" нь бүх зүйлийг хориглоно. Хоосон Disallow нь хориг биш (parseRobots
 * дээр аль хэдийн шүүгдсэн).
 */
export function allowedByRobots(rules: RobotsRules, url: string): boolean {
  let path: string;
  try {
    const u = new URL(url);
    path = `${u.pathname}${u.search}`;
  } catch {
    return false;
  }
  return !rules.disallow.some((rule) => {
    // robots.txt-ийн "*" бол префикс биш дүрэм — энгийн тохиолдлыг барина
    if (rule.includes("*")) {
      const re = new RegExp(`^${rule.split("*").map(escapeRe).join(".*")}`);
      return re.test(path);
    }
    return path.startsWith(rule);
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Эх сурвалж бүрийг 24 цагт нэг л удаа татна */
export const FETCH_INTERVAL_HOURS = 24;

export function dueForFetch(lastFetchedAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastFetchedAt) return true;
  return now.getTime() - lastFetchedAt.getTime() >= FETCH_INTERVAL_HOURS * 3_600_000;
}
