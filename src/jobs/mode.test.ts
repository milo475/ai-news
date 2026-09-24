import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DAILY_HOUR, DEFAULT_PUBLISH_HOURS, dailyHour, hourLabel, humanDelay, modeFor,
  nextPublishAt, publishHours,
} from "./mode.api";

/** УБ = UTC+8: УБ 07:00 = UTC 23:00 (өмнөх өдөр) */
const ub = (day: number, hour: number) =>
  new Date(Date.UTC(2026, 8, day, hour - 8 < 0 ? hour + 16 : hour - 8, 0, 0));

test("publishHours: env-ээс уншина, буруу утгыг шүүнэ", () => {
  assert.deepEqual(publishHours({}), DEFAULT_PUBLISH_HOURS);
  assert.deepEqual(publishHours({ PUBLISH_HOURS_UB: "7,15,19" }), [7, 15, 19]);
  assert.deepEqual(publishHours({ PUBLISH_HOURS_UB: "19, 7 ,15" }), [7, 15, 19]);   // эрэмбэлнэ
  assert.deepEqual(publishHours({ PUBLISH_HOURS_UB: "8,8,12" }), [8, 12]);          // давхардлыг хасна
  assert.deepEqual(publishHours({ PUBLISH_HOURS_UB: "25,-1,хоёр" }), DEFAULT_PUBLISH_HOURS);
  assert.deepEqual(publishHours({ PUBLISH_HOURS_UB: "" }), DEFAULT_PUBLISH_HOURS);
  assert.deepEqual(publishHours({ PUBLISH_HOURS_UB: "0" }), [0]);
});

test("dailyHour: өдөрт нэг удаагийн алхмуудын цаг", () => {
  assert.equal(dailyHour({}), DEFAULT_DAILY_HOUR);
  assert.equal(dailyHour({ DAILY_HOUR_UB: "5" }), 5);
  assert.equal(dailyHour({ DAILY_HOUR_UB: "24" }), DEFAULT_DAILY_HOUR);
});

test("modeFor: нийтлэх цагт publish, бусад цагт prepare", () => {
  for (const h of [7, 15, 19]) assert.equal(modeFor(ub(24, h)), "publish", `УБ ${h}:00`);
  for (const h of [0, 3, 6, 8, 14, 16, 18, 20, 23]) {
    assert.equal(modeFor(ub(24, h)), "prepare", `УБ ${h}:00`);
  }
  // Өөр хуваарьтай
  assert.equal(modeFor(ub(24, 9), [9, 21]), "publish");
  assert.equal(modeFor(ub(24, 7), [9, 21]), "prepare");
});

test("nextPublishAt: дараагийн цаг ба үлдсэн хугацаа", () => {
  // УБ 08:10 → дараагийнх 15:00, 6ц 50м
  const at0810 = new Date(ub(24, 8).getTime() + 10 * 60_000);
  const next = nextPublishAt(at0810);
  assert.equal(next.hour, 15);
  assert.equal(next.minutes, 410);
  assert.equal(humanDelay(next.minutes), "6ц 50м");

  // Яг нийтлэх цагт байхад дараагийнх нь дараагийн slot
  assert.equal(nextPublishAt(ub(24, 15)).hour, 19);

  // Сүүлийн slot өнгөрсөн бол маргаашийн эхнийх
  const late = nextPublishAt(ub(24, 22));
  assert.equal(late.hour, 7);
  assert.equal(late.minutes, 9 * 60);
  assert.ok(late.at.getTime() > ub(24, 22).getTime());
});

test("humanDelay / hourLabel", () => {
  assert.equal(humanDelay(5), "5м");
  assert.equal(humanDelay(59), "59м");
  assert.equal(humanDelay(60), "1ц");
  assert.equal(humanDelay(130), "2ц 10м");
  assert.equal(hourLabel(7), "07:00");
  assert.equal(hourLabel(19), "19:00");
});
