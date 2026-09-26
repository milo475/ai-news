import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, createLimiter, rateLimitHeaders } from "./ratelimit.api";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

test("хязгаар хүртэл зөвшөөрч, хэтэрвэл татгалзана", () => {
  const c = clock();
  const l = createLimiter({ limit: 3, windowMs: 60_000, now: c.now });

  assert.equal(l.check("ip").ok, true);
  assert.equal(l.check("ip").ok, true);
  const third = l.check("ip");
  assert.equal(third.ok, true);
  assert.equal(third.remaining, 0);

  const fourth = l.check("ip");
  assert.equal(fourth.ok, false);
  assert.equal(fourth.remaining, 0);
  assert.ok(fourth.retryAfter > 0);
});

test("цонх дуусахад тоолуур тэглэгдэнэ", () => {
  const c = clock();
  const l = createLimiter({ limit: 2, windowMs: 60_000, now: c.now });
  l.check("ip");
  l.check("ip");
  assert.equal(l.check("ip").ok, false);

  c.advance(60_001);
  const after = l.check("ip");
  assert.equal(after.ok, true);
  assert.equal(after.remaining, 1);
});

test("IP тус бүр тусдаа тоологдоно", () => {
  const c = clock();
  const l = createLimiter({ limit: 1, windowMs: 60_000, now: c.now });
  assert.equal(l.check("a").ok, true);
  assert.equal(l.check("b").ok, true);
  assert.equal(l.check("a").ok, false);
});

test("retryAfter нь цонхны үлдсэн секунд", () => {
  const c = clock();
  const l = createLimiter({ limit: 1, windowMs: 60_000, now: c.now });
  l.check("ip");
  c.advance(30_000);
  assert.equal(l.check("ip").retryAfter, 30);
});

test("хуучирсан түлхүүрүүд цэвэрлэгдэнэ", () => {
  const c = clock();
  const l = createLimiter({ limit: 10, windowMs: 1_000, max: 5, now: c.now });
  for (let i = 0; i < 5; i++) l.check(`ip${i}`);
  assert.equal(l.size(), 5);

  c.advance(2_000);
  // Шинэ түлхүүр нэмэхэд хуучирсан нь хаягдана
  l.check("шинэ");
  assert.ok(l.size() <= 5, `хэмжээ ${l.size()}`);
});

test("clientIp — x-forwarded-for-ийн ЭХНИЙ утга (жинхэнэ клиент)", () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-forwarded-for": " 1.2.3.4 " })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIp(h({})), "unknown");
});

test("rateLimitHeaders — татгалзсан үед Retry-After нэмнэ", () => {
  const c = clock(Date.now());
  const l = createLimiter({ limit: 1, windowMs: 60_000, now: c.now });
  const ok = l.check("ip");
  assert.equal(rateLimitHeaders(1, ok)["Retry-After"], undefined);
  assert.equal(rateLimitHeaders(1, ok)["RateLimit-Limit"], "1");

  const bad = l.check("ip");
  assert.ok(rateLimitHeaders(1, bad)["Retry-After"]);
});
