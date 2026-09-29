import { test } from "node:test";
import assert from "node:assert/strict";
import {
  logFileName, planFileName, PLAN_VERSION, stateHash, ubDay, validateStored, type StoredPlan,
} from "./fix-store.api";

const STATE = {
  sourceText: "According to Bloomberg…",
  titleMn: "Гарчиг",
  summaryMn: "Хураангуй",
  bodyMn: "Биет",
  fbText: "FB",
  fbHook: "карт",
};

const stored = (over: Partial<StoredPlan> = {}): StoredPlan => ({
  version: PLAN_VERSION,
  slug: "a",
  at: "2026-09-30T05:00:00.000Z",
  stateHash: stateHash(STATE),
  before: { titleMn: "Гарчиг", summaryMn: "Хураангуй", bodyMn: "Биет", fbText: "FB", fbHook: "карт" },
  proposed: {
    titleMn: "Шинэ", summaryMn: "Шинэ", bodyMn: "Шинэ биет", fbText: "", fbHook: "", changed: ["x"],
  },
  issues: [], claims: [], blocking: [], costUsd: 0.02,
  ...over,
});

// ---------- Файлын нэр ----------

test("файлын нэр УБ огноогоор", () => {
  // UTC 2026-09-29 17:00 = УБ 2026-09-30 01:00
  assert.equal(ubDay(new Date("2026-09-29T17:00:00Z")), "2026-09-30");
  assert.equal(planFileName(new Date("2026-09-29T17:00:00Z"), "abc"), "2026-09-30-abc.json");
  assert.equal(logFileName(new Date("2026-09-29T17:00:00Z")), "2026-09-30.txt");
});

// ---------- Hash ----------

test("эх текст өөрчлөгдвөл hash өөрчлөгдөнө", () => {
  assert.notEqual(stateHash(STATE), stateHash({ ...STATE, sourceText: "өөр" }));
});

test("биет өөрчлөгдвөл hash өөрчлөгдөнө", () => {
  assert.notEqual(stateHash(STATE), stateHash({ ...STATE, bodyMn: "өөр биет" }));
});

test("null ба хоосон мөр ялгаатай", () => {
  assert.notEqual(stateHash({ ...STATE, fbText: null }), stateHash({ ...STATE, fbText: "" }));
});

test("талбарын заагаас болж хоёрдмол утга гарахгүй", () => {
  // «аб» + «в» ба «а» + «бв» нь ижил hash өгөх ёсгүй
  assert.notEqual(
    stateHash({ ...STATE, titleMn: "аб", summaryMn: "в" }),
    stateHash({ ...STATE, titleMn: "а", summaryMn: "бв" }),
  );
});

test("ижил байдалд ижил hash", () => {
  assert.equal(stateHash(STATE), stateHash({ ...STATE }));
});

// ---------- Батламж ----------

test("зөв саналыг хүлээж авна", () => {
  const v = validateStored(stored(), { stateHash: stateHash(STATE), slug: "a" });
  assert.equal(v.ok, true);
});

test("нийтлэл өөрчлөгдсөн бол НЯЦААНА", () => {
  const v = validateStored(stored(), { stateHash: stateHash({ ...STATE, bodyMn: "хүн зассан" }), slug: "a" });
  assert.equal(v.ok, false);
  assert.match(v.ok ? "" : v.reason, /ӨӨРЧЛӨГДСӨН/);
});

test("өөр нийтлэлийн саналыг хэрэглэхгүй", () => {
  const v = validateStored(stored({ slug: "b" }), { stateHash: stateHash(STATE), slug: "a" });
  assert.equal(v.ok, false);
});

test("хуучин форматыг татгалзана", () => {
  const v = validateStored(stored({ version: 0 as never }), { stateHash: stateHash(STATE), slug: "a" });
  assert.equal(v.ok, false);
  assert.match(v.ok ? "" : v.reason, /формат/);
});

test("хоосон биеттэй саналыг татгалзана", () => {
  const p = stored();
  const v = validateStored(
    { ...p, proposed: { ...p.proposed, bodyMn: "" } },
    { stateHash: stateHash(STATE), slug: "a" },
  );
  assert.equal(v.ok, false);
});

test("файл уншигдаагүй бол татгалзана", () => {
  assert.equal(validateStored(null, { stateHash: "x", slug: "a" }).ok, false);
});
