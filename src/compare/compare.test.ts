import { test } from "node:test";
import assert from "node:assert/strict";
import {
  better, betterPrice, BUDGETS, CHEAP_OUTPUT_PRICE, decodeSlug, encodeSlug, isCanonicalPair,
  pairKey, pairPath, parsePair, pickModels, recommend, SEPARATOR, summaryStale,
  SUMMARY_MAX_AGE_DAYS, translationScore, type CompareStats,
} from "./pair.api";
import { checkSummary, sanitizeSummary, sentenceCount, summaryUser } from "./summary.api";
import { compareDescription, compareJsonLd, compareTitle } from "./seo.api";

// ——— Pair encode/decode ———

test("encodeSlug / decodeSlug: '/' ↔ '~'", () => {
  assert.equal(encodeSlug("openai/gpt-5.1"), "openai~gpt-5.1");
  assert.equal(decodeSlug("openai~gpt-5.1"), "openai/gpt-5.1");
  assert.equal(decodeSlug(encodeSlug("google/gemini-3.8-flash")), "google/gemini-3.8-flash");
  // Том үсэг жижигрэнэ (хаяг нь нэг хэлбэртэй байхын тулд)
  assert.equal(encodeSlug(" OpenAI/GPT-5.1 "), "openai~gpt-5.1");
  // Хэд хэдэн "/" байсан ч бүгд хөрвөнө
  assert.equal(encodeSlug("a/b/c"), "a~b~c");
  assert.equal(decodeSlug("a~b~c"), "a/b/c");
});

test("pairKey: цагаан толгойн эрэмбэтэй — дараалал хамаарахгүй", () => {
  const key = "google~gemini-3.8-flash--vs--openai~gpt-5.1";
  assert.equal(pairKey("openai/gpt-5.1", "google/gemini-3.8-flash"), key);
  assert.equal(pairKey("google/gemini-3.8-flash", "openai/gpt-5.1"), key, "эсрэг дараалал ижил түлхүүр");
  assert.ok(key.includes(SEPARATOR));
  assert.equal(pairPath("openai/gpt-5.1", "google/gemini-3.8-flash"), `/harits/${key}`);
});

test("parsePair: хаягаас хоёр slug", () => {
  assert.deepEqual(parsePair("openai~gpt-5.1--vs--google~gemini-4"), ["openai/gpt-5.1", "google/gemini-4"]);
  assert.deepEqual(parsePair("A~B--vs--C~D"), ["a/b", "c/d"], "жижиг үсэг болно");

  assert.equal(parsePair("openai~gpt-5.1"), null, "тусгаарлагчгүй");
  assert.equal(parsePair("--vs--b"), null, "эхний тал хоосон");
  assert.equal(parsePair("a--vs--"), null, "хоёр дахь тал хоосон");
  assert.equal(parsePair("a--vs--a"), null, "өөртэйгөө");
  assert.equal(parsePair(""), null);

  // Задалж эргүүлж угсарвал эх түлхүүр гарна
  const key = pairKey("x/y", "a/b");
  const parsed = parsePair(key)!;
  assert.equal(pairKey(parsed[0], parsed[1]), key);
});

test("isCanonicalPair: эсрэг дараалал canonical биш → 301", () => {
  const canonical = pairKey("openai/gpt-5.1", "anthropic/claude-opus-5");
  assert.equal(isCanonicalPair(canonical), true);

  // Гараар эсрэг дараалалтай хаяг зохиовол canonical биш
  const reversed = "openai~gpt-5.1--vs--anthropic~claude-opus-5";
  assert.equal(reversed === canonical, false, "тестийн урьдчилсан нөхцөл");
  assert.equal(isCanonicalPair(reversed), false);
  // Тэр хаягийг зөв руу нь хөрвүүлнэ
  assert.equal(pairKey(...parsePair(reversed)!), canonical);

  assert.equal(isCanonicalPair("эвдэрсэн"), false);
});

// ——— «✓ дээр» логик ———

test("better: их/бага нь дээр, null ба тэнцүү үед тэмдэггүй", () => {
  assert.equal(better(9, 7, "higher"), "a");
  assert.equal(better(7, 9, "higher"), "b");
  assert.equal(better(2, 5, "lower"), "a");
  assert.equal(better(5, 2, "lower"), "b");

  assert.equal(better(5, 5, "higher"), null, "тэнцвэл тэмдэггүй");
  assert.equal(better(null, 5, "higher"), null, "өгөгдөл дутуу");
  assert.equal(better(5, null, "higher"), null);
  assert.equal(better(undefined, undefined, "lower"), null);
  assert.equal(better(NaN, 5, "higher"), null);
  assert.equal(better(Infinity, 5, "higher"), null);

  // Үнэ бага нь дээр; 0 = үнэгүй нь хамгийн хямд
  assert.equal(betterPrice(0, 2), "a");
  assert.equal(betterPrice(2, 0), "b");
  assert.equal(betterPrice(null, 0), null, "хоосонтой андуурахгүй");
});

// ——— Сонгох дүрэм ———

const mk = (slug: string, over: Partial<CompareStats> = {}): CompareStats => ({
  slug, name: slug, company: "X",
  mnScore: null, mnByCategory: {}, mnCostPer1k: null, latencyMs: null,
  arenaElo: null, usageRank: null, usageTokens: null,
  contextLength: null, maxOutputTokens: null,
  inputPricePerM: null, outputPricePerM: null,
  modality: null, inputModalities: [], releasedAt: null,
  ...over,
});

test("translationScore: орчуулгын хоёр ангиллын дундаж", () => {
  assert.equal(
    translationScore(mk("a", { mnByCategory: { ORCHUULGA_MN_EN: 9, ORCHUULGA_EN_MN: 7 } })),
    8,
  );
  // Зөвхөн нэг ангилал байвал түүнийг авна
  assert.equal(translationScore(mk("a", { mnByCategory: { ORCHUULGA_MN_EN: 9 } })), 9);
  assert.equal(translationScore(mk("a", { mnByCategory: { TOVCHLOL: 9 } })), null);
  assert.equal(translationScore(mk("a")), null);
});

test("recommend: 4 хувилбар, дүрмээр, өгөгдөл дутвал тэмдэггүй", () => {
  const a = mk("a", {
    mnScore: 8, mnByCategory: { ORCHUULGA_MN_EN: 9, ORCHUULGA_EN_MN: 9 },
    arenaElo: 1200, mnCostPer1k: 0.05, outputPricePerM: 10, contextLength: 200_000,
  });
  const b = mk("b", {
    mnScore: 6, mnByCategory: { ORCHUULGA_MN_EN: 6, ORCHUULGA_EN_MN: 6 },
    arenaElo: 1300, mnCostPer1k: 0.02, outputPricePerM: 2, contextLength: 1_000_000,
  });

  const recs = recommend(a, b);
  assert.equal(recs.length, 4);
  const by = new Map(recs.map((r) => [r.useCase, r]));

  assert.equal(by.get("orchuulga")!.winner, "a", "орчуулгын оноо 9 > 6");
  assert.equal(by.get("bichih")!.winner, "a", "MN оноо 8 > 6");
  assert.equal(by.get("code")!.winner, "b", "Elo 1300 > 1200");
  assert.equal(by.get("hyamd")!.winner, "b", "1000 үг $0.02 < $0.05");
  for (const r of recs) assert.ok(r.reason.length > 0, r.useCase);

  // Өгөгдөл огт байхгүй — winner null, шалтгаан нь үүнийг хэлнэ
  const empty = recommend(mk("x"), mk("y"));
  assert.ok(empty.every((r) => r.winner === null));
  assert.match(empty.find((r) => r.useCase === "orchuulga")!.reason, /байхгүй/);

  // Орчуулгын ангилал байхгүй бол нийт MN оноо шийднэ
  const noCats = recommend(mk("a", { mnScore: 9 }), mk("b", { mnScore: 5 }));
  assert.equal(noCats.find((r) => r.useCase === "orchuulga")!.winner, "a");

  // 1000 үгийн үнэ байхгүй бол гаралтын тариф шийднэ
  const noMnCost = recommend(mk("a", { outputPricePerM: 1 }), mk("b", { outputPricePerM: 9 }));
  assert.equal(noMnCost.find((r) => r.useCase === "hyamd")!.winner, "a");
});

test("pickModels: төсвөөр шүүж, монгол хэл чухал бол MN оноо тэргүүн", () => {
  const free = mk("free", { outputPricePerM: 0, mnScore: 5, arenaElo: 1000 });
  const cheap = mk("cheap", { outputPricePerM: 1, mnScore: 7, arenaElo: 1100 });
  const pricey = mk("pricey", { outputPricePerM: 30, mnScore: 9, arenaElo: 1400 });
  const vision = mk("vision", { outputPricePerM: 5, mnScore: 6, inputModalities: ["text", "image"] });
  const all = [free, cheap, pricey, vision];

  // Үнэгүй — зөвхөн 0 үнэтэй
  assert.deepEqual(
    pickModels(all, { task: "bichih", budget: "unegui", mongolian: true }).map((m) => m.slug),
    ["free"],
  );

  // Хямд — ≤$2
  assert.deepEqual(
    pickModels(all, { task: "bichih", budget: "hyamd", mongolian: true }).map((m) => m.slug),
    ["cheap", "free"],
  );
  assert.equal(CHEAP_OUTPUT_PRICE, 2);

  // Хамаагүй + монгол хэл чухал → MN оноо тэргүүн
  assert.equal(
    pickModels(all, { task: "bichih", budget: "hamaagui", mongolian: true })[0]!.slug,
    "pricey",
  );

  // Код + монгол хэл чухал биш → Elo тэргүүн
  assert.equal(
    pickModels(all, { task: "code", budget: "hamaagui", mongolian: false })[0]!.slug,
    "pricey",
  );

  // Зураг ойлгох → image дэмждэг нь л орно
  assert.deepEqual(
    pickModels(all, { task: "zurag", budget: "hamaagui", mongolian: false }).map((m) => m.slug),
    ["vision"],
  );

  // Шүүлт хэт хатуу бол хоосон хуудас гаргахгүй — шүүлтгүй эрэмбээр гүйцээнэ
  const noneFree = [pricey, cheap];
  assert.ok(pickModels(noneFree, { task: "zurag", budget: "unegui", mongolian: true }).length > 0);

  assert.deepEqual(pickModels([], { task: "bichih", budget: "hamaagui", mongolian: true }), []);
  assert.deepEqual(BUDGETS, ["unegui", "hyamd", "hamaagui"]);
});

// ——— Дүгнэлтийн кэш ———

test("summaryStale: 30 хоног", () => {
  assert.equal(SUMMARY_MAX_AGE_DAYS, 30);
  const now = new Date("2026-09-26T00:00:00Z");

  assert.equal(summaryStale(null, now), true, "хэзээ ч бичигдээгүй");
  assert.equal(summaryStale(undefined, now), true);
  assert.equal(summaryStale(new Date("2026-09-25T00:00:00Z"), now), false, "1 хоног");
  assert.equal(summaryStale(new Date("2026-08-28T00:00:00Z"), now), false, "29 хоног");
  assert.equal(summaryStale(new Date("2026-08-26T00:00:00Z"), now), true, "31 хоног");
});

test("sentenceCount / checkSummary: 3 өгүүлбэр шаардана", () => {
  assert.equal(sentenceCount("Нэг. Хоёр. Гурав."), 3);
  assert.equal(sentenceCount("Нэг! Хоёр? Гурав."), 3);
  assert.equal(sentenceCount("Цэггүй текст"), 1);
  assert.equal(sentenceCount(""), 0);

  const good =
    "GPT-5.1 монгол хэлний бенчмаркт 7.9 оноо авсан нь Gemini-ийн 5.3-аас хамаагүй дээр байна. " +
    "Харин Gemini нь монгол 1000 үгийг гурав дахин хямдаар боловсруулдаг. " +
    "Чанар чухал бол GPT-5.1, хэмжээ чухал бол Gemini-г сонгоорой.";
  assert.deepEqual(checkSummary(good), []);

  const codes = (t: string) => checkSummary(t).map((p) => p.code);
  assert.deepEqual(codes(""), ["empty"]);
  assert.ok(codes("Богино.").includes("too-short"));
  assert.ok(codes(`${good} Дөрөв. Тав. Зургаа.`).includes("sentences"), "хэт олон өгүүлбэр");
  assert.ok(codes(`${good} 🚀`).includes("emoji"));

  assert.equal(sanitizeSummary("  Текст 🚀   хоёр  "), "Текст хоёр");
});

test("summaryUser: бүх үзүүлэлт ба дүрмийн дүгнэлт prompt-д орно", () => {
  const a = mk("openai/gpt-5.1", {
    name: "GPT-5.1", company: "OpenAI", mnScore: 7.9,
    mnByCategory: { ORCHUULGA_MN_EN: 9.2 }, outputPricePerM: 10, mnCostPer1k: 0.033,
    latencyMs: 4798, inputModalities: ["text", "image"],
  });
  const b = mk("google/gemini-4", { name: "Gemini 4", company: "Google", mnScore: 5.3 });
  const user = summaryUser(a, b, recommend(a, b));

  assert.match(user, /A = GPT-5\.1 \(OpenAI\)/);
  assert.match(user, /B = Gemini 4 \(Google\)/);
  assert.match(user, /Монгол хэлний нийт оноо.*7\.90.*5\.30/);
  assert.match(user, /Орчуулга МН→АН.*9\.2/);
  assert.match(user, /Монгол 1000 үгийн үнэ.*0\.033/);
  assert.match(user, /Хариу өгөх хугацаа.*4\.8/);
  assert.match(user, /ДҮРМЭЭР ГАРСАН ДҮГНЭЛТ/);
  // Мэдэгдэхгүй үзүүлэлтийг «мэдэгдэхгүй» гэж шулуун хэлнэ
  assert.match(user, /мэдэгдэхгүй/);
});

// ——— SEO ———

test("compareTitle / compareDescription", () => {
  assert.equal(compareTitle("GPT-5.1", "Gemini 4", 2026), "GPT-5.1 vs Gemini 4 — аль нь дээр вэ? (2026)");

  const a = mk("a", { name: "GPT-5.1", mnScore: 7.9, outputPricePerM: 10 });
  const b = mk("b", { name: "Gemini 4", mnScore: 5.3, outputPricePerM: 2 });
  const d = compareDescription(a, b);
  assert.match(d, /GPT-5\.1 ба Gemini 4/);
  assert.match(d, /7\.90 vs 5\.30/);
  assert.match(d, /\$10 vs \$2/);

  // Өгөгдөл байхгүй бол зөвхөн толгой өгүүлбэр
  assert.equal(compareDescription(mk("a", { name: "X" }), mk("b", { name: "Y" })), "X ба Y-ийг хэмжсэн өгөгдлөөр харьцуулав.");
});

test("compareJsonLd: ItemList + Product×2", () => {
  const a = mk("a", { name: "GPT-5.1", company: "OpenAI", mnScore: 7.9, outputPricePerM: 10 });
  const b = mk("b", { name: "Gemini 4", company: "Google" });
  const ld = compareJsonLd(a, b, "https://ai-news.mn/harits/x");

  assert.equal(ld["@type"], "ItemList");
  assert.equal(ld.numberOfItems, 2);
  const items = ld.itemListElement as { position: number; item: Record<string, unknown> }[];
  assert.equal(items.length, 2);
  assert.equal(items[0]!.item["@type"], "Product");
  assert.equal(items[0]!.item.name, "GPT-5.1");
  assert.deepEqual(items[0]!.item.brand, { "@type": "Organization", name: "OpenAI" });
  assert.equal((items[0]!.item.offers as { price: number }).price, 10);
  assert.equal((items[0]!.item.aggregateRating as { ratingValue: number }).ratingValue, 7.9);

  // Өгөгдөлгүй модельд offers, aggregateRating бичихгүй — 0 гэвэл хуурамч
  assert.ok(!("offers" in items[1]!.item));
  assert.ok(!("aggregateRating" in items[1]!.item));
  assert.ok(JSON.parse(JSON.stringify(ld)));
});

test("recommend: Arena Elo-ийн шалтгаанд бутархай гарахгүй", () => {
  const a = mk("a", { arenaElo: 1494.674 });
  const b = mk("b", { arenaElo: 1441.8779 });
  const code = recommend(a, b).find((r) => r.useCase === "code")!;
  assert.equal(code.winner, "a");
  assert.equal(code.reason, "Arena Elo 1495 vs 1442");
  assert.ok(!code.reason.includes("."), "бутархай тоо харагдахгүй");
});
