import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkbox, csvList, cuid, formId, httpUrl, internalPath, optionalText, parseArg, parseForm,
  slug, tryParse, z,
} from "./validate";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
};

test("cuid — үсэг тоо, урт хязгаартай", () => {
  assert.ok(cuid.safeParse("clx1a2b3c4d5e6f7g8h9i0j1").success);
  assert.ok(!cuid.safeParse("short").success);
  assert.ok(!cuid.safeParse("id-with-dash-0000000").success);
  assert.ok(!cuid.safeParse("'; DROP TABLE Article; --").success);
  assert.ok(!cuid.safeParse("a".repeat(100)).success);
});

test("slug — ташуу зураастай моделийн нэрийг зөвшөөрнө", () => {
  assert.ok(slug.safeParse("chatgpt").success);
  assert.ok(slug.safeParse("openai/gpt-5").success);
  assert.ok(slug.safeParse("gpt-4.1").success);
  assert.ok(!slug.safeParse("../../etc/passwd").success);
  assert.ok(!slug.safeParse("a b").success);
  assert.ok(!slug.safeParse("").success);
});

test("internalPath — гадаад хаяг, protocol-relative-ыг татгалзана", () => {
  assert.ok(internalPath.safeParse("/medee").success);
  assert.ok(!internalPath.safeParse("//evil.com").success);
  assert.ok(!internalPath.safeParse("https://evil.com").success);
  assert.ok(!internalPath.safeParse("medee").success);
});

test("httpUrl — зөвхөн http(s)", () => {
  assert.ok(httpUrl.safeParse("https://ai.mn").success);
  assert.ok(!httpUrl.safeParse("javascript:alert(1)").success);
  assert.ok(!httpUrl.safeParse("ftp://a.mn").success);
});

test("checkbox — on/true/1", () => {
  assert.equal(checkbox.parse("on"), true);
  assert.equal(checkbox.parse("true"), true);
  assert.equal(checkbox.parse("1"), true);
  assert.equal(checkbox.parse(undefined), false);
  assert.equal(checkbox.parse("off"), false);
});

test("csvList — давхардлыг хасаж, тоог хязгаарлана", () => {
  assert.deepEqual(csvList().parse("a, b,a\nc"), ["a", "b", "c"]);
  assert.equal(csvList(2).parse("a,b,c,d").length, 2);
});

test("optionalText — хоосныг undefined болгоно", () => {
  assert.equal(optionalText(10).parse("  "), undefined);
  assert.equal(optionalText(10).parse(" x "), "x");
});

test("parseForm — бүх талбар шалгагдаж, алдаа мөрөөр гарна", () => {
  const schema = z.object({ title: z.string().min(3, "Хэт богино"), n: z.coerce.number().int() });
  const ok = parseForm(schema, fd({ title: "гарчиг", n: "5" }));
  assert.ok(ok.ok && ok.data.n === 5);

  const bad = parseForm(schema, fd({ title: "a", n: "5" }));
  assert.ok(!bad.ok);
  if (!bad.ok) {
    assert.equal(bad.error, "Хэт богино");
    assert.equal(bad.fields.title, "Хэт богино");
  }
});

test("parseArg — буруу бол алдаа шидэж, талбарын нэрийг хэлнэ", () => {
  assert.equal(parseArg(cuid, "clx1a2b3c4d5e6f7g8h9i0j1"), "clx1a2b3c4d5e6f7g8h9i0j1");
  assert.throws(() => parseArg(cuid, "хакер", "id"), /Буруу id/);
});

test("tryParse — буруу бол null", () => {
  assert.equal(tryParse(cuid, "хакер"), null);
  assert.equal(tryParse(internalPath, "//evil.com"), null);
  assert.equal(tryParse(internalPath, "/medee"), "/medee");
});

test("formId — id талбарыг cuid гэж шалгана", () => {
  assert.equal(formId(fd({ id: "clx1a2b3c4d5e6f7g8h9i0j1" })), "clx1a2b3c4d5e6f7g8h9i0j1");
  assert.throws(() => formId(fd({})), /Буруу id/);
  assert.throws(() => formId(fd({ id: "1 OR 1=1" })), /Буруу id/);
});
