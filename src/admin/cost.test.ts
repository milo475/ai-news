import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailyLlmBudget, DEFAULT_DAILY_LLM_USD, limitMessage, LLM_STEPS, nearDailyLimit,
  overDailyLimit, sortSteps, stepLabel, unrecorded, WARN_RATIO, type StepCost,
} from "./cost.api";

const step = (job: string, usd: number, runs = 1): StepCost => ({
  job, label: stepLabel(job), usd, runs, llm: LLM_STEPS.has(job),
});

test("алхам бүрд монгол нэр", () => {
  assert.equal(stepLabel("agent"), "Мэдээ боловсруулах");
  assert.equal(stepLabel("studio"), "Промпт студи");
  // Танихгүй алхмыг нэрээр нь харуулна
  assert.equal(stepLabel("шинэ"), "шинэ");
});

test("LLM зарцуулдаг алхмууд тодорхой", () => {
  for (const j of ["agent", "improve", "publish", "digest", "bench", "studio"]) {
    assert.ok(LLM_STEPS.has(j), j);
  }
  for (const j of ["rss", "insights", "fbstats", "newsletter"]) {
    assert.ok(!LLM_STEPS.has(j), j);
  }
});

test("зардлаар буурахаар эрэмбэлнэ", () => {
  const sorted = sortSteps([step("rss", 0), step("agent", 0.5), step("improve", 1.2)]);
  assert.deepEqual(sorted.map((s) => s.job), ["improve", "agent", "rss"]);
});

test("бүртгэгдээгүй LLM алхмыг илрүүлнэ", () => {
  // Ажилласан ч $0 — бүртгэл дутуу
  assert.deepEqual(unrecorded([step("agent", 0, 3), step("improve", 1.2)]), ["agent"]);
  // LLM-гүй алхам $0 байх нь ХЭВИЙН
  assert.deepEqual(unrecorded([step("rss", 0, 5)]), []);
  // Ажиллаагүй алхмыг буруутгахгүй
  assert.deepEqual(unrecorded([step("digest", 0, 0)]), []);
});

test("өдрийн хязгаар — DAILY_LLM_USD, анхдагч $2.5", () => {
  assert.equal(DEFAULT_DAILY_LLM_USD, 2.5);
  assert.equal(dailyLlmBudget({} as unknown as NodeJS.ProcessEnv), 2.5);
  assert.equal(dailyLlmBudget({ DAILY_LLM_USD: "5" } as unknown as NodeJS.ProcessEnv), 5);
  assert.equal(dailyLlmBudget({ DAILY_LLM_USD: "муу" } as unknown as NodeJS.ProcessEnv), 2.5);
  assert.equal(dailyLlmBudget({ DAILY_LLM_USD: "-1" } as unknown as NodeJS.ProcessEnv), 2.5);
});

test("хязгаарт хүрэх, ойртохыг ялгана", () => {
  assert.equal(overDailyLimit(2.49, 2.5), false);
  assert.equal(overDailyLimit(2.5, 2.5), true);
  assert.equal(nearDailyLimit(2.0, 2.5), true, `${WARN_RATIO} × 2.5 = 2.0`);
  assert.equal(nearDailyLimit(1.9, 2.5), false);
  // Хязгаар давсныг «ойрхон» гэж хэлэхгүй
  assert.equal(nearDailyLimit(3, 2.5), false);
});

test("мессеж зөвхөн шаардлагатай үед", () => {
  assert.equal(limitMessage(0.5, 2.5), null);
  assert.match(limitMessage(2.1, 2.5)!, /хязгаарт ойрхон/);
  assert.match(limitMessage(2.6, 2.5)!, /дүүрлээ/);
  assert.match(limitMessage(2.6, 2.5)!, /нийтлэхээс бусад LLM алхам зогсоно/);
});
