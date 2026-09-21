import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogIndex, displayName, matchArenaModel, normalizeModelName, parseArenaRows, rankArena,
  type ArenaRow,
} from "./arena.api";
import { leaderboardWhere } from "../queries/rank-filter";

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
  const entries = rankArena(
    [
      row("claude-opus-5-max", 1505, 1),
      row("claude-opus-5-high", 1500, 2),   // ижил модель — өндөр Elo нь үлдэнэ
      row("gemini-3.8-flash-high", 1494, 3),
    ],
    index,
  );
  assert.deepEqual(
    entries.map((e) => [e.slug, e.rating, e.rank, e.isNew]),
    [
      ["anthropic/claude-opus-5", 1505, 1, false],
      ["google/gemini-3.8-flash", 1494, 2, false],
    ],
  );
});

test("rankArena: каталогт байхгүй нэр arenaOnly болж шинээр үүснэ", () => {
  const index = buildCatalogIndex([{ slug: "anthropic/claude-opus-5", name: "Claude Opus 5" }]);
  const entries = rankArena(
    [
      row("claude-opus-5-high", 1505, 1),
      { ...row("ernie-5.0-preview-1203", 1480, 2), organization: "baidu" },
      { ...row("ernie-5.0-0110", 1470, 3), organization: "baidu" },   // ижил модель, бага Elo
      { ...row("mimo-v2-pro", 1465, 4), organization: "xiaomi" },
    ],
    index,
  );
  const fresh = entries.filter((e) => e.isNew);
  assert.deepEqual(
    fresh.map((e) => [e.slug, e.name, e.organization, e.rating]),
    [
      ["ernie50", "ernie-5.0", "baidu", 1480],   // хувилбарууд нэгтгэгдэж, өндөр Elo нь үлдэв
      ["mimov2pro", "mimo-v2-pro", "xiaomi", 1465],
    ],
  );
  // Эрэмбэ нь бүх моделийн дунд нэгдсэн байна
  assert.deepEqual(entries.map((e) => e.rank), [1, 2, 3]);
});

test("arenaOnly модель хэрэглээний жагсаалтад орохгүй", () => {
  assert.deepEqual(leaderboardWhere("OPENROUTER_USAGE"), {
    source: "OPENROUTER_USAGE",
    model: { arenaOnly: false },
  });
  // Чанарын жагсаалтад бүгд орно
  assert.deepEqual(leaderboardWhere("ARENA_ELO"), { source: "ARENA_ELO" });
});

test("displayName: огноо, бодох хүчийг тайрч, загварын нэрийг үлдээнэ", () => {
  assert.equal(displayName("ernie-5.0-preview-1203"), "ernie-5.0");
  assert.equal(displayName("grok-4.1-thinking"), "grok-4.1");
  assert.equal(displayName("grok-3-preview-02-24"), "grok-3");
  assert.equal(displayName("muse-spark-1.2 (xHigh)"), "muse-spark-1.2");
  assert.equal(displayName("chatgpt-4o-latest-20250326"), "chatgpt-4o");
  // "-max", "-chat" нь жинхэнэ нэрийн хэсэг тул харуулахдаа үлдэнэ
  assert.equal(displayName("qwen3.5-max-preview"), "qwen3.5-max");
  assert.equal(displayName("longcat-flash-chat-2602-exp"), "longcat-flash-chat");
  // Харин тааруулахдаа тайрна — Claude-ийн "-max" нь бодох хүчний тэмдэг
  assert.equal(normalizeModelName("qwen3.5-max-preview"), "qwen35");
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
