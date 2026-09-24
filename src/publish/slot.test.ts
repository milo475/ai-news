import { test } from "node:test";
import assert from "node:assert/strict";
import { RANKING_WEEKDAYS, slotOf, slotPlan, ubHour, ubWeekday, upcomingSlots } from "./slot.api";

/** Cron: 0 1,5,11 * * * UTC = УБ 09:00, 13:00, 19:00 */
const MORNING = new Date("2026-09-23T01:00:00Z"); // Лхагва, УБ 09:00
const NOON = new Date("2026-09-23T05:00:00Z");    // Лхагва, УБ 13:00
const EVENING = new Date("2026-09-23T11:00:00Z"); // Лхагва, УБ 19:00

test("ubHour / ubWeekday: УБ = UTC+8", () => {
  assert.equal(ubHour(MORNING), 9);
  assert.equal(ubHour(NOON), 13);
  assert.equal(ubHour(EVENING), 19);
  assert.equal(ubWeekday(MORNING), 3); // Лхагва
  // UTC-ээр Ням боловч УБ-д Даваа болсон агшин
  assert.equal(ubWeekday(new Date("2026-09-20T17:00:00Z")), 1);
});

test("slotOf: цагийн мужаар — cron саатсан ч зөв slot", () => {
  assert.equal(slotOf(MORNING), "morning");
  assert.equal(slotOf(NOON), "noon");
  assert.equal(slotOf(EVENING), "evening");
  // Мужийн хил: УБ 10:59 → өглөө, 11:00 → өдөр, 15:59 → өдөр, 16:00 → орой
  assert.equal(slotOf(new Date("2026-09-23T02:59:00Z")), "morning");
  assert.equal(slotOf(new Date("2026-09-23T03:00:00Z")), "noon");
  assert.equal(slotOf(new Date("2026-09-23T07:59:00Z")), "noon");
  assert.equal(slotOf(new Date("2026-09-23T08:00:00Z")), "evening");
});

test("slotPlan: slot бүрийн ангилал", () => {
  assert.deepEqual(slotPlan(MORNING).categories, ["NEWS", "RISK"]);
  assert.deepEqual(slotPlan(NOON).categories, ["FACT", "BUSINESS"]);
  assert.deepEqual(slotPlan(EVENING).categories, ["PROJECT", "HOWTO", "BUSINESS"]);
});

test("slotPlan: жагсаалтын карт зөвхөн өдрийн slot дээр, Мя/Пү/Ням гаригт", () => {
  assert.deepEqual(RANKING_WEEKDAYS, [2, 4, 0]);

  // 2026-09-22 Мягмар, УБ 13:00 = UTC 2026-09-22T05:00
  assert.equal(slotPlan(new Date("2026-09-22T05:00:00Z")).ranking, true);
  // 2026-09-24 Пүрэв
  assert.equal(slotPlan(new Date("2026-09-24T05:00:00Z")).ranking, true);
  // 2026-09-27 Ням
  assert.equal(slotPlan(new Date("2026-09-27T05:00:00Z")).ranking, true);

  // Лхагва — карт байхгүй
  assert.equal(slotPlan(NOON).ranking, false);
  // Мягмар боловч өглөө/орой — карт байхгүй
  assert.equal(slotPlan(new Date("2026-09-22T01:00:00Z")).ranking, false);
  assert.equal(slotPlan(new Date("2026-09-22T11:00:00Z")).ranking, false);
});

test("upcomingSlots: дараагийн slot-уудын ангилал (БЭЛТГЭХ горимд)", () => {
  const HOURS = [7, 15, 19];

  // Лхагва УБ 09:00 (UTC 01:00) → дараагийнх нь 15:00, 19:00, дараа өдрийн 07:00
  const next3 = upcomingSlots(new Date("2026-09-23T01:00:00Z"), 3, HOURS);
  assert.deepEqual(next3.map((s) => s.hour), [15, 19, 7]);
  assert.deepEqual(next3.map((s) => s.slot), ["noon", "evening", "morning"]);
  assert.deepEqual(next3[0]!.categories, ["FACT", "BUSINESS"]);
  assert.deepEqual(next3[1]!.categories, ["PROJECT", "HOWTO", "BUSINESS"]);
  assert.deepEqual(next3[2]!.categories, ["NEWS", "RISK"]);

  // Жагсаалтын картын slot-д нийтлэл хэрэггүй тул алгасагдана.
  // Мягмар (2026-09-22) УБ 09:00 → 15:00 нь картынх → 19:00, дараа Лхагва 07:00, 15:00
  const skipsCard = upcomingSlots(new Date("2026-09-22T01:00:00Z"), 3, HOURS);
  assert.deepEqual(skipsCard.map((s) => s.hour), [19, 7, 15]);
  assert.ok(skipsCard.every((s) => !s.ranking));

  assert.deepEqual(upcomingSlots(new Date("2026-09-23T01:00:00Z"), 0, HOURS), []);
});
