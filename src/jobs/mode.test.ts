import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DAILY_HOUR, DEFAULT_PUBLISH_TIMES, dailyHour, humanDelay, modeFor, nextPublishAt,
  parseTimes, publishTimes, SLOT_WINDOW_MIN, timeLabel, timeSlotAt,
} from "./mode.api";

/** УБ = UTC+8: УБ 07:30 = UTC 23:30 (өмнөх өдөр) */
const ub = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 8, day, hour - 8 < 0 ? hour + 16 : hour - 8, minute, 0));

const T = (hour: number, minute = 0) => ({ hour, minute });

test("parseTimes: минуттай ба минутгүй хэлбэр, буруу утгыг шүүнэ", () => {
  assert.deepEqual(parseTimes("7:30,12:30,19:30"), [T(7, 30), T(12, 30), T(19, 30)]);
  assert.deepEqual(parseTimes("19:30, 7:30 ,12:30"), [T(7, 30), T(12, 30), T(19, 30)]); // эрэмбэлнэ
  assert.deepEqual(parseTimes("7,15,19"), [T(7), T(15), T(19)], "минутгүй = :00");
  assert.deepEqual(parseTimes("8:00,8:00,12:30"), [T(8), T(12, 30)], "давхардлыг хасна");
  assert.deepEqual(parseTimes("25:00,-1:00,7:60,хоёр"), []);
  assert.deepEqual(parseTimes(""), []);
  assert.deepEqual(parseTimes("0:05"), [T(0, 5)]);
});

test("publishTimes: PUBLISH_TIMES_UB давуу, хуучин PUBLISH_HOURS_UB-ийг хүндэтгэнэ", () => {
  assert.deepEqual(publishTimes({}), DEFAULT_PUBLISH_TIMES);
  assert.deepEqual(publishTimes({ PUBLISH_TIMES_UB: "8:30,20:00" }), [T(8, 30), T(20)]);
  // Хуучин тохиргоотой deploy өөрөө өөрчлөгдөхгүй
  assert.deepEqual(publishTimes({ PUBLISH_HOURS_UB: "7,15,19" }), [T(7), T(15), T(19)]);
  // Шинэ нь байвал хуучныг үл хэрэгснэ
  assert.deepEqual(
    publishTimes({ PUBLISH_TIMES_UB: "9:30", PUBLISH_HOURS_UB: "7,15,19" }),
    [T(9, 30)],
  );
  assert.deepEqual(publishTimes({ PUBLISH_TIMES_UB: "буруу" }), DEFAULT_PUBLISH_TIMES);
});

test("анхдагч цаг нь УБ-ын идэвхтэй 3 үе", () => {
  assert.deepEqual(DEFAULT_PUBLISH_TIMES, [T(7, 30), T(12, 30), T(19, 30)]);
  assert.equal(SLOT_WINDOW_MIN, 30, "cron 0,30 * * * * — цонх 30 минут");
});

test("dailyHour: өдөрт нэг удаагийн алхмуудын цаг", () => {
  assert.equal(dailyHour({}), DEFAULT_DAILY_HOUR);
  assert.equal(dailyHour({ DAILY_HOUR_UB: "5" }), 5);
  assert.equal(dailyHour({ DAILY_HOUR_UB: "24" }), DEFAULT_DAILY_HOUR);
});

test("modeFor: 30 минутын цонх — cron яг минутад ажиллахгүй байж болно", () => {
  // 07:30 slot нь 07:30–07:59-д ажиллана
  assert.equal(modeFor(ub(24, 7, 30)), "publish");
  assert.equal(modeFor(ub(24, 7, 45)), "publish", "cron 15 мин саатсан");
  assert.equal(modeFor(ub(24, 7, 59)), "publish");
  // 07:00-д БИШ — тэр нь өмнөх хагас
  assert.equal(modeFor(ub(24, 7, 0)), "prepare");
  assert.equal(modeFor(ub(24, 7, 29)), "prepare");
  assert.equal(modeFor(ub(24, 8, 0)), "prepare");

  for (const [h, m] of [[12, 30], [19, 30]] as const) {
    assert.equal(modeFor(ub(24, h, m)), "publish", `УБ ${h}:${m}`);
  }
  for (const [h, m] of [[0, 0], [3, 30], [9, 0], [15, 30], [23, 0]] as const) {
    assert.equal(modeFor(ub(24, h, m)), "prepare", `УБ ${h}:${m}`);
  }

  // Өөр хуваарьтай
  assert.equal(modeFor(ub(24, 9, 0), [T(9), T(21)]), "publish");
  assert.equal(modeFor(ub(24, 7, 30), [T(9), T(21)]), "prepare");
});

test("timeSlotAt: аль цагийн slot болохыг буцаана", () => {
  assert.deepEqual(timeSlotAt(ub(24, 12, 40)), T(12, 30));
  assert.equal(timeSlotAt(ub(24, 12, 10)), null);
});

test("nextPublishAt: дараагийн цаг ба үлдсэн хугацаа", () => {
  // УБ 08:10 → дараагийнх 12:30, 4ц 20м
  const next = nextPublishAt(ub(24, 8, 10));
  assert.deepEqual(next.time, T(12, 30));
  assert.equal(next.minutes, 260);
  assert.equal(humanDelay(next.minutes), "4ц 20м");

  // Яг нийтлэх цагт байхад дараагийнх нь дараагийн slot
  assert.deepEqual(nextPublishAt(ub(24, 12, 30)).time, T(19, 30));

  // Сүүлийн slot өнгөрсөн бол маргаашийн эхнийх
  const late = nextPublishAt(ub(24, 22, 0));
  assert.deepEqual(late.time, T(7, 30));
  assert.equal(late.minutes, 9 * 60 + 30);
  assert.ok(late.at.getTime() > ub(24, 22).getTime());
});

test("humanDelay / timeLabel", () => {
  assert.equal(humanDelay(5), "5м");
  assert.equal(humanDelay(59), "59м");
  assert.equal(humanDelay(60), "1ц");
  assert.equal(humanDelay(130), "2ц 10м");
  assert.equal(timeLabel(T(7, 30)), "07:30");
  assert.equal(timeLabel(T(19, 0)), "19:00");
  assert.equal(timeLabel(T(0, 5)), "00:05");
});
