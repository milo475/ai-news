import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTsQuery, MIN_QUERY } from "./search-query";

test("buildTsQuery: бүх үг AND, сүүлийнх prefix", () => {
  assert.equal(buildTsQuery("gemini"), "gemini:*");
  assert.equal(buildTsQuery("Gemini 3.8"), "gemini & 3.8:*");
  assert.equal(buildTsQuery("дуу хоолой"), "дуу & хоолой:*");
  assert.equal(buildTsQuery("  код   бичих  "), "код & бичих:*");
  // tsquery-гийн оператор бичсэн ч алдаа гаргахгүй
  assert.equal(buildTsQuery("gpt & | ! ( ) :*"), "gpt:*");
  assert.equal(buildTsQuery("anthropic/claude"), "anthropic & claude:*");
  assert.equal(buildTsQuery(""), "");
  assert.equal(buildTsQuery("!!!"), "");
});

// DB-тэй интеграцийн тест — DATABASE_URL байхгүй бол алгасна
const hasDb = Boolean(process.env.DATABASE_URL);
const dbTest = { skip: hasDb ? false : "DATABASE_URL алга" };

test("хайлт: латин үгээр модель олдоно", dbTest, async () => {
  const { search } = await import("./search");
  const r = await search("gemini", { limit: 5 });
  assert.ok(r.models.length > 0, "модель олдсонгүй");
  assert.ok(r.models.every((m) => /gemini|imagen/i.test(`${m.name} ${m.slug}`)), "хамааралгүй модель орсон");
});

test("хайлт: кирилл үгээр хэрэгсэл олдоно", dbTest, async () => {
  const { search } = await import("./search");
  const r = await search("дуу хоолой", { limit: 8 });
  assert.ok(r.tools.length > 0, "хэрэгсэл олдсонгүй");
  // Ангиллын нэрээр ч олдох ёстой ("Дуу хоолой: унших, бичлэг текст болгох")
  assert.ok(r.tools.some((t) => t.useCaseSlug === "duu-hooloi"), "ангиллаар олдсонгүй");
});

test("хайлт: prefix ('gem' → Gemini)", dbTest, async () => {
  const { search } = await import("./search");
  const short = await search("gem", { limit: 5 });
  const full = await search("gemini", { limit: 5 });
  assert.ok(short.models.length > 0, "prefix-ээр модель олдсонгүй");
  assert.deepEqual(short.models.map((m) => m.slug), full.models.map((m) => m.slug));
});

test("хайлт: богино query — хоосон буцаана", dbTest, async () => {
  const { search } = await import("./search");
  for (const q of ["a", " ", ""]) {
    const r = await search(q);
    assert.equal(r.total, 0, `"${q}" хоосон байх ёстой`);
  }
  assert.equal(MIN_QUERY, 2);
});
