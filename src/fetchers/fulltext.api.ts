/**
 * Нийтлэлийн бүтэн текстийг эх хуудаснаас татах — цэвэр функц (DB-гүй).
 *
 * RSS-ийн description ихэвчлэн 1–2 өгүүлбэр байдаг тул agent-д бүтэн текст хэрэгтэй.
 * Энгийн fetch-ээр HTML-ийг авна; JS-ээр зурагддаг сайтад { browser: true } өгвөл
 * Playwright-аар нээнэ. Paywall, текст олдоогүй тохиолдолд null.
 */
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Browser } from "playwright";
import { stripHtml } from "./rss.api";

const TIMEOUT_MS = 15_000;
const BROWSER_TIMEOUT_MS = 30_000;
/** JS-ээр зурагдсан биет текст гарч иртэл хүлээх дээд хугацаа */
const RENDER_TIMEOUT_MS = 10_000;
/** networkidle-д хүрэхгүй сайт олон (analytics тасралтгүй) — түүнийг хүлээх дээд хугацаа */
const IDLE_TIMEOUT_MS = 3_000;
const MAX_CHARS = 8_000;
/** Үүнээс богино бол paywall/JS-only хуудас гэж үзнэ */
const MIN_CHARS = 300;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export interface FullText {
  text: string;
  byline?: string;
  /** og:image — FB постод эх сурвалжийн зураг хэрэглэх сонголтод */
  imageUrl?: string;
}

/** Үгийн дунд таслахгүй */
function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  const space = head.lastIndexOf(" ");
  return (space > max * 0.9 ? head.slice(0, space) : head).trimEnd();
}

// ---------- Playwright: нэг ажиллуулалтад нэг browser ----------

/** Browser нээх нь удаан тул нэг л удаа нээж дахин ашиглана. closeBrowser()-оор хаана. */
let browserPromise: Promise<Browser | null> | null = null;

async function getBrowser(): Promise<Browser | null> {
  browserPromise ??= (async () => {
    try {
      const { chromium } = await import("playwright");
      // container дотор root-оор ажиллах тул --no-sandbox хэрэгтэй.
      // executablePath заахгүй — Playwright image дотор PLAYWRIGHT_BROWSERS_PATH тохируулагдсан.
      return await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    } catch (e) {
      console.error(
        `Playwright нээгдсэнгүй: ${(e as Error).message.split("\n")[0]}\n` +
          `  "npm i -D playwright && npx playwright install chromium" ажиллуулна уу.`,
      );
      return null;
    }
  })();
  return browserPromise;
}

/** Ажиллуулалтын төгсгөлд дуудна — browser нээлттэй байвал процесс дуусахгүй */
export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  try {
    await (await pending)?.close();
  } catch {
    // хаагдахгүй байсан ч ажлыг зогсоохгүй
  }
}

async function htmlViaBrowser(url: string): Promise<string | null> {
  const browser = await getBrowser();
  if (!browser) return null;
  const page = await browser.newPage({ userAgent: USER_AGENT });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: BROWSER_TIMEOUT_MS });
    // Биет текст зурагдтал хүлээнэ — networkidle заримдаа хэт эрт (hydration-аас өмнө) ирдэг
    await page
      .waitForFunction(() => (document.body?.innerText ?? "").trim().length > 500, undefined, {
        timeout: RENDER_TIMEOUT_MS,
      })
      .catch(() => {});
    // Дараа нь networkidle; хүрэхгүй сайт дээр (openai.com) хуудсыг унагаахгүйн тулд алгасна
    await page.waitForLoadState("networkidle", { timeout: IDLE_TIMEOUT_MS }).catch(() => {});
    return await page.content();
  } catch (e) {
    console.warn(`  ⚠ browser ${url}: ${(e as Error).message.split("\n")[0]}`);
    return null;
  } finally {
    await page.close();
  }
}

async function htmlViaFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").toLowerCase().includes("html")) return null;
    return await res.text();
  } catch {
    // Timeout, DNS — бүтэн текстгүйгээр үргэлжилнэ
    return null;
  }
}

/** og:image / twitter:image — харьцангуй хаягийг бүтэн болгоно */
function metaImage(document: Document, pageUrl: string): string | undefined {
  const selectors = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[property="og:image:url"]',
    'meta[name="twitter:image"]',
  ];
  for (const sel of selectors) {
    const raw = document.querySelector(sel)?.getAttribute("content")?.trim();
    if (!raw) continue;
    try {
      return new URL(raw, pageUrl).toString();
    } catch {
      // буруу хаяг — дараагийн meta-г үзнэ
    }
  }
  return undefined;
}

export async function fetchFullText(
  url: string,
  opts: { browser?: boolean } = {},
): Promise<FullText | null> {
  const html = opts.browser ? await htmlViaBrowser(url) : await htmlViaFetch(url);
  if (!html) return null;
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as never).parse();
    const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < MIN_CHARS) return null;
    const byline = article?.byline?.replace(/\s+/g, " ").trim();
    return {
      text: cut(text, MAX_CHARS),
      byline: byline || undefined,
      imageUrl: metaImage(document as unknown as Document, url),
    };
  } catch {
    return null;
  }
}

/**
 * Эх хуудас татагдаагүй үеийн нөөц: feed-ийн content:encoded/content талбараас текст.
 * Богино description (TechCrunch ~82 тэмдэгт) нь sourceExcerpt-ээс илүү зүйл өгөхгүй тул хаяна.
 */
export function textFromFeedHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = stripHtml(html, MAX_CHARS);
  return text.length >= MIN_CHARS ? text : null;
}
