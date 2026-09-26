import { test } from "node:test";
import assert from "node:assert/strict";
import {
  averageStars, categoryForUseCase, checkReview, checkToolSubmission, cleanCategories,
  cleanPlatforms, domainOf, faviconFallbackUrl, isLogoType, letterAvatar, MAX_REVIEW_TEXT,
  normalizeWebsite, parseVersusSlug, popularity, toToolSort, UPVOTE_WEIGHT, versusSlug,
} from "./tool.api";
import { checkEnrich, sanitizeEnrich, type EnrichOutput } from "./enrich.api";
import { softwareJsonLd, toolMetaDescription, toolMetaTitle } from "./seo.api";
import { SEED_TOOLS } from "./seed.api";

test("normalizeWebsite: схем нөхөж, query/зураас тайрна", () => {
  assert.equal(normalizeWebsite("chatgpt.com"), "https://chatgpt.com");
  assert.equal(normalizeWebsite("https://claude.ai/"), "https://claude.ai");
  assert.equal(normalizeWebsite("  https://www.canva.com/ru  "), "https://www.canva.com/ru");
  assert.equal(normalizeWebsite("https://a.com/x?utm=1#top"), "https://a.com/x");
  assert.equal(normalizeWebsite("http://a.com"), "http://a.com", "http хэвээр");

  assert.equal(normalizeWebsite(""), null);
  assert.equal(normalizeWebsite("localhost"), null, "домэйн биш");
  assert.equal(normalizeWebsite("зүгээр текст"), null);
});

test("domainOf: www арилна", () => {
  assert.equal(domainOf("https://www.grammarly.com/x"), "grammarly.com");
  assert.equal(domainOf("https://openrouter.ai"), "openrouter.ai");
  assert.equal(domainOf("эвдэрсэн"), "");
});

test("checkToolSubmission: нэр, хаяг, ангиллыг барина", () => {
  const ok = { name: "Perplexity", website: "perplexity.ai", categories: ["HAILT"] };
  assert.deepEqual(checkToolSubmission(ok), []);

  const codes = (patch: Partial<typeof ok>) =>
    checkToolSubmission({ ...ok, ...patch }).map((p) => p.code);
  assert.ok(codes({ name: "x" }).includes("name-short"));
  assert.ok(codes({ name: "х".repeat(61) }).includes("name-long"));
  assert.ok(codes({ website: "буруу" }).includes("bad-url"));
  assert.ok(codes({ categories: [] }).includes("no-category"));
  assert.ok(codes({ categories: ["БАЙХГҮЙ"] }).includes("no-category"));
});

test("cleanCategories / cleanPlatforms: танигдахгүйг шүүнэ, давхардал арилна", () => {
  assert.deepEqual(cleanCategories(["CHAT", "chat", "БАЙХГҮЙ"]), ["CHAT"]);
  assert.deepEqual(cleanCategories([" code ", "ZURAG"]), ["CODE", "ZURAG"]);
  assert.deepEqual(cleanCategories([]), []);

  assert.deepEqual(cleanPlatforms(["web", "WEB", "windows"]), ["web"]);
  assert.deepEqual(cleanPlatforms(["ios", "api"]), ["ios", "api"]);
});

test("popularity: upvote нь товшилтоос хүндтэй", () => {
  assert.equal(UPVOTE_WEIGHT, 3);
  assert.equal(popularity(10, 0), 30);
  assert.equal(popularity(0, 30), 30);
  assert.ok(popularity(5, 10) > popularity(0, 20), "5 upvote нь 10 товшилттой хамт илүү");
  assert.equal(popularity(0, 0), 0);
});

test("toToolSort: танигдахгүй нь «алдартай»", () => {
  assert.equal(toToolSort("shine"), "shine");
  assert.equal(toToolSort("unelgee"), "unelgee");
  assert.equal(toToolSort("гадны"), "aldartai");
  assert.equal(toToolSort(undefined), "aldartai");
});

test("checkReview: од 1–5, текст 500", () => {
  assert.deepEqual(checkReview(5, "Сайн"), []);
  assert.deepEqual(checkReview(1, ""), []);

  const codes = (stars: number, text = "") => checkReview(stars, text).map((p) => p.code);
  assert.ok(codes(0).includes("bad-stars"));
  assert.ok(codes(6).includes("bad-stars"));
  assert.ok(codes(3.5).includes("bad-stars"), "бүхэл тоо байх ёстой");
  assert.ok(codes(3, "х".repeat(MAX_REVIEW_TEXT + 1)).includes("text-long"));
  assert.deepEqual(codes(3, "х".repeat(MAX_REVIEW_TEXT)), []);
});

test("averageStars: дундаж нэг аравтаар", () => {
  assert.equal(averageStars([5, 4]), 4.5);
  assert.equal(averageStars([5, 4, 4]), 4.3);
  assert.equal(averageStars([3]), 3);
  assert.equal(averageStars([]), 0, "шүүмжгүй бол 0");
});

test("parseVersusSlug: харьцуулалтын хаягийг задлана", () => {
  assert.deepEqual(parseVersusSlug("chatgpt-vs-claude"), ["chatgpt", "claude"]);
  assert.deepEqual(parseVersusSlug("ChatGPT-VS-Claude"), ["chatgpt", "claude"], "том жижиг үсэг");
  // Хоёр дахь нэр нь өөрөө -vs- агуулбал бүтнээр нь авна
  assert.deepEqual(parseVersusSlug("a-vs-b-vs-c"), ["a", "b-vs-c"]);

  assert.equal(parseVersusSlug("chatgpt"), null);
  assert.equal(parseVersusSlug("a-vs-a"), null, "өөртэйгөө харьцуулахгүй");
  assert.equal(parseVersusSlug("-vs-b"), null);
  assert.equal(parseVersusSlug("a-vs-"), null);

  assert.equal(versusSlug("chatgpt", "claude"), "chatgpt-vs-claude");
  assert.deepEqual(parseVersusSlug(versusSlug("cursor", "windsurf")), ["cursor", "windsurf"]);
});

test("лого: favicon fallback, үсгэн avatar, төрлийн шүүлт", () => {
  const url = faviconFallbackUrl("https://www.canva.com/x", 64);
  assert.match(url, /^https:\/\/www\.google\.com\/s2\/favicons\?domain=canva\.com&sz=64$/);

  const a = letterAvatar("Midjourney");
  assert.equal(a.letter, "M");
  assert.ok(a.hue >= 0 && a.hue < 360);
  // Тогтвортой — ижил нэр ижил өнгө
  assert.deepEqual(letterAvatar("Midjourney"), a);
  assert.notDeepEqual(letterAvatar("Canva").hue, letterAvatar("Cursor").hue);
  assert.equal(letterAvatar("").letter, "?");
  assert.equal(letterAvatar("  гэрэл").letter, "Г");

  assert.equal(isLogoType("image/png"), true);
  assert.equal(isLogoType("image/svg+xml; charset=utf-8"), true);
  assert.equal(isLogoType("text/html"), false);
  assert.equal(isLogoType(null), false);
});

test("categoryForUseCase: /hereglee ангиллыг каталогтой холбоно", () => {
  assert.equal(categoryForUseCase("zurag"), "ZURAG");
  assert.equal(categoryForUseCase("duu-hooloi"), "AUDIO");
  assert.equal(categoryForUseCase("presentation"), "OFFICE");
  assert.equal(categoryForUseCase("байхгүй"), null);
});

// ——— LLM бөглөлт ———

const GOOD: EnrichOutput = {
  tagline: "Асуулт асууж, текст бичүүлэх ерөнхий AI туслах",
  descriptionMd:
    "ChatGPT нь OpenAI-ийн хөгжүүлсэн чатбот бөгөөд текст бичих, асуултад хариулах, " +
    "код бичихэд хэрэглэгддэг. Үнэгүй хувилбартай, төлбөртэй хувилбар нь илүү хүчирхэг " +
    "модель, зураг үүсгэх боломжийг нэмж өгдөг.",
  categories: ["CHAT", "BICHIH"],
  pricing: "FREEMIUM",
  priceFrom: 20,
  platforms: ["web", "ios", "android"],
  mongolianSupport: "GOOD",
  mnNoteMd:
    "- Монгол хэл дээр сайн бичиж, ойлгодог.\n- Төлбөрийг Visa/Mastercard-аар төлж болно.\n- VPN шаардлагагүй.",
};

test("checkEnrich: бүрэн бичлэг шалгуур давна", () => {
  assert.deepEqual(checkEnrich(GOOD), []);
});

test("checkEnrich: дутуу, урт, emoji-тэйг барина", () => {
  const codes = (patch: Partial<EnrichOutput>) => checkEnrich({ ...GOOD, ...patch }).map((p) => p.code);
  assert.ok(codes({ tagline: "" }).includes("tagline-empty"));
  assert.ok(codes({ tagline: "х".repeat(81) }).includes("tagline-long"));
  assert.ok(codes({ descriptionMd: "богино" }).includes("description-short"));
  assert.ok(codes({ categories: [] }).includes("no-category"));
  assert.ok(codes({ mnNoteMd: "хэт богино" }).includes("mn-note-short"));
  assert.ok(codes({ tagline: "AI туслах 🚀" }).includes("emoji"));
});

test("sanitizeEnrich: emoji, сүүлийн цэг, урт арилна", () => {
  const clean = sanitizeEnrich({
    ...GOOD,
    tagline: "  AI 🚀  туслах.  ",
    descriptionMd: "Мөр 1   \nМөр 2 🎯",
    priceFrom: -5,
  });
  assert.equal(clean.tagline, "AI туслах", "emoji, давхар зай, сүүлийн цэг арилна");
  assert.equal(clean.descriptionMd, "Мөр 1\nМөр 2", "мөрийн сүүлийн зай цэвэрлэгдэнэ");
  assert.equal(clean.priceFrom, 0, "сөрөг үнэ 0 болно");

  // Tagline нь хязгаараас хэтэрвэл тайрагдана
  assert.equal(sanitizeEnrich({ ...GOOD, tagline: "х".repeat(200) }).tagline.length, 80);
});

// ——— SEO ———

test("softwareJsonLd: SoftwareApplication, offers, aggregateRating", () => {
  const base = {
    slug: "chatgpt", name: "ChatGPT", tagline: "AI туслах",
    descriptionMd: "Тайлбар", website: "https://chatgpt.com",
    categories: ["CHAT"] as never, pricing: "FREEMIUM" as never, priceFrom: 20,
    mongolianSupport: "GOOD" as never, platforms: ["web", "ios"],
    rating: 4.5, reviewCount: 8, hasLogo: true,
  };
  const ld = softwareJsonLd(base, "https://ai-news.mn/");
  assert.equal(ld["@type"], "SoftwareApplication");
  assert.equal(ld.url, "https://ai-news.mn/hereglel/chatgpt");
  assert.equal(ld.sameAs, "https://chatgpt.com");
  assert.equal(ld.image, "https://ai-news.mn/api/tool-logo/chatgpt");
  assert.deepEqual(ld.offers, {
    "@type": "Offer", price: 20, priceCurrency: "USD",
    description: "Үнэгүй + төлбөртэй, сард $20-аас",
  });
  assert.deepEqual(ld.aggregateRating, {
    "@type": "AggregateRating", ratingValue: 4.5, bestRating: 5, worstRating: 1, ratingCount: 8,
  });
  assert.equal((ld.operatingSystem as string).includes("iOS"), true);
  assert.ok(JSON.parse(JSON.stringify(ld)));

  // Үнэгүй — 0 үнэтэй offer
  const free = softwareJsonLd({ ...base, pricing: "FREE" as never, priceFrom: null }, "https://x.mn");
  assert.equal((free.offers as { price: number }).price, 0);

  // Үнэ мэдэгдэхгүй бол offers огт бичихгүй — 0 гэвэл хуурамч
  const unknown = softwareJsonLd({ ...base, pricing: "PAID" as never, priceFrom: null }, "https://x.mn");
  assert.ok(!("offers" in unknown));

  // Шүүмжгүй бол aggregateRating байхгүй
  const noReviews = softwareJsonLd({ ...base, rating: 0, reviewCount: 0 }, "https://x.mn");
  assert.ok(!("aggregateRating" in noReviews));
  // Логогүй бол image байхгүй
  assert.ok(!("image" in softwareJsonLd({ ...base, hasLogo: false }, "https://x.mn")));
});

test("metadata: гарчиг, тайлбар", () => {
  assert.equal(toolMetaTitle("Canva"), "Canva — үнэ, монгол хэлний дэмжлэг, хувилбарууд");

  assert.equal(
    toolMetaDescription({
      name: "Canva", tagline: "Дизайн хийх", pricing: "FREEMIUM" as never,
      priceFrom: 12, mongolianSupport: "PARTIAL" as never,
    }),
    "Canva: Дизайн хийх. Үнэ — $12/сар-аас. Монголоор дунд.",
  );
  assert.match(
    toolMetaDescription({
      name: "Ollama", tagline: "Локал модель", pricing: "FREE" as never,
      priceFrom: null, mongolianSupport: "NONE" as never,
    }),
    /Үнэ — үнэгүй/,
  );
});

// ——— Seed ———

test("seed: 80 хэрэгсэл, ангилал бүрт 5+, хувилбарууд жагсаалтад байна", () => {
  assert.equal(SEED_TOOLS.length, 80);
  assert.equal(new Set(SEED_TOOLS.map((t) => t.name)).size, 80, "нэр давхардахгүй");
  assert.equal(new Set(SEED_TOOLS.map((t) => t.website)).size, 80, "хаяг давхардахгүй");

  // Гол ангиллаар (эхний ангилал) 5–8
  const byPrimary = new Map<string, number>();
  for (const t of SEED_TOOLS) {
    const c = t.categories[0]!;
    byPrimary.set(c, (byPrimary.get(c) ?? 0) + 1);
  }
  assert.equal(byPrimary.size, 14, "14 ангилал бүгд хамрагдсан");
  for (const [c, n] of byPrimary) {
    assert.ok(n >= 5 && n <= 8, `${c}: ${n} хэрэгсэл (5–8 байх ёстой)`);
  }

  // Хувилбарууд жагсаалтад байгаа нэр байх — байхгүй бол холбогдохгүй
  const names = new Set(SEED_TOOLS.map((t) => t.name));
  for (const t of SEED_TOOLS) {
    for (const a of t.alternatives ?? []) {
      assert.ok(names.has(a), `${t.name}: "${a}" жагсаалтад алга`);
      assert.notEqual(a, t.name, `${t.name} өөртэйгөө хувилбар`);
    }
  }

  // Хаяг бүр нормчлогдох ёстой
  for (const t of SEED_TOOLS) {
    assert.ok(normalizeWebsite(t.website), `${t.name}: ${t.website}`);
    assert.ok(t.categories.length >= 1 && t.categories.length <= 3, t.name);
  }
});

test("websiteAlive-ийн шийдвэр: 403 нь эвдэрсэн гэсэн үг биш", async () => {
  // Сүлжээгүйгээр шалгахын тулд fetch-ийг түр солино
  const realFetch = globalThis.fetch;
  const reply = (status: number) =>
    ((async () => ({ ok: status >= 200 && status < 300, status })) as unknown as typeof fetch);

  const { websiteAlive } = await import("./logo");
  try {
    globalThis.fetch = reply(200);
    assert.deepEqual(await websiteAlive("https://a.mn"), { ok: true, status: 200, blocked: false });

    // Cloudflare — HEAD, GET хоёуланд 403. Сайт хариу өгсөн тул эвдэрсэн биш.
    globalThis.fetch = reply(403);
    assert.deepEqual(await websiteAlive("https://a.mn"), { ok: true, status: 403, blocked: true });

    globalThis.fetch = reply(404);
    assert.deepEqual(await websiteAlive("https://a.mn"), { ok: false, status: 404, blocked: false });

    globalThis.fetch = reply(500);
    assert.deepEqual(await websiteAlive("https://a.mn"), { ok: false, status: 500, blocked: false });

    // Холболт бүтэхгүй
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    assert.deepEqual(await websiteAlive("https://a.mn"), { ok: false, status: null, blocked: false });
  } finally {
    globalThis.fetch = realFetch;
  }
});
