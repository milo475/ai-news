import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cappedTotal, dailyLlmBudget, DEFAULT_DAILY_LLM_USD, limitMessage, LLM_STEPS, nearDailyLimit,
  isLocalDb, overDailyLimit, sortSteps, stepLabel, UNCAPPED_STEPS, unrecorded, USAGE_LABEL,
  WARN_RATIO, type StepCost,
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

// ---------- Бенчмарк өдрийн хязгаарт орохгүй ----------

test("бенчмарк өдрийн хязгаараас чөлөөтэй", () => {
  assert.ok(UNCAPPED_STEPS.has("bench"));
  // Бусад LLM алхмууд хязгаарт ОРНО
  for (const j of ["agent", "improve", "digest", "studio", "publish", "local"]) {
    assert.ok(!UNCAPPED_STEPS.has(j), j);
  }
});

test("10/1: bench $4.20 зарцуулсан ч мэдээний алхмууд ажиллана", () => {
  // Бодит 10/1-ний хувилбар: bench $4.20, мэдээний алхмууд $0.60
  const steps = [
    step("bench", 4.2, 6),
    step("agent", 0.35, 3),
    step("improve", 0.2, 3),
    step("publish", 0.05, 3),
  ];
  const capped = cappedTotal(steps);

  assert.equal(Number(capped.toFixed(2)), 0.6, "бенчмарк хязгаарын тооцоонд орохгүй");
  assert.equal(overDailyLimit(capped, 2.5), false, "agent, improve зогсох ёсгүй");
  assert.equal(limitMessage(capped, 2.5), null);

  // Хэрэв бенчмаркийг оруулбал хязгаар давж, мэдээний бэлтгэл зогсоно
  const naive = steps.reduce((n, s) => n + s.usd, 0);
  assert.equal(overDailyLimit(naive, 2.5), true, "хуучин зан төлөв — яг үүнийг зассан");
});

test("бенчмаркгүй өдөр хоёр тоо ижил", () => {
  const steps = [step("agent", 1.0), step("improve", 0.5)];
  assert.equal(cappedTotal(steps), steps.reduce((n, s) => n + s.usd, 0));
});

test("мэдээний алхмууд өөрсдөө хязгаарт хүрвэл зогсоно", () => {
  const steps = [step("bench", 4.2), step("agent", 2.0), step("improve", 0.6)];
  assert.equal(Number(cappedTotal(steps).toFixed(2)), 2.6);
  assert.equal(overDailyLimit(cappedTotal(steps), 2.5), true);
});

// ---------- Харьцуулалтын цонх ба шошго ----------

test("OpenRouter-ийн цонхыг зөв нэрлэнэ (баримтаас шалгасан)", () => {
  // usage_daily = одоогийн UTC ӨДӨР; usage_weekly = UTC долоо хоног, ДАВААГААС
  assert.match(USAGE_LABEL.daily, /UTC/);
  assert.match(USAGE_LABEL.weekly, /даваагаас/);
  assert.match(USAGE_LABEL.weekly, /UTC/);
  assert.match(USAGE_LABEL.monthly, /UTC/);
  // «7 хоног» гэж нэрлэхгүй — тэр нь гүйдэг цонх гэсэн буруу ойлголт өгнө
  assert.ok(!USAGE_LABEL.weekly.includes("7 хоног"));
});

test("локал DB-г таньж харьцуулалт хийхгүй", () => {
  assert.equal(isLocalDb("postgresql://u:p@localhost:5432/db"), true);
  assert.equal(isLocalDb("postgresql://u:p@127.0.0.1:5432/db"), true);
  assert.equal(isLocalDb("postgres://u:p@[::1]:5432/db"), true);
  assert.equal(isLocalDb("file:./dev.db"), true);
  // Production
  assert.equal(isLocalDb("postgresql://u:p@containers.railway.app:1234/railway"), false);
  assert.equal(isLocalDb(""), false);
});
