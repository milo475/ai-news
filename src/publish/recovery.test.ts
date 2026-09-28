import { test } from "node:test";
import assert from "node:assert/strict";
import { missedSlot, RECOVERY_MIN, slotKey, todaysWindows } from "./recovery.api";
import { UB_OFFSET_MS } from "../jobs/day";

const TIMES = [
  { hour: 7, minute: 30 },
  { hour: 12, minute: 30 },
  { hour: 19, minute: 30 },
];

/** УБ цагаар тухайн өдрийн агшин */
const ub = (h: number, m: number) => new Date(Date.UTC(2026, 9, 5, h, m) - UB_OFFSET_MS);

test("нөхөх цонх 90 минут", () => {
  assert.equal(RECOVERY_MIN, 90);
});

test("өнөөдөр аль хэдийн эхэлсэн slot-уудыг шинэ нь түрүүлж гаргана", () => {
  const w = todaysWindows(ub(13, 0), TIMES);
  assert.deepEqual(w.map((x) => `${x.time.hour}:${x.time.minute}`), ["12:30", "7:30"]);
  assert.equal(w[0]!.deadline.getTime() - w[0]!.start.getTime(), RECOVERY_MIN * 60_000);
});

test("эхлээгүй slot цонхонд орохгүй", () => {
  assert.deepEqual(todaysWindows(ub(7, 0), TIMES), []);
});

test("slot-ын түлхүүр нь УБ огноо + цаг", () => {
  assert.equal(slotKey({ hour: 7, minute: 30 }, ub(8, 0)), "2026-10-05-0730");
  assert.equal(slotKey({ hour: 19, minute: 30 }, ub(20, 0)), "2026-10-05-1930");
});

test("slot алдагдсан бол нөхнө", () => {
  // 12:30-ын slot дээр юу ч нийтлэгдээгүй, одоо 13:00
  const m = missedSlot({ now: ub(13, 0), times: TIMES, publishedAt: [ub(7, 35)] });
  assert.ok(m);
  assert.equal(m!.key, "2026-10-05-1230");
  assert.equal(m!.lateMin, 30);
});

test("slot дээр нийтлэгдсэн бол нөхөхгүй — давхар нийтлэхгүй", () => {
  const m = missedSlot({ now: ub(13, 0), times: TIMES, publishedAt: [ub(12, 32)] });
  assert.equal(m, null);
});

test("90 минут хэтэрсэн slot-ыг орхино", () => {
  // 12:30 + 90 = 14:00. 14:05-д хэт хоцорсон
  assert.equal(missedSlot({ now: ub(14, 5), times: TIMES, publishedAt: [] }), null);
  // 13:59-д хараахан боломжтой
  assert.ok(missedSlot({ now: ub(13, 59), times: TIMES, publishedAt: [] }));
});

test("зөвхөн ХАМГИЙН СҮҮЛИЙН алдагдсаныг нөхнө", () => {
  // 7:30 ба 12:30 хоёулаа хоосон ч 12:30-г л нөхнө — хоёуланг зэрэг нөхвөл
  // өдрийн квот нэг дор дүүрч, 19:30 хоосон үлдэнэ
  const m = missedSlot({ now: ub(13, 0), times: TIMES, publishedAt: [] });
  assert.equal(m!.key, "2026-10-05-1230");
});

test("slot дөнгөж эхэлсэн үед ч нөхөлт гарна (0 минут хоцорсон)", () => {
  const m = missedSlot({ now: ub(12, 30), times: TIMES, publishedAt: [] });
  assert.equal(m!.lateMin, 0);
});

test("өдрийн эхэнд нөхөх юм байхгүй", () => {
  assert.equal(missedSlot({ now: ub(3, 0), times: TIMES, publishedAt: [] }), null);
});
