import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bySource, byPersona, byTool, campaignOf, funnelOf, personaOf, sourceOf, type SessionRow,
} from "./attribution.api";

test("utm_source нь referrer-ээс давуу", () => {
  assert.equal(
    sourceOf({ utmSource: "facebook", referrer: "https://google.com/search" }),
    "facebook",
  );
});

test("referrer-ийн домэйнийг танина", () => {
  assert.equal(sourceOf({ referrer: "https://www.facebook.com/ainews/posts/123" }), "facebook");
  assert.equal(sourceOf({ referrer: "https://l.instagram.com/?u=x" }), "instagram");
  assert.equal(sourceOf({ referrer: "https://www.google.com/search?q=ai" }), "google");
  assert.equal(sourceOf({ referrer: "https://t.co/abc" }), "twitter");
  // Танихгүй домэйн — домэйнээр нь
  assert.equal(sourceOf({ referrer: "https://news.mn/article/1" }), "news.mn");
});

test("referrer байхгүй бол direct", () => {
  assert.equal(sourceOf({}), "direct");
  assert.equal(sourceOf({ referrer: "" }), "direct");
  assert.equal(sourceOf({ referrer: "буруу-url" }), "direct");
});

test("өөрийн сайтаас ирвэл дотоод шилжилт", () => {
  assert.equal(sourceOf({ referrer: "https://ainews.mn/prompt", host: "ainews.mn" }), "internal");
  assert.equal(sourceOf({ referrer: "https://www.ainews.mn/prompt", host: "ainews.mn" }), "internal");
});

test("БҮТЭН URL, IP хадгалахгүй — зөвхөн ангилал", () => {
  // Зам, query, хэрэглэгчийн оруулсан хог утга орох ёсгүй
  const s = sourceOf({ referrer: "https://news.mn/a/b?id=123&user=batbold" });
  assert.equal(s, "news.mn");
  assert.ok(!s.includes("/"));
  assert.ok(!s.includes("?"));
  // Хог utm — хаяна
  assert.equal(sourceOf({ utmSource: "<script>alert(1)</script>" }), "direct");
  assert.equal(campaignOf("хөндлөнгийн ' утга"), null);
});

test("мэргэжлийг зөвхөн ТАНИГДСАН slug-аас авна", () => {
  const known = ["bagsh", "marketer"];
  assert.equal(personaOf("bagsh", known), "bagsh");
  assert.equal(personaOf("байхгүй", known), null);
  assert.equal(personaOf(null, known), null);
});

// ---------- Юүлүүр ----------

const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  source: "direct", persona: null, completed: true, copied: false,
  revisionCount: 0, costUsd: 0.05, outputMs: 30_000, tools: ["gemini"], ...over,
});

test("юүлүүрийн хувиуд", () => {
  const rows = [
    row({ completed: true, copied: true }),
    row({ completed: true, copied: false }),
    row({ completed: false, copied: false, outputMs: null }),
    row({ completed: true, copied: true, revisionCount: 2 }),
  ];
  const f = funnelOf(rows, 7);
  assert.equal(f.sessions, 4);
  assert.equal(f.perDay, 0.6);
  assert.equal(f.completedPct, 75);
  assert.equal(f.copiedPct, 50);
  assert.equal(f.revisedPct, 25);
  assert.equal(f.costPerSession, 0.05);
});

test("хугацаа байхгүй сесс p50-д орохгүй", () => {
  const f = funnelOf([row({ outputMs: 20_000 }), row({ outputMs: null }), row({ outputMs: 40_000 })], 7);
  assert.equal(f.p50, 40);
  assert.equal(f.p90, 40);
});

test("сесс алга бол бүх хувь 0 — хуваахад унахгүй", () => {
  const f = funnelOf([], 7);
  assert.deepEqual([f.sessions, f.completedPct, f.copiedPct, f.costPerSession, f.p50], [0, 0, 0, 0, 0]);
});

test("эх сурвалж, мэргэжил, хэрэгслээр бүлэглэнэ", () => {
  const rows = [
    row({ source: "facebook", persona: "bagsh", tools: ["gemini", "canva"] }),
    row({ source: "facebook", persona: "bagsh", completed: false }),
    row({ source: "direct", persona: null, tools: ["kling"] }),
  ];
  assert.deepEqual(bySource(rows).map((b) => [b.key, b.count]), [["facebook", 2], ["direct", 1]]);
  assert.deepEqual(byPersona(rows), [{ key: "bagsh", count: 2, completedPct: 50 }]);
  // Хэрэгсэл бүр тусад нь тоологдоно
  const tools = byTool(rows).map((b) => b.key).sort();
  assert.deepEqual(tools, ["canva", "gemini", "kling"]);
});
