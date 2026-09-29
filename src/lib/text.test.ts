import { test } from "node:test";
import assert from "node:assert/strict";
import { mentions, onlyMentioned } from "./text.api";

test("нийтлэлд дурдагдсан нэрийг таана", () => {
  const text = "Meta компанийн Muse агентад zero-day эмзэг байдал илэрлээ.";
  assert.equal(mentions(text, "Meta"), true);
  assert.equal(mentions(text, "Muse"), true);
  // Muse-ийн нийтлэлд эдгээр ОГТ дурдагдаагүй ч «холбоотой» гэж гарч байсан
  assert.equal(mentions(text, "Google"), false);
  assert.equal(mentions(text, "Anthropic"), false);
});

test("монгол нөхцөлтэй нэрийг таана", () => {
  assert.equal(mentions("OpenAI-ийн агент системд хандлаа", "OpenAI"), true);
  assert.equal(mentions("Google-д мэдэгдэв", "Google"), true);
});

test("үгийн дунд таарахгүй", () => {
  // «Meta» нь «Metallica»-гийн хэсэг байж болохгүй
  assert.equal(mentions("Metallica хамтлаг", "Meta"), false);
  assert.equal(mentions("Openings нээлттэй", "OpenAI"), false);
});

test("зураасаар салсан нэр нь дурдалт МӨН", () => {
  // «GPT-6» нь GPT гэр бүлийг үнэхээр дурддаг
  assert.equal(mentions("GPT-6 гарлаа", "GPT"), true);
  assert.equal(mentions("Gemini-3 туршилт", "Gemini"), true);
});

test("дурдагдсаныг л үлдээнэ", () => {
  const text = "Meta компанийн Muse агент.";
  const all = [{ name: "Meta" }, { name: "Google" }, { name: "Anthropic" }];
  assert.deepEqual(onlyMentioned(all, text), [{ name: "Meta" }]);
});

test("хоосон нэрийг тоохгүй", () => {
  assert.equal(mentions("текст", ""), false);
  assert.equal(mentions("текст", "a"), false);
});
