/**
 * Мэдлэгийн сангийн бүрэн бүтэн байдал — каталогийн хэрэгсэл бүрд файл байх ёстой.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { TOOLS } from "./studio.api";

function doc(rel: string): string {
  return readFileSync(join(process.cwd(), "src", "studio", rel), "utf8");
}

test("хэрэгсэл бүрд мэдлэгийн файл бий", () => {
  for (const t of TOOLS) {
    const text = doc(join("tools", `${t.doc}.md`));
    assert.ok(text.length > 200, `${t.doc}.md хэт богино`);
  }
});

test("файл бүрт «сүүлд шалгасан огноо» ба эх холбоос бий", () => {
  for (const t of TOOLS) {
    const text = doc(join("tools", `${t.doc}.md`));
    assert.match(text, /Сүүлд шалгасан: 20\d\d-\d\d-\d\d/u, `${t.doc}.md — огноогүй`);
    assert.match(text, /https:\/\//u, `${t.doc}.md — эх холбоосгүй`);
  }
});

test("үнэгүй биш хэрэгслийн файлд төлбөртэй гэдэг нь бичигдсэн", () => {
  for (const t of TOOLS.filter((x) => !x.free && !x.retired)) {
    assert.match(doc(join("tools", `${t.doc}.md`)), /төлбөртэй/iu, `${t.doc}.md`);
  }
});

test("хаагдсан хэрэгслийн файл нь санал болгохгүй гэж анхааруулна", () => {
  for (const t of TOOLS.filter((x) => x.retired)) {
    assert.match(doc(join("tools", `${t.doc}.md`)), /хаагдсан|ХААГДСАН/u, `${t.doc}.md`);
  }
});

test("craft.md ба mongol.md бий", () => {
  assert.ok(doc("craft.md").length > 500);
  const mongol = doc("mongol.md");
  assert.ok(mongol.length > 500);
  // Кирилл текстийн анхааруулга нь монгол лавлахын гол зүйл
  assert.match(mongol, /кирилл/iu);
});
