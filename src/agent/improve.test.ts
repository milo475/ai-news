import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkImproved, DEFAULT_READY_TARGET, IMAGE_AHEAD, MAX_TITLE_CHARS, readyTarget, trimTitle,
} from "./improve.api";
import { agentBatch, agentDailyBudget, budgetExhausted, DEFAULT_AGENT_BATCH, DEFAULT_AGENT_DAILY_BUDGET } from "./budget.api";

const BODY = "Нэг догол мөр. ".repeat(30);
const before = { titleMn: "Урт гарчиг", bodyMn: BODY };
const ok = {
  titleMn: "Богино гарчиг",
  summaryMn: "Хураангуй.",
  bodyMn: BODY,
  changed: ["гарчиг богиносгов"],
};

test("checkImproved: зөв засварыг хүлээж авна", () => {
  assert.deepEqual(checkImproved(before, ok), { ok: true, problems: [] });
});

test("checkImproved: хоосон, урт гарчиг, хэт богиносгосон биетийг татгалзана", () => {
  const codes = (over: Partial<typeof ok>) => checkImproved(before, { ...ok, ...over }).problems.join(" ");

  assert.match(codes({ titleMn: "  " }), /гарчиг хоосон/);
  assert.match(codes({ titleMn: "Х".repeat(MAX_TITLE_CHARS + 1) }), /гарчиг \d+ тэмдэгт/);
  assert.match(codes({ bodyMn: "" }), /биет хоосон/);
  assert.match(codes({ bodyMn: BODY.slice(0, Math.floor(BODY.length * 0.5)) }), /хэт богиносгосон/);
  assert.match(codes({ summaryMn: "" }), /хураангуй хоосон/);
  assert.equal(checkImproved(before, { ...ok, bodyMn: BODY.slice(0, Math.floor(BODY.length * 0.8)) }).ok, true);
});

test("trimTitle: 60 тэмдэгтээс уртыг үгээр нь таслана", () => {
  assert.equal(trimTitle("Богино гарчиг"), "Богино гарчиг");
  const long = "Google компани хиймэл оюуны шинэ модель танилцуулж зах зээлд гаргалаа";
  const cut = trimTitle(long);
  assert.ok(cut.length <= MAX_TITLE_CHARS, `${cut.length}`);
  assert.ok(long.startsWith(cut), "эхлэлээ хадгална");
  assert.ok(!cut.endsWith(" "), "хоосон зайгаар дуусахгүй");
  assert.equal(trimTitle("  Зай   олонтой  гарчиг "), "Зай олонтой гарчиг");
});

test("readyTarget: анхдагч 3, зургийг дараагийн 2 slot-д", () => {
  assert.equal(readyTarget({}), DEFAULT_READY_TARGET);
  assert.equal(DEFAULT_READY_TARGET, 3);
  assert.equal(readyTarget({ PREPARE_READY_TARGET: "5" }), 5);
  assert.equal(readyTarget({ PREPARE_READY_TARGET: "0" }), 0);
  assert.equal(readyTarget({ PREPARE_READY_TARGET: "гурав" }), DEFAULT_READY_TARGET);
  assert.equal(IMAGE_AHEAD, 2);
});

test("agentBatch / agentDailyBudget / budgetExhausted", () => {
  assert.equal(agentBatch({}), DEFAULT_AGENT_BATCH);
  assert.equal(agentBatch({}), 8);
  assert.equal(agentBatch({ AGENT_BATCH: "12" }), 12);
  assert.equal(agentBatch({ AGENT_BATCH: "0" }), 0);
  assert.equal(agentBatch({ AGENT_BATCH: "найм" }), DEFAULT_AGENT_BATCH);

  assert.equal(agentDailyBudget({}), DEFAULT_AGENT_DAILY_BUDGET);
  assert.equal(agentDailyBudget({}), 1.5);
  assert.equal(agentDailyBudget({ AGENT_DAILY_BUDGET_USD: "0.5" }), 0.5);
  assert.equal(agentDailyBudget({ AGENT_DAILY_BUDGET_USD: "0" }), 0);

  assert.equal(budgetExhausted(1.4, 1.5), false);
  assert.equal(budgetExhausted(1.5, 1.5), true);
  assert.equal(budgetExhausted(9, 0), false, "0 = хязгааргүй");
});
