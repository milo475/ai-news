import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actorFeedback, actorTokens, checkFixed, correctionNote, CORRECTION_PREFIX, diffLines, FIX_SCHEMA,
  fixSystem, fixUser, keepsActor, MIN_BODY_RATIO, ubDate, type FixOut,
} from "./fix.api";

const OUT: FixOut = {
  titleMn: "Bloomberg: АНУ сургууль цохижээ",
  summaryMn: "Bloomberg-ийн мэдээлснээр…",
  bodyMn: "a".repeat(1_000),
  fbText: "FB",
  fbHook: "карт",
  changed: ["Эх сурвалж нь Bloomberg болохыг сэргээв."],
};

// ---------- Засварын тэмдэглэл ----------

test("тэмдэглэл нь УБ огноо ба юу зассаныг агуулна", () => {
  const note = correctionNote(new Date("2026-09-30T13:00:00Z"), ["Дамжуулсан эх сурвалжийг сэргээв."]);
  assert.equal(note, `${CORRECTION_PREFIX} (2026-09-30): Дамжуулсан эх сурвалжийг сэргээв.`);
});

test("УБ цаг нь UTC-ээс 8 цагаар түрүүлнэ", () => {
  // UTC 2026-09-29 17:00 = УБ 2026-09-30 01:00
  assert.equal(ubDate(new Date("2026-09-29T17:00:00Z")), "2026-09-30");
});

test("загвар юу ч бичээгүй бол ерөнхий мөр үлдээнэ — засвар ил байх нь чухал", () => {
  assert.match(correctionNote(new Date("2026-09-30T13:00:00Z"), []), /Эх сурвалжтай тулгаж/);
});

// ---------- Засварыг хүлээж авах ----------

test("зөв засварыг хүлээж авна", () => {
  assert.equal(checkFixed({ titleMn: "х", bodyMn: "a".repeat(1_100) }, OUT, 60).ok, true);
});

test("хэт богиносгосон биетийг хүлээж авахгүй", () => {
  const r = checkFixed({ titleMn: "х", bodyMn: "a".repeat(2_000) }, OUT, 60);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(" "), /богиносгосон/);
});

test(`босго нь ${MIN_BODY_RATIO * 100}% — improve-ийнхаас өндөр (засвар нь ихэвчлэн нэмдэг)`, () => {
  // 1000 / 1250 = 0.8 — яг босго дээр
  assert.equal(checkFixed({ titleMn: "х", bodyMn: "a".repeat(1_250) }, OUT, 60).ok, true);
  assert.equal(checkFixed({ titleMn: "х", bodyMn: "a".repeat(1_260) }, OUT, 60).ok, false);
});

test("хэт урт гарчгийг хүлээж авахгүй", () => {
  const r = checkFixed({ titleMn: "х", bodyMn: "a".repeat(1_100) }, { ...OUT, titleMn: "б".repeat(70) }, 60);
  assert.match(r.problems.join(" "), /гарчиг 70 тэмдэгт/);
});

test("юу зассанаа бичээгүй бол хүлээж авахгүй — тэмдэглэл хоосон болно", () => {
  const r = checkFixed({ titleMn: "х", bodyMn: "a".repeat(1_100) }, { ...OUT, changed: [] }, 60);
  assert.match(r.problems.join(" "), /юу зассанаа/);
});

// ---------- Prompt ----------

test("prompt-д огнооны дүрэм, дамжуулалт, хуулийн томьёолол бүгд бий", () => {
  const s = fixSystem(60);
  assert.match(s, /RSS-ийн нийтэлсэн огноо/);
  assert.match(s, /Bloomberg-ийн мэдээлснээр/);
  assert.match(s, /reasonable grounds/);
  assert.match(s, /60 тэмдэгтээс богино/);
});

test("user prompt-д зөрчил бүр жагсаагдана", () => {
  const u = fixUser({
    titleMn: "Г", summaryMn: "Х", bodyMn: "Б", fbText: null, fbHook: null,
    sourceText: "S", sourceName: "Futurism",
    issues: [{ field: "гарчиг", rule: "дамжуулалт алга", severity: "ноцтой", detail: "гарчиг: X" }],
    claims: [{ claim: "манай мэдэгдэл", source: "эх", problem: "буруу", severity: "ноцтой" }],
  });
  assert.match(u, /ЗӨРЧЛҮҮД \(2\)/);
  assert.match(u, /манай мэдэгдэл/);
  assert.match(u, /ЭХ НИЙТЛЭЛ \(Futurism\)/);
});

test("схемд картын гарчиг багтсан — карт нь дахин зурагдана", () => {
  assert.ok(FIX_SCHEMA.required.includes("fbHook"));
});

// ---------- Ялгаа ----------

test("өөрчлөгдсөн мөрийг л харуулна", () => {
  const d = diffLines("нэг\nхоёр\nгурав", "нэг\nХОЁР\nгурав");
  assert.equal(d.length, 1);
  assert.deepEqual(d[0], { before: "хоёр", after: "ХОЁР" });
});

test("ижил текстэд ялгаа алга", () => {
  assert.deepEqual(diffLines("нэг\nхоёр", "нэг\nхоёр"), []);
});

test("мөр нэмэгдсэнийг тэмдэглэнэ", () => {
  const d = diffLines("нэг\nгурав", "нэг\nхоёр\nгурав");
  assert.equal(d.length, 1);
  assert.equal(d[0]?.after, "хоёр");
  assert.equal(d[0]?.before, "");
});

// ---------- Огноо: УБ = UTC+8, нэг л удаа хөрвүүлнэ ----------

test("УБ 23:30 — тэр өдрийнхөө огноо", () => {
  // УБ 2026-09-29 23:30 = UTC 2026-09-29 15:30
  assert.equal(ubDate(new Date("2026-09-29T15:30:00Z")), "2026-09-29");
});

test("УБ 00:30 — ДАРААГИЙН өдрийн огноо (UTC-ээр өмнөх өдөр)", () => {
  // УБ 2026-09-30 00:30 = UTC 2026-09-29 16:30
  assert.equal(ubDate(new Date("2026-09-29T16:30:00Z")), "2026-09-30");
});

test("УБ 21:36 (энэ бүлгийн ажлын цаг) — 9/29 хэвээр", () => {
  assert.equal(ubDate(new Date("2026-09-29T13:36:00Z")), "2026-09-29");
});

test("UTC шөнө дунд — УБ аль хэдийн шинэ өдөр", () => {
  assert.equal(ubDate(new Date("2026-09-30T00:00:00Z")), "2026-09-30");
  assert.equal(ubDate(new Date("2026-09-29T23:59:59Z")), "2026-09-30");
});

test("тэмдэглэлийн огноо ubDate-тэй ижил — давхар хөрвүүлэлт алга", () => {
  const at = new Date("2026-09-29T16:30:00Z"); // УБ 9/30 00:30
  assert.match(correctionNote(at, ["x"]), /\(2026-09-30\)/);
});

// ---------- Гарчиг үйлдэгчээ хадгалах ----------

const PENTAGON_TITLE = "АНУ хиймэл оюунд найдаж сургууль цохисныг Пентагон тогтоов";

test("гарчгийн нэрсийг таана — товчлол ба том үсгээр эхэлсэн үг", () => {
  const a = actorTokens(PENTAGON_TITLE);
  assert.ok(a.has("ану"), [...a].join(","));
  assert.ok(a.has("пентагон"), [...a].join(","));
  assert.ok(!a.has("хиймэл"), "жирийн үг нэр биш");
});

test("БОДИТ АЛДАА: «Bloomberg мэдээлэв» гарчиг үйлдэгчээ алдсан", () => {
  assert.equal(
    keepsActor(PENTAGON_TITLE, "Хиймэл оюунд найдаж сургууль цохисныг Bloomberg мэдээлэв"),
    false,
  );
});

test("үйлдэгчээ хадгалсан гарчиг тэнцэнэ", () => {
  assert.equal(
    keepsActor(PENTAGON_TITLE, "АНУ Иран дахь сургуулийг AI-д найдан цохисон гэж Bloomberg мэдээлэв"),
    true,
  );
});

test("нөхцөлтэй хэлбэр ч тоологдоно", () => {
  assert.equal(keepsActor(PENTAGON_TITLE, "Пентагоны шалгалтын дүгнэлтийг Bloomberg мэдээлэв"), true);
});

test("эх гарчигт нэр байхгүй бол шаардахгүй", () => {
  assert.equal(keepsActor("Шинэ загвар гарлаа", "Өөр гарчиг"), true);
});

test("дахин оролдох заавар алга болсон нэрийг нэрлэнэ", () => {
  const fb = actorFeedback(PENTAGON_TITLE, "Хиймэл оюунд найдаж сургууль цохисныг Bloomberg мэдээлэв");
  assert.match(fb, /ану/);
  assert.match(fb, /пентагон/);
});

test("prompt-д үйлдэгчийн дүрэм баримтжсан", () => {
  assert.match(fixSystem(60), /ҮЙЛДЭГЧ/);
  assert.match(fixSystem(60), /гарчгийн ТӨГСГӨЛД/);
});
