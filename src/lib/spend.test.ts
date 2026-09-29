import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCall, drift, driftMessage, DRIFT_WARN_RATIO, emptyLedger, since,
} from "./spend.api";

test("дуудлага бүр бүртгэгдэнэ", () => {
  let l = emptyLedger();
  l = addCall(l, 0.002);
  l = addCall(l, 0.003);
  assert.equal(Number(l.usd.toFixed(4)), 0.005);
  assert.equal(l.calls, 2);
  assert.equal(l.zeroCost, 0);
});

test("хариунд зардал БАЙХГҮЙ үед дуудлага тоологдож, тэгийг тэмдэглэнэ", () => {
  // Зарим provider зардлаа тайлагнахгүй — дуудлага нь «алга» болох ёсгүй
  let l = emptyLedger();
  l = addCall(l, 0);
  l = addCall(l, Number.NaN);
  l = addCall(l, 0.004);
  assert.equal(Number(l.usd.toFixed(4)), 0.004);
  assert.equal(l.calls, 3);
  assert.equal(l.zeroCost, 2, "зардалгүй ирсэн дуудлагыг тоолно");
});

test("сөрөг зардлыг тоохгүй", () => {
  assert.equal(addCall(emptyLedger(), -5).usd, 0);
});

test("хоёр тэмдгийн зөрүү — «энэ алхам хэд зарцуулав»", () => {
  let l = emptyLedger();
  l = addCall(l, 1.0);
  const before = l;
  l = addCall(l, 0.25);
  l = addCall(l, 0.25);
  const d = since(before, l);
  assert.equal(d.usd, 0.5);
  assert.equal(d.calls, 2);
});

// ---------- Бүртгэгдсэн ба бодитын зөрүү ----------

test("зөрүү 20%-иас бага бол хэвийн", () => {
  assert.equal(DRIFT_WARN_RATIO, 0.2);
  const d = drift(0.9, 1.0)!;
  assert.equal(d.ratio, 0.1);
  assert.equal(d.ok, true);
  assert.equal(driftMessage(d), null);
});

test("бүртгэл дутуу бол ⚠", () => {
  // 2026-09-28: 195 үр дүн, бүртгэл $0.029, бодит ~$1.5
  const d = drift(0.029, 1.5)!;
  assert.equal(d.ok, false);
  assert.match(driftMessage(d)!, /бүртгэл дутуу/);
  assert.match(driftMessage(d)!, /98%/);
});

test("бүртгэл ИЛҮҮ бол бас ⚠ (давхар тоолол)", () => {
  const d = drift(2.0, 1.0)!;
  assert.equal(d.ok, false);
  assert.match(driftMessage(d)!, /ИЛҮҮ/);
  assert.match(driftMessage(d)!, /давхар тоолж/);
});

test("бодит зарцуулалт мэдэгдэхгүй бол дүгнэлт гаргахгүй", () => {
  assert.equal(drift(1.0, null), null);
  assert.equal(drift(1.0, 0), null, "тэг зарцуулалт дээр хувь бодохгүй");
});

test("яг 20% зөрүү нь хэвийн (хил)", () => {
  assert.equal(drift(0.8, 1.0)!.ok, true);
  assert.equal(drift(0.79, 1.0)!.ok, false);
});
