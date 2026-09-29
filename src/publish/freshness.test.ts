import { test } from "node:test";
import assert from "node:assert/strict";
import { ageStats, checkTarget, percentile, TARGET_P50_H, TARGET_P90_H } from "./freshness.api";
import { freshness, FRESHNESS_HALF_LIFE_H, rankScore, ageHours } from "../agent/quota.api";

const NOW = new Date("2026-09-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

// ---------- Квантиль ----------

test("p50, p90", () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(v, 50), 5);
  assert.equal(percentile(v, 90), 9);
});

test("хоосон бол null", () => {
  assert.equal(percentile([], 50), null);
});

test("нэг утгатай бол тэр нь бүх квантиль", () => {
  assert.equal(percentile([7], 90), 7);
});

test("ageStats дээд утга, хугацаагүйн тоог өгнө", () => {
  const s = ageStats([10, 20, 30], 2);
  assert.deepEqual([s.n, s.p50, s.max, s.timeless], [3, 20, 30, 2]);
});

// ---------- Зорилт ----------

test("зорилтод хүрвэл 72 цагийн босгыг санал болгоно", () => {
  const v = checkTarget(ageStats([5, 7, 9, 50, 57]));
  assert.equal(v.met, true);
  assert.equal(v.recommendedMaxAgeH, TARGET_P90_H);
});

test("p90 хэтэрвэл босгыг хэвээр үлдээнэ", () => {
  const v = checkTarget(ageStats([5, 7, 9, 50, 200]));
  assert.equal(v.met, false);
  assert.equal(v.recommendedMaxAgeH, null);
});

test("p50 хэтэрвэл зорилт биелээгүй", () => {
  assert.equal(checkTarget(ageStats([30, 31, 32])).met, false);
  assert.ok(TARGET_P50_H < TARGET_P90_H);
});

test("өгөгдөлгүй бол шийдэхгүй", () => {
  assert.equal(checkTarget(ageStats([])).detail, "өгөгдөл хүрэлцэхгүй");
});

// ---------- Шинэлэг байдал ----------

const cand = (h: number, relevance = 7) => ({
  id: "x", relevance, sourceId: "s", category: "NEWS" as const,
  modelSlugs: [], companySlugs: [], tags: [],
  publishedAtSource: hoursAgo(h), createdAt: hoursAgo(h),
});

test("дөнгөж гарсан мэдээ 1, хагас задралын дараа 0.5", () => {
  assert.equal(Math.round(freshness(cand(0), NOW) * 100) / 100, 1);
  assert.equal(Math.round(freshness(cand(FRESHNESS_HALF_LIFE_H), NOW) * 100) / 100, 0.5);
});

test("5 хоногийн настай мэдээний шинэлэг байдал бараг 0", () => {
  assert.ok(freshness(cand(120), NOW) < 0.05);
});

test("огноогүй бол createdAt-аар тооцно", () => {
  assert.equal(ageHours({ publishedAtSource: null, createdAt: hoursAgo(10) }, NOW), 10);
});

test("7 оноотой шинэ мэдээ 9 оноотой 3 хоногийнхыг ялна", () => {
  assert.ok(rankScore(cand(0, 7), NOW) > rankScore(cand(72, 9), NOW));
});

test("5 оноотой шинэ мэдээ 9 оноотой 3 хоногийнхыг ЯЛАХГҮЙ — чанар эхэнд", () => {
  assert.ok(rankScore(cand(0, 5), NOW) < rankScore(cand(72, 9), NOW));
});

test("ижил оноотой бол шинэ нь түрүүлнэ", () => {
  assert.ok(rankScore(cand(2, 8), NOW) > rankScore(cand(48, 8), NOW));
});
