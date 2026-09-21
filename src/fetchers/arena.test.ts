import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogIndex, matchArenaModel, normalizeModelName, parseArenaRows, rankArena,
  type ArenaRow,
} from "./arena.api";

test("normalizeModelName: суффикс, огноо, зай", () => {
  assert.equal(normalizeModelName("claude-opus-5-high"), "claudeopus5");
  assert.equal(normalizeModelName("claude-opus-5-max"), "claudeopus5");
  assert.equal(normalizeModelName("gemini-3.8-flash-high"), "gemini38flash");
  assert.equal(normalizeModelName("Claude Opus 5"), "claudeopus5");
  assert.equal(normalizeModelName("chatgpt-4o-latest-20250326"), "chatgpt4o");
  assert.equal(normalizeModelName("muse-spark-1.2 (xHigh)"), "musespark12");
  assert.equal(normalizeModelName("grok-4.20-beta-0309-reasoning"), "grok420");
  assert.equal(normalizeModelName("amazon-nova-experimental-chat-26-02-10"), "amazonnova");
  assert.equal(normalizeModelName("openai/gpt-6-astra:free"), "openaigpt6astra");
});

test("normalizeModelName: хэмжээний нэрийг суффикс гэж тайрахгүй", () => {
  // "-medium" нь mistral-medium шиг жинхэнэ нэрийн хэсэг — тайрвал "mistral" болчихно
  assert.equal(normalizeModelName("mistral-medium-2508"), "mistralmedium");
  assert.equal(normalizeModelName("gemini-3.8-flash"), "gemini38flash");
  assert.equal(normalizeModelName("gpt-5.6-mini"), "gpt56mini");
});

test("buildCatalogIndex + matchArenaModel", () => {
  const index = buildCatalogIndex([
    { slug: "anthropic/claude-opus-5", name: "Claude Opus 5" },
    { slug: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
  ]);
  assert.equal(matchArenaModel("claude-opus-5-high", index), "anthropic/claude-opus-5");
  assert.equal(matchArenaModel("gemini-3.8-flash-high", index), "google/gemini-3.8-flash");
  assert.equal(matchArenaModel("ernie-5.0-0110", index), null);
  // alias хүснэгтээр гараар тааруулах
  assert.equal(matchArenaModel("ernie-5.0-0110", index, { ernie50: "baidu/ernie-5.0" }), "baidu/ernie-5.0");
});

const row = (modelName: string, rating: number, arenaRank: number): ArenaRow => ({
  modelName, rating, arenaRank, organization: "x", voteCount: 100, publishDate: "2026-09-13",
});

test("rankArena: хувилбаруудыг нэгтгэж дахин эрэмбэлнэ", () => {
  const index = buildCatalogIndex([
    { slug: "anthropic/claude-opus-5", name: "Claude Opus 5" },
    { slug: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
  ]);
  const { ranked, unmatched } = rankArena(
    [
      row("claude-opus-5-max", 1505, 1),
      row("claude-opus-5-high", 1500, 2),   // ижил модель — өндөр Elo нь үлдэнэ
      row("gemini-3.8-flash-high", 1494, 3),
      row("ernie-5.1", 1480, 4),            // каталогт алга
    ],
    index,
  );
  assert.deepEqual(ranked, [
    { slug: "anthropic/claude-opus-5", rating: 1505, rank: 1 },
    { slug: "google/gemini-3.8-flash", rating: 1494, rank: 2 },
  ]);
  assert.deepEqual(unmatched.map((u) => u.key), ["ernie51"]);
});

test("parseArenaRows: зөвхөн overall, дутуу мөрийг алгасна", () => {
  const fixture = {
    rows: [
      { row: { model_name: "claude-opus-5-max", organization: "anthropic", rating: 1505.1, vote_count: 20706, rank: 1, category: "overall", leaderboard_publish_date: "2026-09-13" } },
      { row: { model_name: "gemini-3.8-flash", organization: "google", rating: 1494.7, vote_count: 5, rank: 2, category: "hard_prompts", leaderboard_publish_date: "2026-09-13" } },
      { row: { model_name: "broken", organization: "x", category: "overall" } },
    ],
  };
  const rows = parseArenaRows(fixture);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    modelName: "claude-opus-5-max", organization: "anthropic", rating: 1505.1,
    voteCount: 20706, arenaRank: 1, publishDate: "2026-09-13",
  });
  assert.deepEqual(parseArenaRows({}), []);
  assert.deepEqual(parseArenaRows(null), []);
});
