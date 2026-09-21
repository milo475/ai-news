import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug";

test("slugify: галиглал, тэмдэг, хоосон", () => {
  assert.equal(slugify("OpenAI шинэ модель гаргалаа"), "openai-shine-model-gargalaa");
  assert.equal(slugify("Хөрөнгө оруулалт: 1.5 тэрбум $"), "khorongo-oruulalt-1-5-terbum");
  assert.equal(slugify(""), "");
  assert.equal(slugify("!!! ??? "), "");
});

test("slugify: 'е' байрлалаас хамаарна", () => {
  assert.equal(slugify("Ерөнхийлөгч"), "yeronkhiilogch");
  assert.equal(slugify("модель"), "model");
});

test("slugify: 60 тэмдэгт, үгийн дунд таслахгүй", () => {
  const s = slugify("Anthropic компани Claude Fable 5.1 загварыг олон улсын зах зээлд танилцууллаа");
  assert.ok(s.length <= 60, s);
  assert.ok(!s.endsWith("-"));
  assert.ok(s.startsWith("anthropic-kompani-claude-fable-5-1"), s);
  // таслалт нь бүтэн үгээр дуусна
  assert.ok("anthropic компани claude fable 5 1 zagvaryg olon ulsyn zakh zeeld taniltsuullaa".includes(s.split("-").pop()!), s);
});

test("cleanTags: trim, lowercase, давхардал, 5-ын хязгаар", async () => {
  const { cleanTags } = await import("./process");
  assert.deepEqual(cleanTags([" OpenAI ", "openai", "", "  ", "Модель"]), ["openai", "модель"]);
  assert.deepEqual(cleanTags(["a", "b", "c", "d", "e", "f"]), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(cleanTags([]), []);
});
