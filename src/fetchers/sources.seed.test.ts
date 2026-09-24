import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES } from "../agent/category";
import { SOURCES } from "./sources.seed";

test("SOURCES: url, feedUrl давхардахгүй (upsert-ийн түлхүүр)", () => {
  const urls = SOURCES.map((s) => s.url);
  const feeds = SOURCES.map((s) => s.feedUrl);
  assert.equal(new Set(urls).size, urls.length, "url давхардсан");
  assert.equal(new Set(feeds).size, feeds.length, "feedUrl давхардсан");
});

test("SOURCES: жин 1–10, ангилал танигдана, хаяг https", () => {
  for (const s of SOURCES) {
    assert.ok(s.weight >= 1 && s.weight <= 10, `${s.name}: жин ${s.weight}`);
    assert.ok(s.category === undefined || CATEGORIES.includes(s.category), `${s.name}: ${s.category}`);
    assert.ok(s.url.startsWith("https://"), `${s.name}: ${s.url}`);
    assert.ok(s.feedUrl.startsWith("https://"), `${s.name}: ${s.feedUrl}`);
  }
});

test("SOURCES: идэвхгүй эх сурвалж бүрт шалтгааны тайлбар кодод байна", async () => {
  const { readFileSync } = await import("node:fs");
  const code = readFileSync(new URL("./sources.seed.ts", import.meta.url), "utf8");

  for (const s of SOURCES.filter((x) => x.isActive === false)) {
    // Нэр нь кодод коммент дотор дурдагдсан байх ёстой — яагаад унтраасныг дараа нь санахад
    const line = code.split("\n").find((l) => l.includes(`name: "${s.name}"`));
    assert.ok(line, `${s.name} олдсонгүй`);
    const idx = code.indexOf(line!);
    const before = code.slice(Math.max(0, idx - 400), idx);
    assert.ok(before.includes("//"), `${s.name}: яагаад идэвхгүй болгосон тайлбар алга`);
  }
});
