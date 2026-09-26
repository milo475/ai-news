import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cardScore, decodeCursor, embedCode, EMBED_H, EMBED_W, encodeCursor, PAGE_SIZE, parseCategory,
  PLATFORMS, SHARE_WEIGHT, shareUrl, sharePlatforms, toPage, weeklyBest,
} from "./card.api";
import { embedHeaders, embedHtml, esc } from "./embed.api";
import { parseStats, STATS_BATCH, STATS_WINDOW_DAYS } from "./fb-stats.api";
import { imageJsonLd } from "./seo.api";
import { CATEGORIES } from "../agent/category";

// ——— Cursor pagination ———

test("encodeCursor / decodeCursor", () => {
  const c = { at: 1_790_000_000_000, id: "cmabc123" };
  assert.equal(encodeCursor(c), "1790000000000_cmabc123");
  assert.deepEqual(decodeCursor(encodeCursor(c)), c);

  assert.equal(decodeCursor(null), null);
  assert.equal(decodeCursor(undefined), null);
  assert.equal(decodeCursor(""), null);
  assert.equal(decodeCursor("тоо_биш"), null);
  assert.equal(decodeCursor("_id"), null, "огноогүй");
  assert.equal(decodeCursor("123"), null, "id-гүй");
  assert.equal(decodeCursor("0_id"), null, "огноо 0");
  // id дотор "_" байсан ч бүтнээр нь авна
  assert.deepEqual(decodeCursor("100_a_b"), { at: 100, id: "a_b" });
});

test("toPage: size+1 уншиж дараагийн cursor гаргана", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    id: `id${i}`,
    cardAt: new Date(2_000_000_000_000 - i * 1_000),
  }));

  // 4 асуусан, 5 ирсэн → дараагийнх байна
  const page = toPage(rows, 4);
  assert.equal(page.items.length, 4);
  assert.equal(page.next, encodeCursor({ at: rows[3]!.cardAt.getTime(), id: "id3" }));

  // Яг таарсан → дууссан
  assert.equal(toPage(rows, 5).next, null);
  assert.equal(toPage(rows.slice(0, 2), 5).next, null);
  assert.deepEqual(toPage([], 5), { items: [], next: null });

  // cardAt байхгүй мөр дээр cursor гаргахгүй (эс тэгвээс эцэс төгсгөлгүй давтана)
  const noDate = [{ id: "a", cardAt: null }, { id: "b", cardAt: null }];
  assert.equal(toPage(noDate, 1).next, null);

  assert.equal(PAGE_SIZE, 24);
});

// ——— Хуваалцах ———

test("shareUrl: платформ бүрийн хаяг, encode", () => {
  const url = "https://ai-news.mn/barimt/test-slug";
  const text = "Гарчиг & тэмдэг";

  const fb = shareUrl("facebook", url, text);
  assert.match(fb, /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/);
  assert.equal(decodeURIComponent(fb.split("u=")[1]!), url);

  const x = shareUrl("x", url, text);
  assert.match(x, /^https:\/\/twitter\.com\/intent\/tweet\?url=/);
  assert.ok(x.includes("&text="));
  assert.equal(decodeURIComponent(x.split("&text=")[1]!), text);

  const tg = shareUrl("telegram", url, text);
  assert.match(tg, /^https:\/\/t\.me\/share\/url\?url=/);

  const ms = shareUrl("messenger", url, text, "123");
  assert.match(ms, /^https:\/\/www\.facebook\.com\/dialog\/send\?link=/);
  assert.ok(ms.includes("app_id=123"));

  // Хаягийн тусгай тэмдэгт escape хийгдэнэ
  assert.ok(!shareUrl("facebook", "https://a.mn/?x=1&y=2", "t").includes("&y=2"));
});

test("sharePlatforms: Messenger нь FB_APP_ID-гүйгээр харагдахгүй", () => {
  assert.deepEqual(sharePlatforms({}), ["facebook", "x", "telegram"]);
  assert.deepEqual(sharePlatforms({ FB_APP_ID: "  " }), ["facebook", "x", "telegram"]);
  assert.deepEqual(sharePlatforms({ FB_APP_ID: "123" }), [...PLATFORMS]);
});

// ——— Embed ———

test("embedCode: iframe, lazy, title", () => {
  const code = embedCode("https://ai-news.mn/", "test-slug", 'Гарчиг "хашилттай"');
  assert.match(code, /^<iframe src="https:\/\/ai-news\.mn\/barimt\/test-slug\/embed"/);
  assert.ok(code.includes(`width="${EMBED_W}"`));
  assert.ok(code.includes(`height="${EMBED_H}"`));
  assert.ok(code.includes('loading="lazy"'));
  assert.ok(code.includes("&quot;хашилттай&quot;"), "гарчгийн хашилт escape хийгдэнэ");
  assert.ok(!code.includes('title="Гарчиг "'), "хашилт тэгийг эвдэхгүй");
});

test("esc: HTML тэмдэгтүүд escape хийгдэнэ", () => {
  assert.equal(esc(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(esc("a & b"), "a &amp; b");
  assert.equal(esc("it's"), "it&#39;s");
  assert.equal(esc("энгийн"), "энгийн");
});

test("embedHtml: скрипт агуулаагүй, XSS-ээс хамгаалагдсан", () => {
  const html = embedHtml({
    slug: "test-slug",
    hook: `<img src=x onerror="alert(1)"> "Гарчиг"`,
    articleId: "art123",
    siteUrl: "https://ai-news.mn/",
  });

  // Скрипт огт байхгүй
  assert.ok(!/<script/i.test(html), "<script> байхгүй");
  // Handler нь атрибут болж ажиллахын тулд хашилт нь escape хийгдээгүй байх ёстой.
  // Escape хийгдсэн хувилбар (onerror=&quot;) нь зүгээр текст.
  assert.ok(!html.includes('onerror="'), "hook-оос атрибут гарч ирээгүй");
  assert.ok(html.includes("onerror=&quot;"), "хашилт escape хийгдсэн");
  assert.ok(!/javascript:/i.test(html));

  // Гарчиг escape хийгдсэн — тэг болж ороогүй
  assert.ok(!html.includes("<img src=x"), "хорлонтой тэг ороогүй");
  assert.ok(html.includes("&lt;img src=x"));

  // Зураг, холбоос зөв
  assert.ok(html.includes("https://ai-news.mn/api/fb-image/art123"));
  assert.ok(html.includes("https://ai-news.mn/medee/test-slug"));
  assert.ok(html.includes('rel="noopener"'), "шинэ таб нээхэд noopener");
  assert.ok(html.includes('name="robots" content="noindex"'), "embed индексэд орохгүй");
  assert.ok(html.includes("<!doctype html>"));
});

test("embedHeaders: framing зөвшөөрч, script хориглоно", () => {
  const h = embedHeaders();
  assert.match(h["Content-Type"]!, /text\/html/);
  const csp = h["Content-Security-Policy"]!;
  assert.match(csp, /frame-ancestors \*/, "ямар ч сайт тавьж болно");
  assert.match(csp, /script-src 'none'/, "JS ажиллуулахгүй");
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["X-Robots-Tag"], "noindex");
  // X-Frame-Options байвал frame-ancestors-ыг дарж embed-ыг хаана
  assert.ok(!("X-Frame-Options" in h), "X-Frame-Options тавихгүй");
});

// ——— Шүүлт, эрэмбэ ———

test("parseCategory: зөвхөн танигдах ангилал", () => {
  assert.equal(parseCategory("RISK", CATEGORIES), "RISK");
  assert.equal(parseCategory("risk", CATEGORIES), "RISK");
  assert.equal(parseCategory(" news ", CATEGORIES), "NEWS");
  assert.equal(parseCategory("ГАДНЫ", CATEGORIES), undefined);
  assert.equal(parseCategory(undefined, CATEGORIES), undefined);
  assert.equal(parseCategory("", CATEGORIES), undefined);
});

test("cardScore: FB тоо байвал түүнийг, байхгүй бол татсан тоог", () => {
  assert.equal(SHARE_WEIGHT, 3);
  // 10 like + 2 share × 3 = 16
  assert.equal(cardScore({ fbLikes: 10, fbShares: 2, cardCopies: 99 }), 16);
  // FB тоо 0 — татсан тоо хэрэглэгдэнэ
  assert.equal(cardScore({ fbLikes: 0, fbShares: 0, cardCopies: 7 }), 7);
  assert.equal(cardScore({ fbLikes: 0, fbShares: 0, cardCopies: 0 }), 0);
  // Share нь like-аас хүчтэй дохио
  assert.ok(
    cardScore({ fbLikes: 0, fbShares: 2, cardCopies: 0 }) >
      cardScore({ fbLikes: 5, fbShares: 0, cardCopies: 0 }),
  );
});

test("weeklyBest: оноотойг л авна, оноогоор эрэмбэлнэ", () => {
  const rows = [
    { id: "a", fbLikes: 1, fbShares: 0, cardCopies: 0 },
    { id: "b", fbLikes: 20, fbShares: 0, cardCopies: 0 },
    { id: "c", fbLikes: 0, fbShares: 0, cardCopies: 0 },
    { id: "d", fbLikes: 0, fbShares: 0, cardCopies: 5 },
  ];
  assert.deepEqual(weeklyBest(rows, 3).map((r) => r.id), ["b", "d", "a"]);
  assert.ok(!weeklyBest(rows, 4).some((r) => r.id === "c"), "оноогүй нь орохгүй");
  assert.deepEqual(weeklyBest([], 3), []);
  assert.equal(weeklyBest(rows, 1).length, 1);
});

// ——— FB статистик ———

test("parseStats: талбар дутуу бол 0, error бол null", () => {
  assert.deepEqual(
    parseStats({ reactions: { summary: { total_count: 12 } }, shares: { count: 3 } }),
    { likes: 12, shares: 3 },
  );
  // Share байхгүй пост — бүрэн хэвийн
  assert.deepEqual(parseStats({ reactions: { summary: { total_count: 5 } } }), { likes: 5, shares: 0 });
  assert.deepEqual(parseStats({ shares: { count: 2 } }), { likes: 0, shares: 2 });

  // Алдаа — 0 болгож дарж бичвэл бодит өгөгдөл алдагдана
  assert.equal(parseStats({ error: { message: "Invalid token" } }), null);
  assert.equal(parseStats({}), null, "хоосон хариу");

  assert.equal(STATS_WINDOW_DAYS, 30);
  assert.equal(STATS_BATCH, 50);
});

// ——— SEO ———

test("imageJsonLd: ImageObject, 4:5, холбоотой нийтлэл", () => {
  const ld = imageJsonLd(
    {
      slug: "test-slug", hook: "Гарчиг", titleMn: "Бүтэн гарчиг", summaryMn: "Хураангуй",
      publishedAt: new Date("2026-09-25T00:00:00Z"),
      cardAt: new Date("2026-09-25T06:00:00Z"),
      articleId: "art123",
    },
    "https://ai-news.mn/",
  );

  assert.equal(ld["@type"], "ImageObject");
  assert.equal(ld.name, "Гарчиг");
  assert.equal(ld.contentUrl, "https://ai-news.mn/api/fb-image/art123");
  assert.equal(ld.url, "https://ai-news.mn/barimt/test-slug");
  assert.equal(ld.width, 1080);
  assert.equal(ld.height, 1350);
  assert.equal(ld.datePublished, "2026-09-25T00:00:00.000Z");
  assert.equal(ld.uploadDate, "2026-09-25T06:00:00.000Z");
  assert.deepEqual(ld.associatedArticle, {
    "@type": "NewsArticle", headline: "Бүтэн гарчиг", url: "https://ai-news.mn/medee/test-slug",
  });
  assert.ok(JSON.parse(JSON.stringify(ld)));

  // Огноогүй бол талбар огт байхгүй
  const noDates = imageJsonLd(
    { slug: "s", hook: "h", titleMn: "t", summaryMn: "", publishedAt: null, cardAt: null, articleId: "x" },
    "https://a.mn",
  );
  assert.ok(!("datePublished" in noDates));
  assert.ok(!("uploadDate" in noDates));
  assert.equal(noDates.description, "t", "хураангуй хоосон бол гарчгийг авна");
});
