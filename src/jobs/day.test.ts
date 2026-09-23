import { test } from "node:test";
import assert from "node:assert/strict";
import { sameUbDay, ubDateLabel, ubDayRange, UB_OFFSET_MS } from "./day";

test("ubDayRange: УБ өдөр UTC-ийн 16:00-аас эхэлнэ", () => {
  assert.equal(UB_OFFSET_MS, 8 * 3_600_000);

  // УБ 2026-09-23 09:00 = UTC 2026-09-23T01:00
  const { start, end } = ubDayRange(new Date("2026-09-23T01:00:00Z"));
  assert.equal(start.toISOString(), "2026-09-22T16:00:00.000Z");
  assert.equal(end.toISOString(), "2026-09-23T16:00:00.000Z");

  // УБ шөнө дунд болоход л шинэ өдөр эхэлнэ
  assert.equal(ubDayRange(new Date("2026-09-22T15:59:59Z")).start.toISOString(), "2026-09-21T16:00:00.000Z");
  assert.equal(ubDayRange(new Date("2026-09-22T16:00:00Z")).start.toISOString(), "2026-09-22T16:00:00.000Z");
});

test("ubDateLabel: УБ цагийн огноо", () => {
  assert.equal(ubDateLabel(new Date("2026-09-23T01:00:00Z")), "2026-09-23"); // УБ 09:00
  assert.equal(ubDateLabel(new Date("2026-09-22T17:00:00Z")), "2026-09-23"); // УБ 01:00 — маргааш
  assert.equal(ubDateLabel(new Date("2026-09-22T15:00:00Z")), "2026-09-22"); // УБ 23:00
});

/** Cron: 0 1,5,11 * * * UTC = УБ 09:00, 13:00, 19:00 */
test("өдөрт нэг удаа: нэг өдрийн 3 run нэг УБ өдөрт багтана", () => {
  const morning = new Date("2026-09-23T01:00:00Z");  // УБ 09:00
  const noon = new Date("2026-09-23T05:00:00Z");     // УБ 13:00
  const evening = new Date("2026-09-23T11:00:00Z");  // УБ 19:00
  const nextMorning = new Date("2026-09-24T01:00:00Z");

  // Өглөөний run-ийн дараа өдөр/оройных нь «өнөөдөр ажилласан» гэж алгасагдана
  for (const later of [noon, evening]) {
    assert.equal(sameUbDay(morning, later), true);
    const { start, end } = ubDayRange(later);
    assert.ok(morning >= start && morning < end, "өглөөний run тухайн УБ өдөрт байна");
  }

  // Маргааш дахин ажиллана
  assert.equal(sameUbDay(morning, nextMorning), false);
  const { start } = ubDayRange(nextMorning);
  assert.ok(morning < start, "өчигдрийн run шинэ өдрийн цонхонд орохгүй");
});
