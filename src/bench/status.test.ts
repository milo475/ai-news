import { test } from "node:test";
import assert from "node:assert/strict";
import { decideStart, isMeasured, MEASURED, RETRY_AFTER_HOURS } from "./status.api";

const NOW = new Date("2026-10-01T19:30:00Z"); // УБ 10/1 03:30
const BASE = { now: NOW, day: 1, ubHour: 3, dailyHour: 3, finishedAt: null };

test("зөвхөн DONE/BUDGET нь «хэмжигдсэн»", () => {
  assert.deepEqual(MEASURED, ["DONE", "BUDGET"]);
  assert.equal(isMeasured("DONE"), true);
  assert.equal(isMeasured("BUDGET"), true);
  // 2026-09-28-ны регресс: FAILED-ыг «хэмжигдсэн» гэж үзэж байсан
  assert.equal(isMeasured("FAILED"), false);
  assert.equal(isMeasured("RUNNING"), false);
  assert.equal(isMeasured(null), false);
});

test("хэмжигдсэн сарыг дахин ажиллуулахгүй", () => {
  for (const status of ["DONE", "BUDGET"]) {
    const d = decideStart({ ...BASE, status });
    assert.equal(d.go, false, status);
    assert.equal(d.skip, "хэмжигдсэн");
  }
});

test("дуусаагүй run өдөр, цагаас үл хамааран үргэлжилнэ", () => {
  const d = decideStart({ ...BASE, status: "RUNNING", day: 17, ubHour: 1 });
  assert.equal(d.go, true);
  assert.equal(d.resume, true);
});

test("УНАСАН run 6 цагийн дараа дахин оролдоно", () => {
  const justFailed = decideStart({
    ...BASE, status: "FAILED", finishedAt: new Date(NOW.getTime() - 60 * 60_000),
  });
  assert.equal(justFailed.go, false);
  assert.equal(justFailed.skip, "унасан — хүлээж байна");
  assert.match(justFailed.detail, /6ц-ийн дараа/);

  const old = decideStart({
    ...BASE, status: "FAILED",
    finishedAt: new Date(NOW.getTime() - (RETRY_AFTER_HOURS + 1) * 3_600_000),
  });
  assert.equal(old.go, true, "хугацаа өнгөрсөн бол дахин оролдоно");
  assert.equal(old.resume, false);
});

test("унасан run сарын 1 биш ч дахин оролдоно", () => {
  // /benchmark-ыг сар дуустал хоосон үлдээх нь буруу
  const d = decideStart({
    ...BASE, status: "FAILED", day: 17,
    finishedAt: new Date(NOW.getTime() - 24 * 3_600_000),
  });
  assert.equal(d.go, true);
});

test("run байхгүй бол зөвхөн сарын 1-нд эхэлнэ", () => {
  assert.equal(decideStart({ ...BASE, status: null, day: 29 }).skip, "сарын 1 биш");
  assert.equal(decideStart({ ...BASE, status: null, day: 1, ubHour: 1 }).skip, "өглөөний цаг болоогүй");
});

test("10/1-нд 2026-10 run ЭХЭЛНЭ", () => {
  // Шинэ сар — BenchRun байхгүй, УБ 10/1 03:00, өглөөний цаг болсон
  const d = decideStart({ status: null, finishedAt: null, now: NOW, day: 1, ubHour: 3, dailyHour: 3 });
  assert.equal(d.go, true, JSON.stringify(d));
  assert.equal(d.resume, false);
  assert.equal(d.skip, null);
  assert.match(d.detail, /сарын шинэ хэмжилт/);
});

test("9-р сарын унасан run нь 10-р сарын эхлэлд саад болохгүй", () => {
  // `findUnique({ month })` нь САР ТУС БҮРД тусдаа мөр — 2026-09-ийн төлөв
  // 2026-10-ийн шийдвэрт огт нөлөөлөхгүй
  const october = decideStart({ status: null, finishedAt: null, now: NOW, day: 1, ubHour: 4, dailyHour: 3 });
  assert.equal(october.go, true);
});

test("гараар дуудвал өдөр, цагийн шалгалт алгасагдана", () => {
  const d = decideStart({ ...BASE, status: null, day: 29, ubHour: 1, manual: true });
  assert.equal(d.go, true);
  assert.match(d.detail, /гараар дуудсан/);
});

test("гараар дуудсан ч ХЭМЖИГДСЭН сарыг дахин ажиллуулахгүй", () => {
  assert.equal(decideStart({ ...BASE, status: "DONE", manual: true }).go, false);
});
