import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIVERSE_CATEGORIES, HIGH_WEIGHT_MIN, mixRawBatch, splitSizes, STALE_RAW_DAYS, staleBefore,
} from "./raw.api";

const item = (id: string) => ({ id });
const items = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => item(`${prefix}${i + 1}`));

test("splitSizes: багцыг тэнцүү хувааж, сондгойг өндөр жинтэйд өгнө", () => {
  assert.deepEqual(splitSizes(30), { high: 15, diverse: 15 });
  assert.deepEqual(splitSizes(5), { high: 3, diverse: 2 });
  assert.deepEqual(splitSizes(1), { high: 1, diverse: 0 });
});

test("mixRawBatch: 30-аас 15 нь өндөр жинтэй, 15 нь олон талт бүлгээс", () => {
  const mixed = mixRawBatch(items("h", 40), items("d", 40), 30);
  assert.equal(mixed.length, 30);
  assert.equal(mixed.filter((x) => x.id.startsWith("h")).length, 15);
  assert.equal(mixed.filter((x) => x.id.startsWith("d")).length, 15);
  // Бүлэг дотроо ирсэн дараалал хэвээр (DB-ээс publishedAtSource desc-ээр ирнэ)
  assert.deepEqual(mixed.slice(0, 3).map((x) => x.id), ["h1", "h2", "h3"]);
});

test("mixRawBatch: нэг бүлэг хүрэлцэхгүй бол нөгөөгөөр нөхнө", () => {
  const fewDiverse = mixRawBatch(items("h", 40), items("d", 4), 30);
  assert.equal(fewDiverse.length, 30);
  assert.equal(fewDiverse.filter((x) => x.id.startsWith("d")).length, 4);
  assert.equal(fewDiverse.filter((x) => x.id.startsWith("h")).length, 26);

  const fewHigh = mixRawBatch(items("h", 2), items("d", 40), 30);
  assert.equal(fewHigh.length, 30);
  assert.equal(fewHigh.filter((x) => x.id.startsWith("h")).length, 2);

  // Хоёулаа цөөн бол байгаа нь л ирнэ
  assert.equal(mixRawBatch(items("h", 3), items("d", 2), 30).length, 5);
  assert.deepEqual(mixRawBatch([], [], 30), []);
  assert.deepEqual(mixRawBatch(items("h", 5), items("d", 5), 0), []);
});

test("mixRawBatch: хоёр бүлэгт давхар орсон нийтлэлийг нэг л удаа авна", () => {
  // Hugging Face: жин 8 БӨГӨӨД defaultCategory = PROJECT — хоёр query-д хоёуланд нь ирнэ
  const shared = [item("hf1"), item("hf2")];
  const mixed = mixRawBatch([...shared, ...items("h", 10)], [...shared, ...items("d", 10)], 6);
  assert.equal(mixed.length, 6);
  assert.equal(new Set(mixed.map((x) => x.id)).size, 6, "давхардсан id алга");
});

test("staleBefore: 7 хоногийн хил", () => {
  assert.equal(STALE_RAW_DAYS, 7);
  const now = new Date("2026-09-24T13:00:00Z");
  assert.equal(staleBefore(now).toISOString(), "2026-09-17T13:00:00.000Z");
  assert.equal(staleBefore(now, 3).toISOString(), "2026-09-21T13:00:00.000Z");
});

test("Тохиргоо: өндөр жингийн босго ба олон талт ангиллууд", () => {
  assert.equal(HIGH_WEIGHT_MIN, 7);
  assert.deepEqual(DIVERSE_CATEGORIES, ["PROJECT", "BUSINESS", "FACT", "HOWTO"]);
  assert.ok(!DIVERSE_CATEGORIES.includes("NEWS"), "NEWS нь эхний бүлгээр ордог");
});
