import assert from "node:assert/strict";
import { test } from "node:test";
import { clearAllCaches, memoTtl, TTL_SECONDS } from "./cache.api";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

test("нэг түлхүүрт нэг л удаа дуудна", async () => {
  const c = clock();
  let calls = 0;
  const f = memoTtl(async (n: number) => { calls++; return n * 2; }, { name: "t", ttlMs: 1_000, now: c.now });

  assert.equal(await f(2), 4);
  assert.equal(await f(2), 4);
  assert.equal(calls, 1);

  assert.equal(await f(3), 6);
  assert.equal(calls, 2);
});

test("TTL дуусахад дахин дуудна", async () => {
  const c = clock();
  let calls = 0;
  const f = memoTtl(async () => ++calls, { name: "t", ttlMs: 1_000, now: c.now });

  assert.equal(await f(), 1);
  c.advance(999);
  assert.equal(await f(), 1);
  c.advance(2);
  assert.equal(await f(), 2);
});

test("Date-ийг хэвээр нь буцаана (JSON болгодоггүй)", async () => {
  const d = new Date("2026-09-26T00:00:00Z");
  const f = memoTtl(async () => ({ at: d }), { name: "t", ttlMs: 1_000 });
  const first = await f();
  const second = await f();
  assert.ok(second.at instanceof Date);
  assert.equal(second.at.getTime(), first.at.getTime());
});

test("зэрэг ирсэн хүсэлтүүд нэгддэг (single flight)", async () => {
  let calls = 0;
  const f = memoTtl(
    async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    },
    { name: "t", ttlMs: 1_000 },
  );
  const [a, b, c2] = await Promise.all([f(), f(), f()]);
  assert.equal(calls, 1);
  assert.deepEqual([a, b, c2], [1, 1, 1]);
});

test("алдааг кэшлэхгүй", async () => {
  let calls = 0;
  const f = memoTtl(
    async () => {
      calls++;
      if (calls === 1) throw new Error("нэг удаа унана");
      return "за";
    },
    { name: "t", ttlMs: 10_000 },
  );
  await assert.rejects(() => f());
  assert.equal(await f(), "за");
  assert.equal(calls, 2);
});

test("max хэтрэхэд хамгийн эртнийхийг хаяна", async () => {
  const f = memoTtl(async (n: number) => n, { name: "t", ttlMs: 10_000, max: 3 });
  for (const n of [1, 2, 3, 4, 5]) await f(n);
  assert.equal(f.size(), 3);
});

test("clear — кэш хоосорно", async () => {
  let calls = 0;
  const f = memoTtl(async () => ++calls, { name: "t", ttlMs: 10_000 });
  await f();
  f.clear();
  await f();
  assert.equal(calls, 2);
});

test("clearAllCaches — бүртгэгдсэн бүх кэшийг цэвэрлэнэ", async () => {
  let a = 0;
  let b = 0;
  const f1 = memoTtl(async () => ++a, { name: "a", ttlMs: 10_000 });
  const f2 = memoTtl(async () => ++b, { name: "b", ttlMs: 10_000 });
  await f1();
  await f2();
  assert.ok(clearAllCaches() >= 2);
  await f1();
  await f2();
  assert.equal(a, 2);
  assert.equal(b, 2);
});

test("TTL_SECONDS — тохиролцсон утгууд", () => {
  assert.deepEqual(TTL_SECONDS, { home: 300, news: 60, list: 3_600, guide: 86_400 });
});

test("тусдаа түлхүүр функц", async () => {
  let calls = 0;
  const f = memoTtl(
    async (o: { slug: string; extra: number }) => { calls++; return o.slug; },
    { name: "t", ttlMs: 1_000, key: (o) => o.slug },
  );
  await f({ slug: "a", extra: 1 });
  await f({ slug: "a", extra: 999 });
  assert.equal(calls, 1, "extra өөр ч түлхүүр нь ижил");
});
