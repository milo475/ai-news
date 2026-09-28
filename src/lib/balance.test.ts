import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balanceMessage, HALT_USD, levelOf, llmAllowed, STUDIO_MIN_USD, WARN_USD,
} from "./balance";

test("үлдэгдлийн түвшин", () => {
  assert.equal(levelOf(10), "ok");
  assert.equal(levelOf(WARN_USD), "ok");
  assert.equal(levelOf(WARN_USD - 0.01), "low");
  assert.equal(levelOf(HALT_USD), "low");
  assert.equal(levelOf(HALT_USD - 0.01), "halt");
  assert.equal(levelOf(0), "halt");
  // Мэдэхгүй ≠ дууссан
  assert.equal(levelOf(null), "unknown");
});

test("хязгаарууд зөв дараалалтай", () => {
  assert.ok(HALT_USD < STUDIO_MIN_USD, "студи хамгийн түрүүнд унтарна");
  assert.ok(STUDIO_MIN_USD < WARN_USD, "анхааруулга студи унтрахаас өмнө гарна");
});

test("LLM алхам ажиллах эсэх", () => {
  assert.equal(llmAllowed(10), true);
  assert.equal(llmAllowed(1), true, "бага ч гэсэн ажиллана");
  assert.equal(llmAllowed(0.2), false);
  // Үлдэгдэл мэдэгдэхгүй бол зогсоохгүй — өдрийн төсөв хамгаална
  assert.equal(llmAllowed(null), true);
});

test("мессеж зөвхөн шаардлагатай үед", () => {
  assert.equal(balanceMessage(10), null);
  assert.equal(balanceMessage(null), null);
  assert.match(balanceMessage(2)!, /OpenRouter кредит: \$2\.00 — цэнэглэнэ үү/);
  assert.match(balanceMessage(0.1)!, /дууслаа/);
  assert.match(balanceMessage(0.1)!, /LLM алхмууд зогссон/);
});
