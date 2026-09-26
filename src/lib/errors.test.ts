import assert from "node:assert/strict";
import { test } from "node:test";
import { fingerprint, messageOf, normalizeMessage, shortMessage, stackOf } from "./errors.api";

test("messageOf — Error, мөр, объект", () => {
  assert.equal(messageOf(new Error("бүтсэнгүй")), "бүтсэнгүй");
  assert.equal(messageOf("мөр алдаа"), "мөр алдаа");
  assert.equal(messageOf({ code: 42 }), '{"code":42}');
  assert.equal(messageOf(new TypeError()), "TypeError", "мессежгүй бол нэрийг нь");
});

test("stackOf — зөвхөн Error-оос, 4000 тэмдэгтээр таслана", () => {
  assert.equal(stackOf("мөр"), null);
  const e = new Error("x");
  e.stack = "a".repeat(5_000);
  assert.equal(stackOf(e)?.length, 4_000);
});

test("normalizeMessage — өөрчлөгддөг хэсгийг орлуулна", () => {
  assert.equal(
    normalizeMessage("Article clx123abc456def789ghi0 not found"),
    "Article <id> not found",
  );
  assert.equal(normalizeMessage("timeout after 3000 ms"), "timeout after <n> ms");
  assert.equal(normalizeMessage("fetch https://a.mn/x?y=1 failed"), "fetch <url> failed");
});

test("fingerprint — ижил алдаа ижил, өөр эх сурвалж өөр", () => {
  const a = fingerprint("web", "/medee", "Article clx111aaa222bbb333ccc0 not found");
  const b = fingerprint("web", "/medee", "Article clx999zzz888yyy777xxx not found");
  assert.equal(a, b, "id нь өөр ч нэг л алдаа");

  assert.notEqual(a, fingerprint("cron", "/medee", "Article clx111aaa222bbb333ccc0 not found"));
  assert.notEqual(a, fingerprint("web", "/prompt", "Article clx111aaa222bbb333ccc0 not found"));
});

test("fingerprint — эх сурвалжаар эхэлнэ (нүдээр уншихад)", () => {
  assert.ok(fingerprint("cron", null, "x").startsWith("cron:"));
});

test("shortMessage — уртыг таслана, мөр нэгтгэнэ", () => {
  assert.equal(shortMessage("a\n b\t c"), "a b c");
  const long = "х".repeat(200);
  assert.equal(shortMessage(long, 20).length, 20);
  assert.ok(shortMessage(long, 20).endsWith("…"));
  assert.equal(shortMessage("богино", 20), "богино");
});
