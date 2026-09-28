import assert from "node:assert/strict";
import test from "node:test";
import {
  aspectFor, dailyBudget, dailyLimit, defaultTools, detectFormat, limitLeft, STUDIO_MIN_USD,
  placementById, studioOff, subjectsOf, toolById, toolsFor, usedOf, withinBudget,
} from "./studio.api";

test("хүсэлтээс хэлбэрийг таана", () => {
  assert.equal(detectFormat("албаны шинэ жилийн мэндчилгээ видео хийе"), "VIDEO");
  assert.equal(detectFormat("Facebook-д тавих зар зураг хэрэгтэй"), "IMAGE");
  assert.equal(detectFormat("Reels бичлэг"), "VIDEO");
  assert.equal(detectFormat("танилцуулга слайд бэлдье"), "SLIDES");
  assert.equal(detectFormat("дэлгүүрийн зард хөгжим хэрэгтэй"), "AUDIO");
  assert.equal(detectFormat("харилцагчид илгээх и-мэйл бичвэр"), "TEXT");
});

test("видео нь зурагтай хамт дурдагдвал видео", () => {
  // Видео нь зураг, дуу, бичвэрийг агуулдаг тул давуу
  assert.equal(detectFormat("зурагнуудаасаа видео хийе"), "VIDEO");
});

test("таних дохио байхгүй бол null — хэрэглэгчээс асууна", () => {
  assert.equal(detectFormat("сайн байна уу"), null);
});

test("хаагдсан хэрэгслийг санал болгохгүй", () => {
  const video = toolsFor("VIDEO").map((t) => t.id);
  assert.ok(!video.includes("sora"), "Sora 2026 онд хаагдсан");
  assert.ok(video.includes("kling"));
  assert.equal(toolById("sora")?.retired, true);
});

test("анхдагч сонголт үнэгүй хэрэгсэл + угсралт", () => {
  const ids = defaultTools("VIDEO");
  assert.ok(ids.includes("capcut"), "видеонд угсралтын хэрэгсэл заавал");
  for (const id of ids) assert.equal(toolById(id)?.retired, undefined);
  assert.ok(ids.filter((id) => !toolById(id)!.assembly).every((id) => toolById(id)!.free));
});

test("хэрэгсэл бүрийн doc нэр давхардахгүй", () => {
  const docs = toolsFor("IMAGE").concat(toolsFor("VIDEO")).map((t) => t.doc);
  assert.equal(new Set(docs).size, docs.length);
});

test("байршлаас харьцаа", () => {
  assert.equal(aspectFor("VIDEO", "reels"), "9:16");
  assert.equal(aspectFor("IMAGE", "fb-post"), "4:5");
  // Байршил сонгоогүй бол хэлбэрийн анхдагч
  assert.equal(aspectFor("IMAGE", null), "4:5");
  assert.equal(aspectFor("VIDEO", "байхгүй"), "9:16");
  assert.equal(placementById(null), null);
});

test("өдрийн хязгаар — нэвтэрсэн 10, нэвтрээгүй 2", () => {
  assert.equal(dailyLimit(false), 2);
  assert.equal(dailyLimit(true), 10);
  assert.equal(limitLeft(2, false), 0);
  assert.equal(limitLeft(2, true), 8);
  assert.equal(limitLeft(99, true), 0);
});

test("subject-үүд: нэвтэрсэн бол userId нэмэгдэнэ", () => {
  assert.deepEqual(subjectsOf({ anonId: "a1", ip: "1.2.3.4" }), ["a:a1", "ip:1.2.3.4"]);
  assert.deepEqual(subjectsOf({ userId: "u1", anonId: "a1", ip: "1.2.3.4" }), [
    "u:u1", "a:a1", "ip:1.2.3.4",
  ]);
});

test("хамгийн их тоогоор хязгаарлана — cookie цэвэрлэж тойрохгүй", () => {
  assert.equal(usedOf([0, 5, 2]), 5);
  assert.equal(usedOf([]), 0);
});

test("төсөв — STUDIO_DAILY_USD, анхдагч 0.5", () => {
  assert.equal(dailyBudget({} as unknown as NodeJS.ProcessEnv), 0.5);
  assert.equal(dailyBudget({ STUDIO_DAILY_USD: "2" } as unknown as NodeJS.ProcessEnv), 2);
  assert.equal(dailyBudget({ STUDIO_DAILY_USD: "муу" } as unknown as NodeJS.ProcessEnv), 0.5);
  assert.equal(dailyBudget({ STUDIO_DAILY_USD: "-1" } as unknown as NodeJS.ProcessEnv), 0.5);
  assert.equal(withinBudget(0.49, 0.5), true);
  assert.equal(withinBudget(0.5, 0.5), false);
});

test("үлдэгдэл бага бол студи түрүүлж унтарна", () => {
  const env = {} as unknown as NodeJS.ProcessEnv;
  assert.equal(studioOff({ env, spentUsd: 0, balanceUsd: STUDIO_MIN_USD - 0.01 }), "balance");
  assert.equal(studioOff({ env, spentUsd: 0, balanceUsd: 10 }), null);
  // Үлдэгдэл мэдэгдэхгүй (null) бол студи хаагдахгүй — «мэдэхгүй» ≠ «дууссан»
  assert.equal(studioOff({ env, spentUsd: 0, balanceUsd: null }), null);
  assert.equal(studioOff({ env, spentUsd: 1, balanceUsd: 10 }), "budget");
  assert.equal(studioOff({ env: { STUDIO_OFF: "true" } as unknown as NodeJS.ProcessEnv, spentUsd: 0 }), "flag");
});
