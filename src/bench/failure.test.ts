import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyError, completeness, completenessLabel, isInfraError, MIN_COMPLETE_RATIO,
} from "./failure.api";

test("дэд бүтцийн алдааг таана", () => {
  // 2026-09-27-нд яг эдгээр нь «модель хариу өгсөнгүй» гэж 0 оноо болсон
  for (const m of [
    "OpenRouter chat 402: Insufficient credits",
    "OpenRouter chat 402: would exceed your available credits given your current in-flight requests",
    "OpenRouter chat 402: can only afford 308",
    "OpenRouter chat 401: no auth credentials found",
    "OpenRouter chat 429: rate limit exceeded",
    "OpenRouter chat 503: upstream error",
    "The operation was aborted due to timeout",
    "fetch failed",
    "OpenRouter: данс дууссан — openrouter.ai/settings/credits",
  ]) {
    assert.equal(classifyError(m), "infra", m);
    assert.equal(isInfraError(m), true, m);
  }
});

test("моделийн бодит алдааг infra гэж бүү бич", () => {
  for (const m of [
    "OpenRouter chat: хариу таслагдсан (max_tokens=1200 хүрэлцэхгүй)",
    "JSON задлах алдаа",
    "I cannot help with that request",
    "тестийн алдаа",
  ]) {
    assert.equal(classifyError(m), "model", m);
  }
});

test("алдааны бичвэр хоосон бол моделийнх", () => {
  assert.equal(classifyError(null), "model");
  assert.equal(classifyError(""), "model");
});

// ---------- Бүрэн бүтэн байдал ----------

const ok = (n: number) => Array.from({ length: n }, () => ({ score: 8 }));

test("бүгд оноотой бол бүрэн", () => {
  const c = completeness(ok(10));
  assert.equal(c.ok, true);
  assert.equal(c.ratio, 1);
  assert.equal(c.scored, 10);
});

test("90%-аас доош оноотой бол дутуу", () => {
  const rows = [...ok(8), { score: null }, { score: null }];
  const c = completeness(rows);
  assert.equal(c.ratio, 0.8);
  assert.equal(c.ok, false);
  assert.equal(c.unjudged, 2);
});

test("яг 90% бол бүрэн", () => {
  const c = completeness([...ok(9), { score: null }]);
  assert.equal(c.ratio, 0.9);
  assert.equal(c.ok, true);
  assert.equal(MIN_COMPLETE_RATIO, 0.9);
});

test("дэд бүтцийн алдаа хуваариас ХАСАГДАНА — моделийг буруутгахгүй", () => {
  // 10 даалгавраас 3 нь 402-оор унасан, үлдсэн 7 нь бүгд оноотой
  const rows = [
    ...ok(7),
    ...Array.from({ length: 3 }, () => ({ error: "402", errorKind: "infra", score: null })),
  ];
  const c = completeness(rows);
  assert.equal(c.infra, 3);
  assert.equal(c.ratio, 1, "7/7 = бүрэн");
  assert.equal(c.ok, true);
});

test("бүгд дэд бүтцийн алдаа бол дүгнэх өгөгдөл алга", () => {
  const rows = Array.from({ length: 5 }, () => ({ error: "402", errorKind: "infra", score: null }));
  const c = completeness(rows);
  assert.equal(c.ok, false, "өгөгдөлгүй модельд дүн гаргаж болохгүй");
  assert.equal(c.ratio, 0);
});

test("бүх даалгаварт моделийн алдаа гарвал дутуу — «бүгд 0» гэж бичихгүй", () => {
  // finalScore нь моделийн алдааг 0 гэж үнэлдэг ч ХАРИУ өгөөгүй тул дүн гаргахгүй
  const rows = Array.from({ length: 4 }, () => ({ error: "тестийн алдаа", errorKind: "model", score: 0 }));
  const c = completeness(rows);
  assert.equal(c.answered, 0);
  assert.equal(c.ok, false);
});

test("логийн шошго задаргааг харуулна", () => {
  const label = completenessLabel(
    completeness([...ok(6), { error: "402", errorKind: "infra", score: null }, { score: null }]),
  );
  assert.match(label, /6\/7 оноотой/);
  assert.match(label, /1 дэд бүтцийн алдаа/);
  assert.match(label, /1 шүүгчгүй/);
});
