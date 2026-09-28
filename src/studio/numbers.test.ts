import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkedDate, CHECK_OFFICIAL, daysSince, docNumbers, extractClaims, isStaleDoc, STALE_DAYS,
  stripUnverified, unverifiedClaims,
} from "./numbers.api";

const KLING = readFileSync(join(process.cwd(), "src/studio/tools/kling.md"), "utf8");

test("тоон мэдэгдлийг нэгжтэй нь ялгана", () => {
  const c = extractClaims("Өдөрт 66 кредит, 5 секундын клип 25 кредит, үнэ $10");
  // Мөнгөн тэмдэгт нь тооны өмнө («$10»), бусад нэгж ард
  assert.deepEqual(c.map((x) => x.text).sort(), ["$10", "25 кредит", "5 секунд", "66 кредит"]);
});

test("харьцаа, огноо, хэмжээг тоон мэдэгдэл гэж үзэхгүй", () => {
  assert.deepEqual(extractClaims("Харьцаа 16:9, огноо 2026-09-27, хэмжээ 1080x1350"), []);
});

test("лавлахад байгаа тоог зөвшөөрнө", () => {
  assert.deepEqual(unverifiedClaims("Өдөрт 66 кредит. 5 секундын клип 25 кредит.", KLING), []);
});

test("лавлахад БАЙХГҮЙ тоог барина", () => {
  const bad = unverifiedClaims("Өдөрт 120 кредит. 4 секундын клип 90 кредит.", KLING);
  assert.deepEqual(bad.map((c) => c.text), ["120 кредит", "4 секунд", "90 кредит"]);
});

test("хатуу нэгжтэй жижиг тоог ч шалгана", () => {
  // «4 секунд» нь Kling дээр буруу (5–10) — хэрэглэгч тэр тоогоор төлөвлөнө
  assert.ok(unverifiedClaims("4 секундын клип гаргана", KLING).length > 0);
});

test("зөөлөн нэгжтэй жижиг тоог алгасна", () => {
  // «3 алхам» нь хэрэгслийн баримт биш, зааврын хэсэг
  assert.deepEqual(unverifiedClaims("Эхлээд 3 алхам хийнэ, 2 хувилбар гаргана.", KLING), []);
});

test("баталгаажаагүй тоог хасаж, шалгахыг санал болгоно", () => {
  const r = stripUnverified("Өдөрт 120 кредит өгдөг.", KLING);
  assert.ok(!r.text.includes("120"), r.text);
  assert.match(r.text, new RegExp(CHECK_OFFICIAL));
  assert.equal(r.removed.length, 1);
});

test("цэвэр текстийг хөндөхгүй", () => {
  const text = "Өдөрт 66 кредит өгдөг.";
  const r = stripUnverified(text, KLING);
  assert.equal(r.text, text);
  assert.deepEqual(r.removed, []);
});

test("лавлахын бүх тоог уншина", () => {
  const n = docNumbers(KLING);
  assert.ok(n.has("66"), [...n].join(","));
  assert.ok(n.has("25"));
});

// ---------- Мэдлэгийн сангийн шинэлэг байдал ----------

test("«сүүлд шалгасан» огноог уншина", () => {
  assert.match(checkedDate(KLING) ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(checkedDate("огноогүй файл"), null);
});

test("60 хоногоос хуучин файлыг тэмдэглэнэ", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  assert.equal(STALE_DAYS, 60);
  assert.equal(daysSince("2026-11-01", now), 30);
  assert.equal(isStaleDoc("2026-11-01", now), false);
  assert.equal(isStaleDoc("2026-09-01", now), true);
  // Огноогүй файл нь хуучин гэж тооцогдоно
  assert.equal(isStaleDoc(null, now), true);
});
