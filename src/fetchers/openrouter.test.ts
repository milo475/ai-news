import { test } from "node:test";
import assert from "node:assert/strict";
import {
  companySlugOf,
  fetchModels,
  groupByDay,
  isCanonicalModel,
  permaslugBase,
  pricePerMillion,
  rankDay,
  splitName,
  type RankingRow,
} from "./openrouter.api";

test("хувиргалтууд", () => {
  assert.equal(companySlugOf("openai/gpt-6-astra"), "openai");
  assert.deepEqual(splitName("OpenAI: GPT-6 Astra"), { company: "OpenAI", model: "GPT-6 Astra" });
  assert.deepEqual(splitName("Pareto"), { company: "", model: "Pareto" });
  assert.equal(pricePerMillion("0.00001"), 10);
  assert.equal(pricePerMillion("0"), 0);
  assert.equal(permaslugBase("openai/gpt-6-astra-20260903:free"), "openai/gpt-6-astra-20260903");
});

test("хувилбар нэгтгэх + эрэмбэ + delta", () => {
  const rows: RankingRow[] = [
    { date: "2026-09-18", model_permaslug: "a/x-1", total_tokens: "100" },
    { date: "2026-09-18", model_permaslug: "b/y-1", total_tokens: "90" },
    { date: "2026-09-18", model_permaslug: "other", total_tokens: "5" },
    { date: "2026-09-19", model_permaslug: "b/y-1", total_tokens: "120" },
    { date: "2026-09-19", model_permaslug: "a/x-1", total_tokens: "70" },
    { date: "2026-09-19", model_permaslug: "a/x-1:free", total_tokens: "40" }, // 70+40 = 110
    { date: "2026-09-19", model_permaslug: "c/z-1", total_tokens: "10" },
  ];
  const days = groupByDay(rows);
  assert.equal(days.length, 2);
  assert.equal(days[1]!.totals.get("a/x-1"), 110n);
  assert.equal(days[1]!.totals.has("other"), false);

  const d0 = rankDay(days[0]!);
  assert.deepEqual(d0.map((r) => [r.slug, r.rank, r.rankDelta]), [["a/x-1", 1, null], ["b/y-1", 2, null]]);

  const d1 = rankDay(days[1]!, days[0]);
  const by = Object.fromEntries(d1.map((r) => [r.slug, r]));
  assert.equal(by["b/y-1"]!.rank, 1);
  assert.equal(by["b/y-1"]!.rankDelta, 1);        // 2 → 1: дээшилсэн
  assert.equal(by["b/y-1"]!.scoreDelta, 30n);
  assert.equal(by["a/x-1"]!.rank, 2);
  assert.equal(by["a/x-1"]!.rankDelta, -1);       // 1 → 2: буурсан
  assert.equal(by["a/x-1"]!.scoreDelta, 10n);     // 110 - 100
  assert.equal(by["c/z-1"]!.rankDelta, null);     // шинэ
});

// Сүлжээ хэрэгтэй: LIVE=1 npx tsx --test src/fetchers/openrouter.test.ts
test("бодит каталог: alias/variant шүүлт", { skip: !process.env.LIVE }, async () => {
  const all = await fetchModels();
  const canon = all.filter(isCanonicalModel);
  assert.ok(canon.length > 50, `хэт цөөн: ${canon.length}`);
  assert.ok(canon.every((m) => !m.id.includes(":") && !m.id.startsWith("~")));
  const dupes = canon.map((m) => m.canonical_slug).filter((s, i, a) => a.indexOf(s) !== i);
  assert.deepEqual(dupes, [], "canonical_slug давхардсан");
  console.log(`  нийт ${all.length} → канон ${canon.length}, компани ${new Set(canon.map((m) => companySlugOf(m.id))).size}`);
});
