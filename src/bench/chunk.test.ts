import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canStartChunk, CHUNK_MS, isStale, MAX_RUN_DAYS, nearPublishWindow, outOfTime, pairKey,
  pendingPairs, progressLabel, progressOf, PUBLISH_GUARD_MS, timeLeft,
} from "./chunk.api";

const T0 = new Date("2026-10-01T19:00:00Z"); // УБ 03:00
const plus = (min: number) => new Date(T0.getTime() + min * 60_000);

test("нэг хэсэг 20 минут", () => {
  assert.equal(CHUNK_MS, 20 * 60_000);
  assert.equal(outOfTime(T0, plus(19)), false);
  assert.equal(outOfTime(T0, plus(20)), true);
  assert.equal(outOfTime(T0, plus(25)), true);
  assert.equal(timeLeft(T0, plus(5)), 15 * 60_000);
  assert.equal(timeLeft(T0, plus(30)), 0, "сөрөг болохгүй");
});

test("НИЙТЛЭХ цонхны 45 минутын дотор шинэ хэсэг эхлүүлэхгүй", () => {
  assert.equal(PUBLISH_GUARD_MS, 45 * 60_000);
  assert.equal(nearPublishWindow(44), true);
  assert.equal(nearPublishWindow(45), false);
  assert.equal(nearPublishWindow(120), false);
  // 20 минутын ажил нь 45 минутын зайд багтана
  assert.ok(PUBLISH_GUARD_MS > CHUNK_MS, "хамгаалалт хэсгээс урт байх ёстой");
});

test("3 хоногт дуусаагүй run хуучирна", () => {
  assert.equal(MAX_RUN_DAYS, 3);
  assert.equal(isStale(T0, plus(60 * 24 * 3)), false, "яг 3 хоног бол хэвээр");
  assert.equal(isStale(T0, plus(60 * 24 * 3 + 1)), true);
});

// ---------- Дутуу хосууд ----------

const MODELS = ["a/1", "b/2"];
const TASKS = ["t1", "t2", "t3"];

test("хийгдээгүй хосуудыг МОДЕЛИОР эрэмбэлж гаргана", () => {
  const pairs = pendingPairs(MODELS, TASKS, new Set());
  assert.equal(pairs.length, 6);
  // Нэг моделийг дуусгаад дараагийнх руу — тасрахад бүтэн модель олон байна
  assert.deepEqual(pairs.slice(0, 3).map((p) => p.modelSlug), ["a/1", "a/1", "a/1"]);
  assert.deepEqual(pairs.map((p) => p.taskId).slice(0, 3), TASKS);
});

test("хийгдсэн хосыг алгасна — үргэлжлэх цэг", () => {
  const done = new Set([pairKey("a/1", "t1"), pairKey("a/1", "t2"), pairKey("b/2", "t1")]);
  const pairs = pendingPairs(MODELS, TASKS, done);
  assert.deepEqual(
    pairs.map((p) => `${p.modelSlug}/${p.taskId}`),
    ["a/1/t3", "b/2/t2", "b/2/t3"],
  );
});

test("бүгд хийгдсэн бол хоосон", () => {
  const done = new Set(MODELS.flatMap((m) => TASKS.map((t) => pairKey(m, t))));
  assert.deepEqual(pendingPairs(MODELS, TASKS, done), []);
});

test("явцын тоо", () => {
  const p = progressOf(510, 120);
  assert.deepEqual(p, { total: 510, done: 120, left: 390, percent: 24 });
  assert.match(progressLabel(p), /120\/510 \(24%\), үлдсэн 390/);
  assert.equal(progressOf(0, 0).percent, 100);
});

// ---------- Хэсэг эхлүүлэх шийдвэр ----------

const GATE = { runStartedAt: null, now: T0, minutesToPublish: 270, balanceUsd: 13, needUsd: 6.3 };

test("бүх нөхцөл таарвал эхэлнэ", () => {
  const g = canStartChunk(GATE);
  assert.equal(g.go, true);
  assert.equal(g.block, null);
});

test("НИЙТЛЭХ цонх ойрхон бол эхлүүлэхгүй", () => {
  const g = canStartChunk({ ...GATE, minutesToPublish: 30 });
  assert.equal(g.go, false);
  assert.equal(g.block, "publish-window");
  assert.match(g.reason, /30 минутын дараа/);
});

test("үлдэгдэл хүрэхгүй бол эхлүүлэхгүй", () => {
  const g = canStartChunk({ ...GATE, balanceUsd: 2 });
  assert.equal(g.go, false);
  assert.equal(g.block, "balance");
  assert.match(g.reason, /\$2\.00 < шаардлага \$6\.30/);
});

test("үлдэгдэл мэдэгдэхгүй бол зогсоохгүй", () => {
  assert.equal(canStartChunk({ ...GATE, balanceUsd: null }).go, true);
});

test("хуучирсан run хамгийн түрүүнд илрэнэ", () => {
  const g = canStartChunk({
    ...GATE,
    runStartedAt: new Date(T0.getTime() - 4 * 86_400_000),
    // Нийтлэх цонх ойрхон БА үлдэгдэл бага ч гэсэн «stale» түрүүлнэ
    minutesToPublish: 10,
    balanceUsd: 0,
  });
  assert.equal(g.go, false);
  assert.equal(g.block, "stale");
  assert.match(g.reason, /3 хоногт дуусаагүй/);
});

test("хэсэг бүр дор хаяж нэг алхам урагшилна", () => {
  // chunkMs=0 байсан ч эхний хос гүйцэтгэгдэнэ (run.ts дахь `pi > 0` шалгалт).
  // Энд зөвхөн outOfTime-ийн зан төлөвийг баримтжуулна.
  assert.equal(outOfTime(T0, T0, 0), true, "хугацаа 0 бол шууд дууссан гэж үзнэ");
  assert.equal(outOfTime(T0, T0, CHUNK_MS), false);
});
