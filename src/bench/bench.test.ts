import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cyrillicRatio, isValidJson, parseChecker, parseRubric, runChecker, stripCodeFence, wordCount,
} from "./task.api";
import { combineScores, finalScore, needsSecondJudge, parseScore, vendorOf } from "./judge.api";
import {
  currentMonth, deltaVs, heat, monthLabel, previousMonth, summarize, type ScoredResult,
} from "./summary.api";
import { benchBudget, canStartModel, estimateCost, overBudget } from "./budget.api";
import { extraModels, judgeModel, judgeModel2, pickModels } from "./models.api";
import { SEED_TASKS } from "./seed.api";

// ——— Checker ———

test("parseRubric: буруу хэлбэрийг шүүнэ", () => {
  assert.deepEqual(parseRubric([{ name: "Утга", weight: 3, hint: "тайлбар" }]), [
    { name: "Утга", weight: 3, hint: "тайлбар" },
  ]);
  assert.deepEqual(parseRubric([{ name: "  Зай  " }]), [{ name: "Зай", weight: 1, hint: "" }]);
  assert.deepEqual(parseRubric([{ name: "", weight: 2 }, null, 5, "мөр"]), []);
  assert.deepEqual(parseRubric("массив биш"), []);
  assert.deepEqual(parseRubric([{ name: "Сөрөг жин", weight: -3 }]), [{ name: "Сөрөг жин", weight: 1, hint: "" }]);
});

test("parseChecker: зөвхөн танигдах хэлбэр", () => {
  assert.deepEqual(parseChecker({ kind: "json" }), { kind: "json" });
  assert.deepEqual(parseChecker({ kind: "maxWords", limit: 60 }), { kind: "maxWords", limit: 60 });
  assert.deepEqual(parseChecker({ kind: "cyrillic", minRatio: 0.7 }), { kind: "cyrillic", minRatio: 0.7 });

  assert.equal(parseChecker(null), null);
  assert.equal(parseChecker({ kind: "гадны" }), null);
  assert.equal(parseChecker({ kind: "maxWords" }), null, "limit дутуу");
  assert.equal(parseChecker({ kind: "maxWords", limit: 0 }), null);
  assert.equal(parseChecker({ kind: "cyrillic", minRatio: 1.5 }), null, "хувь 1-ээс их");
});

test("wordCount / cyrillicRatio: үсэг л тооцогдоно", () => {
  assert.equal(wordCount("нэг хоёр гурав"), 3);
  assert.equal(wordCount("  олон   зайтай  "), 2);
  assert.equal(wordCount(""), 0);

  assert.equal(cyrillicRatio("Сайн байна уу"), 1);
  assert.equal(cyrillicRatio("hello world"), 0);
  assert.equal(cyrillicRatio(""), 0);
  // Тоо, цэг таслал тооцоонд орохгүй — 100% кирилл хэвээр
  assert.equal(cyrillicRatio("Орлого 14.2 тэрбум төгрөг, 18%!"), 1);
  // Хагас латин — 10 үсгээс 6 нь кирилл
  assert.ok(Math.abs(cyrillicRatio("Энэ бол best") - 0.6) < 0.01);
});

test("isValidJson / stripCodeFence", () => {
  assert.equal(isValidJson('{"a":1}'), true);
  assert.equal(isValidJson('```json\n{"a":1}\n```'), true, "fence-тэй ч хүчинтэй");
  assert.equal(isValidJson("[1,2]"), true);
  assert.equal(isValidJson('{"a":}'), false);
  assert.equal(isValidJson("зүгээр текст"), false);
  assert.equal(isValidJson("42"), false, "бүтэн баримт биш");
  assert.equal(isValidJson('"мөр"'), false);
  assert.equal(isValidJson(""), false);

  assert.equal(stripCodeFence("```\nтекст\n```"), "текст");
  assert.equal(stripCodeFence("  энгийн  "), "энгийн");
});

test("runChecker: JSON, үгийн тоо, кириллийн хувь", () => {
  assert.equal(runChecker(null, "юу ч"), null, "checker байхгүй бол шалгах зүйлгүй");

  const json = runChecker({ kind: "json" }, '{"ajiltnuud":[]}')!;
  assert.equal(json.pass, true);
  assert.match(json.detail, /хүчинтэй/);
  assert.equal(runChecker({ kind: "json" }, "тайлбар: {...}")!.pass, false);

  const words = runChecker({ kind: "maxWords", limit: 3 }, "нэг хоёр гурав")!;
  assert.equal(words.pass, true);
  assert.match(words.detail, /3 үг/);
  assert.equal(runChecker({ kind: "maxWords", limit: 2 }, "нэг хоёр гурав")!.pass, false);

  const cyr = runChecker({ kind: "cyrillic", minRatio: 0.7 }, "Бүгд монголоор")!;
  assert.equal(cyr.pass, true);
  assert.match(cyr.detail, /100%/);
  assert.equal(runChecker({ kind: "cyrillic", minRatio: 0.7 }, "mostly english text")!.pass, false);
});

// ——— Шүүгч ———

test("parseScore: 0–10 хооронд барина", () => {
  assert.equal(parseScore(8.55), 8.6);
  assert.equal(parseScore(11), 10);
  assert.equal(parseScore(-3), 0);
  assert.equal(parseScore("7"), 7);
  assert.equal(parseScore("оноо биш"), null);
  assert.equal(parseScore(null), null, "оноо алга ≠ оноо 0");
  assert.equal(parseScore(undefined), null);
  assert.equal(parseScore(""), null);
  assert.equal(parseScore(true), null);
  assert.equal(parseScore(NaN), null);
  assert.equal(parseScore(0), 0, "жинхэнэ тэг нь тэг хэвээр");
});

test("needsSecondJudge: шүүгч өөрийн компанийн моделийг үнэлж байвал", () => {
  assert.equal(vendorOf("anthropic/claude-sonnet-5"), "anthropic");
  assert.equal(vendorOf("шалтгаангүй"), "шалтгаангүй");

  assert.equal(needsSecondJudge("anthropic/claude-sonnet-5", "anthropic/claude-opus-5"), true);
  assert.equal(needsSecondJudge("anthropic/claude-sonnet-5", "openai/gpt-5.2"), false);
  assert.equal(needsSecondJudge("anthropic/claude-sonnet-5", "Anthropic/Claude-Haiku"), true, "том жижиг үсгээс үл хамаарна");
  assert.equal(needsSecondJudge("", "openai/gpt-5.2"), false);
});

test("combineScores: хоёр шүүгчийн дундаж", () => {
  assert.equal(combineScores(8, 6), 7);
  assert.equal(combineScores(8, null), 8, "хоёр дахь шүүгчгүй");
  assert.equal(combineScores(null, 6), 6);
  assert.equal(combineScores(null, null), null);
  assert.equal(combineScores(9, 8.5), 8.8, "нэг аравтад дугуйрна");
});

test("finalScore: гараар → checker → шүүгч дараалал", () => {
  assert.equal(finalScore({ judgeScore: 8 }), 8);
  assert.equal(finalScore({ judgeScore: 8, humanScore: 5 }), 5, "гараар өгсөн нь дарна");
  assert.equal(finalScore({ judgeScore: 9, checkerPass: false }), 0, "checker унавал 0");
  assert.equal(finalScore({ judgeScore: 9, checkerPass: false, humanScore: 7 }), 7, "гараар засвал сэргэнэ");
  assert.equal(finalScore({ judgeScore: 9, error: "timeout" }), 0, "хариу өгөөгүй нь 0");
  assert.equal(finalScore({}), 0, "оноогүй нь 0");
  assert.equal(finalScore({ judgeScore: 0, humanScore: 0 }), 0);
  assert.equal(finalScore({ checkerPass: true, judgeScore: 7 }), 7);
});

// ——— Дүн, эрэмбэ ———

const mk = (modelSlug: string, score: number, over: Partial<ScoredResult> = {}): ScoredResult => ({
  modelSlug, category: "TOVCHLOL", weight: 1, latencyMs: 1_000, costUsd: 0.001,
  outputWords: 100, judgeScore: score, ...over,
});

test("summarize: жигнэсэн дундаж, ангиллын оноо, эрэмбэ", () => {
  const results: ScoredResult[] = [
    mk("a", 9), mk("a", 7, { category: "BODLOGO" }),
    mk("b", 6), mk("b", 6, { category: "BODLOGO" }),
  ];
  const [first, second] = summarize(results);
  assert.equal(first!.modelSlug, "a");
  assert.equal(first!.rank, 1);
  assert.equal(first!.avgScore, 8);
  assert.deepEqual(first!.scoreByCategory, { TOVCHLOL: 9, BODLOGO: 7 });
  assert.equal(second!.rank, 2);

  // Жин — хүнд даалгавар илүү нөлөөлнө
  const weighted = summarize([mk("c", 10, { weight: 1 }), mk("c", 0, { weight: 3 })]);
  assert.equal(weighted[0]!.avgScore, 2.5);

  // Checker унасан даалгавар 0 болж дундажийг буулгана
  const failed = summarize([mk("d", 10), mk("d", 10, { checkerPass: false })]);
  assert.equal(failed[0]!.avgScore, 5);

  // Алдаатай даалгавар 0 боловч completed-д орохгүй
  const errored = summarize([mk("e", 10), mk("e", 0, { error: "timeout" })]);
  assert.equal(errored[0]!.avgScore, 5);
  assert.equal(errored[0]!.completed, 1);
});

test("summarize: тэнцвэл хурдан нь дээгүүр, 1000 үгийн үнэ бодит хэмжилтээс", () => {
  const tie = summarize([
    mk("удаан", 8, { latencyMs: 5_000 }),
    mk("хурдан", 8, { latencyMs: 900 }),
  ]);
  assert.equal(tie[0]!.modelSlug, "хурдан");

  // 500 үг $0.01 → 1000 үг $0.02
  const cost = summarize([mk("x", 8, { outputWords: 500, costUsd: 0.01 })]);
  assert.equal(cost[0]!.costPer1kMn, 0.02);

  // Үг гаргаагүй бол 0 — тэгд хуваахгүй
  assert.equal(summarize([mk("y", 8, { outputWords: 0, costUsd: 0.01 })])[0]!.costPer1kMn, 0);
  assert.deepEqual(summarize([]), []);
});

test("deltaVs: өмнөх сартай харьцуулалт", () => {
  const prev = [
    { modelSlug: "a", rank: 3, avgScore: 7.5 },
    { modelSlug: "b", rank: 1, avgScore: 9 },
  ];
  // 3 → 1 болж дээшилсэн
  assert.deepEqual(deltaVs({ modelSlug: "a", rank: 1, avgScore: 8.2 }, prev), {
    rankDelta: 2, scoreDelta: 0.7,
  });
  // 1 → 2 болж буурсан
  assert.deepEqual(deltaVs({ modelSlug: "b", rank: 2, avgScore: 8.8 }, prev), {
    rankDelta: -1, scoreDelta: -0.2,
  });
  // Шинэ модель
  assert.deepEqual(deltaVs({ modelSlug: "shine", rank: 5, avgScore: 6 }, prev), {
    rankDelta: null, scoreDelta: null,
  });
  assert.deepEqual(deltaVs({ modelSlug: "a", rank: 3, avgScore: 7.5 }, []), {
    rankDelta: null, scoreDelta: null,
  });
});

test("heat / monthLabel / currentMonth / previousMonth", () => {
  assert.equal(heat(0), 0);
  assert.equal(heat(10), 1);
  assert.equal(heat(5), 0.5);
  assert.equal(heat(-3), 0, "хязгаараас гарахгүй");
  assert.equal(heat(12), 1);

  assert.equal(monthLabel("2026-10"), "2026 оны 10-р сар");
  assert.equal(monthLabel("2026-01"), "2026 оны 1-р сар");
  assert.equal(monthLabel("эвдэрсэн"), "эвдэрсэн");

  // УБ = UTC+8 — сарын сүүлийн өдрийн орой аль хэдийн шинэ сар
  assert.equal(currentMonth(new Date("2026-10-15T00:00:00Z")), "2026-10");
  assert.equal(currentMonth(new Date("2026-10-31T20:00:00Z")), "2026-11", "УБ-д 11-р сар болсон");

  assert.equal(previousMonth("2026-10"), "2026-09");
  assert.equal(previousMonth("2026-01"), "2025-12");
});

// ——— Төсөв ———

test("төсөв: тооцоо, зогсолт", () => {
  assert.equal(benchBudget({}), 15);
  assert.equal(benchBudget({ BENCH_BUDGET_USD: "40" }), 40);
  assert.equal(benchBudget({ BENCH_BUDGET_USD: "тоо биш" }), 15);
  assert.equal(benchBudget({ BENCH_BUDGET_USD: "-5" }), 15);

  const e = estimateCost(10, 30);
  assert.equal(e.calls, 600, "300 даалгавар + 300 шүүгч");
  assert.ok(e.usd > 0);

  // Хоёр дахь шүүгч нэмэлт дуудлага нэмнэ
  assert.ok(estimateCost(10, 30, 2).calls > e.calls);

  assert.equal(overBudget(14.99, 15), false);
  assert.equal(overBudget(15, 15), true);
  assert.equal(overBudget(20, 15), true);

  // Модель дундуур тасрахгүй — бүтэн багц багтах эсэхийг шалгана
  assert.equal(canStartModel(0, 15, 30), true);
  assert.equal(canStartModel(14.9, 15, 30), false, "багц багтахгүй бол эхлэхгүй");
});

// ——— Моделийн сонголт ———

test("pickModels: flagship эхэлж, давхардалгүй", () => {
  const top = ["openai/gpt-5.2", "google/gemini-3.8-flash", "x/y"];
  const extra = ["anthropic/claude-opus-5", "openai/gpt-5.2"];
  const picked = pickModels(top, extra, 10);

  assert.equal(picked[0], "anthropic/claude-opus-5", "flagship түрүүлнэ");
  assert.equal(new Set(picked).size, picked.length, "давхардалгүй");
  assert.ok(picked.includes("google/gemini-3.8-flash"));
  assert.equal(picked.filter((m) => m === "openai/gpt-5.2").length, 1);

  assert.deepEqual(pickModels([], [], 5), []);
  assert.deepEqual(pickModels(["  ", "a"], [], 5), ["a"], "хоосон мөр хасагдана");
});

test("шүүгчийн тохиргоо: анхдагч ба хоёр дахь шүүгч өөр компани", () => {
  assert.equal(judgeModel({ BENCH_JUDGE_MODEL: "x/y" }), "x/y");
  assert.ok(judgeModel({}).includes("/"), "анхдагч тохируулагдсан");

  assert.equal(judgeModel2({ BENCH_JUDGE_MODEL_2: "a/b" }), "a/b");
  const auto = judgeModel2({ BENCH_JUDGE_MODEL: "anthropic/claude-sonnet-5" });
  assert.ok(auto && !auto.startsWith("anthropic/"), "хоёр дахь шүүгч өөр компани");

  assert.deepEqual(extraModels({ BENCH_EXTRA_MODELS: "a/b, c/d" }), ["a/b", "c/d"]);
  assert.ok(extraModels({}).length >= 3, "анхдагч flagship-ууд");
});

// ——— Даалгаврын seed ———

test("seed: 30 даалгавар, ангилал бүрт 3, slug давхардахгүй", () => {
  assert.equal(SEED_TASKS.length, 30);
  assert.equal(new Set(SEED_TASKS.map((t) => t.slug)).size, 30);

  const byCategory = new Map<string, number>();
  for (const t of SEED_TASKS) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1);
  assert.equal(byCategory.size, 10);
  for (const [c, n] of byCategory) assert.equal(n, 3, `${c} ангилалд 3 даалгавар`);

  // Slug нь URL-д тавигдана — зөвхөн ASCII
  for (const t of SEED_TASKS) {
    assert.match(t.slug, /^[a-z0-9-]+$/, t.slug);
    assert.ok(t.prompt.length > 40, t.slug);
    assert.ok(t.rubric.length >= 3 && t.rubric.length <= 4, `${t.slug}: 3–4 шалгуур`);
  }

  // Checker-ууд хүчинтэй хэлбэртэй
  for (const t of SEED_TASKS) {
    if (t.checker) assert.ok(parseChecker(t.checker), `${t.slug}: checker хүчинтэй`);
  }

  // JSON ангиллын даалгавар бүр JSON checker-тэй
  for (const t of SEED_TASKS.filter((x) => x.category === "JSON_GARGAH")) {
    assert.deepEqual(t.checker, { kind: "json" }, t.slug);
  }

  // Нээлттэй даалгавар цөөхөн (contamination)
  const open = SEED_TASKS.filter((t) => t.isPublic).length;
  assert.ok(open >= 1 && open <= 5, `нээлттэй ${open} даалгавар`);
});

test("benchCardSvg: топ 5, оноо, туузны урт", async () => {
  const { benchCardSvg } = await import("../publish/fbimage.api");
  const rows = [
    { rank: 1, name: "Claude Opus 5", company: "Anthropic", score: 8.7 },
    { rank: 2, name: "GPT-5.2", company: "OpenAI", score: 8.4 },
    { rank: 3, name: "Gemini 3.8 Pro", company: "Google", score: 8.1 },
    { rank: 4, name: "Маш урт нэртэй модель хувилбар", company: "X", score: 7.2 },
    { rank: 5, name: "Grok 5", company: "xAI", score: 6.9 },
    { rank: 6, name: "Орохгүй", company: "Y", score: 6 },
  ];
  // Хостыг аргументаар өгнө — SVG нь env уншихгүй (цэвэр функц)
  const svg = benchCardSvg(rows, "2026 оны 10-р сар", undefined, "ai-news.mn");

  assert.match(svg, /Монголоор хамгийн сайн/);
  assert.match(svg, /2026 оны 10-р сар/);
  assert.match(svg, /ai-news\.mn\/benchmark/);
  assert.match(svg, />8\.7</);
  assert.ok(!svg.includes("Орохгүй"), "зөвхөн топ 5");
  assert.ok(svg.includes("…"), "урт нэр тайрагдана");

  // 0–10 оноо 220px туузанд буусан — 8.7 → 191px орчим
  assert.match(svg, /width="19[01]" height="12"/);
  // Онооны хязгаараас гарсан ч тууз хэтрэхгүй
  const wide = benchCardSvg([{ rank: 1, name: "X", company: "Y", score: 99 }], "сар");
  assert.match(wide, /width="220" height="12"/);
});

test("assembleArticle: хүснэгт, хэсгүүд, холбоос", async () => {
  const { assembleArticle } = await import("./article.api");
  const top = [
    { rank: 1, modelSlug: "openai/gpt-5.1", name: "GPT-5.1", company: "OpenAI", avgScore: 7.9, avgLatency: 4798, costPer1kMn: 0.0327 },
    { rank: 2, modelSlug: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", company: "Anthropic", avgScore: 6.72, avgLatency: 4224, costPer1kMn: 0.0262 },
  ];
  const md = assembleArticle(
    {
      titleMn: "Гарчиг", leadMn: "Лид.", surprise: "Гэнэтийн.",
      byCategory: [{ category: "Товчлол", text: "Тайлбар." }], caveat: "Хязгаарлалт.",
    },
    "2026-09",
    top,
    "https://ai-news.mn",
  );

  assert.match(md, /## Эрэмбэ — 2026 оны 9-р сар/);
  assert.ok(!md.includes("сар-ийн"), "«сар-ийн» гэсэн эвгүй залгалт байхгүй");
  assert.match(md, /\| 1 \| GPT-5\.1 \| 7\.90 \| 4\.8с \| \$0\.033 \|/);
  assert.match(md, /## Хамгийн гэнэтийн үр дүн/);
  assert.match(md, /- \*\*Товчлол\*\* — Тайлбар\./);
  assert.match(md, /https:\/\/ai-news\.mn\/benchmark\/argachlal/);
  assert.match(md, /https:\/\/ai-news\.mn\/benchmark\)/);
});
