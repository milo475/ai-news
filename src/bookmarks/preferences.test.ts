import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCategories, cleanUsecases, showInterestBlock } from "./preferences.api";
import { CATEGORIES } from "../agent/category";

test("«Таны сонирхол» блок: нэвтрээгүй хэрэглэгчид харагдахгүй", () => {
  // Нэвтрээгүй — ангилал, мэдээ байсан ч харагдахгүй
  assert.equal(showInterestBlock(null, ["NEWS"], 4), false);
  assert.equal(showInterestBlock(null, [], 0), false);

  const user = { id: "u1" };
  assert.equal(showInterestBlock(user, ["NEWS"], 4), true);
  assert.equal(showInterestBlock(user, [], 4), false, "сонирхол сонгоогүй бол харуулахгүй");
  assert.equal(showInterestBlock(user, ["NEWS"], 0), false, "мэдээ байхгүй бол хоосон блок гаргахгүй");
});

test("cleanCategories: танигдахгүй утга шүүгдэж, давхардал арилна", () => {
  assert.deepEqual(cleanCategories(["NEWS", "RISK"], CATEGORIES), ["NEWS", "RISK"]);
  assert.deepEqual(cleanCategories(["news", " risk "], CATEGORIES), ["NEWS", "RISK"], "жижиг үсэг, зайг тэвчинэ");
  assert.deepEqual(cleanCategories(["NEWS", "NEWS"], CATEGORIES), ["NEWS"], "давхардал нэг удаа");
  assert.deepEqual(cleanCategories(["ГАДНЫ", "<script>"], CATEGORIES), [], "гадны утга орохгүй");
  assert.deepEqual(cleanCategories([], CATEGORIES), []);
});

test("cleanUsecases: зөвхөн идэвхтэй ангиллын slug", () => {
  const active = ["zurag", "kod", "bichig"];
  assert.deepEqual(cleanUsecases(["zurag", "kod"], active), ["zurag", "kod"]);
  assert.deepEqual(cleanUsecases(["zurag", "ustgasan"], active), ["zurag"], "идэвхгүй болсон slug унана");
  assert.deepEqual(cleanUsecases(["kod", "kod"], active), ["kod"]);
  assert.deepEqual(cleanUsecases([" zurag "], active), ["zurag"]);
});
