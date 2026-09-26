import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseTab, showSection, TAB_KEYS, tabCounts, tabHref, visibleTabs,
} from "./search-tabs.api";

const results = {
  articles: [1, 2],
  guides: [1],
  prompts: [],
  catalogTools: [1, 2, 3],
  tools: [1],
  models: [],
};

test("parseTab — танихгүй утгыг all болгоно", () => {
  assert.equal(parseTab(undefined), "all");
  assert.equal(parseTab(""), "all");
  assert.equal(parseTab("хакер"), "all");
  assert.equal(parseTab("MEDEE"), "medee");
});

test("tabCounts — хэрэгслийн хоёр эх нийлнэ", () => {
  const c = tabCounts(results);
  assert.equal(c.medee, 2);
  assert.equal(c.zaavar, 1);
  assert.equal(c.prompt, 0);
  assert.equal(c.hereglel, 4, "каталог 3 + хэрэглээ 1");
  assert.equal(c.model, 0);
  assert.equal(c.all, 7);
});

test("visibleTabs — хоосон табыг нуух, Бүгдийг үргэлж үзүүлнэ", () => {
  const v = visibleTabs(tabCounts(results));
  assert.deepEqual(v, ["all", "medee", "zaavar", "hereglel"]);

  const empty = visibleTabs(tabCounts({ articles: [], guides: [], prompts: [], catalogTools: [], tools: [], models: [] }));
  assert.deepEqual(empty, ["all"]);
});

test("showSection — all бол бүгд", () => {
  for (const k of TAB_KEYS) {
    if (k === "all") continue;
    assert.equal(showSection("all", k), true);
  }
  assert.equal(showSection("medee", "medee"), true);
  assert.equal(showSection("medee", "zaavar"), false);
});

test("tabHref — хайлтын үгийг хадгална, all бол t= гарахгүй", () => {
  assert.equal(tabHref("gpt 5", "all"), "/hailt?q=gpt+5");
  assert.equal(tabHref("gpt 5", "zaavar"), "/hailt?q=gpt+5&t=zaavar");
  assert.equal(tabHref("a&b", "medee"), "/hailt?q=a%26b&t=medee");
});
