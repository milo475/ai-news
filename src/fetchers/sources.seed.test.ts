import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES } from "../agent/category";
import { SOURCES } from "./sources.seed";

test("SOURCES: url, feedUrl давхардахгүй (upsert-ийн түлхүүр)", () => {
  const urls = SOURCES.map((s) => s.url);
  // feedUrl нь DB-д unique — HTML fetcher-ээр татдаг эх сурвалжид хоосон байна
  const feeds = SOURCES.map((s) => s.feedUrl).filter((f): f is string => Boolean(f));
  assert.equal(new Set(urls).size, urls.length, "url давхардсан");
  assert.equal(new Set(feeds).size, feeds.length, "feedUrl давхардсан");
});

test("SOURCES: жин 1–10, ангилал танигдана, хаяг https", () => {
  for (const s of SOURCES) {
    assert.ok(s.weight >= 1 && s.weight <= 10, `${s.name}: жин ${s.weight}`);
    assert.ok(s.category === undefined || CATEGORIES.includes(s.category), `${s.name}: ${s.category}`);
    // http:// нь зөвхөн https байхгүй дотоодын сайтад (ublife.mn)
    assert.ok(/^https?:\/\//.test(s.url), `${s.name}: ${s.url}`);
    if (s.feedUrl) assert.ok(s.feedUrl.startsWith("https://"), `${s.name}: ${s.feedUrl}`);
    // RSS байхгүй эх сурвалж бүр listUrl + linkSelector хоёулантай байх ёстой
    if (!s.feedUrl) {
      assert.ok(s.listUrl, `${s.name}: feedUrl ч, listUrl ч алга`);
      assert.ok(s.linkSelector, `${s.name}: linkSelector алга`);
    }
  }
});

test("SOURCES: MN эх сурвалж нь region тавьсан байна", () => {
  const mn = SOURCES.filter((s) => s.region === "MN");
  assert.ok(mn.length >= 8, `дотоодын эх сурвалж ${mn.length}`);
  // Дотоодын эх сурвалж нь .mn эсвэл монголын байгууллагын домэйн (unread.today)
  const MN_EXCEPTIONS = ["https://unread.today"];
  for (const s of mn) {
    assert.ok(
      /\.mn(\/|$)/.test(s.url) || MN_EXCEPTIONS.includes(s.url),
      `${s.name}: ${s.url} — .mn биш бол MN_EXCEPTIONS-д нэмнэ`,
    );
  }
  // Дэлхийн эх сурвалжид region тавиагүй = GLOBAL
  assert.ok(SOURCES.some((s) => s.region === undefined), "GLOBAL эх сурвалж байх ёстой");
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
