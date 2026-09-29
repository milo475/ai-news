import { test } from "node:test";
import assert from "node:assert/strict";
import { attributed, checkDates, extractDates, sourceHasDate, weekdayOf } from "./dates.api";

// ---------- Гаргаж авах ----------

test("«2026 оны 9-р сарын 21-нд» — он, сар, өдөр", () => {
  const [d] = extractDates("…илэрснийг 2026 оны 9-р сарын 21-нд мэдээллээ.");
  assert.deepEqual({ year: d?.year, month: d?.month, day: d?.day }, { year: 2026, month: 9, day: 21 });
});

test("«хоёрдугаар сарын 28-нд» — үгээр бичсэн сар", () => {
  const [d] = extractDates("2026 оны хоёрдугаар сарын 28-нд охидын сургуулийг цохисон.");
  assert.deepEqual({ year: d?.year, month: d?.month, day: d?.day }, { year: 2026, month: 2, day: 28 });
});

test("«9-р сард» — өдөргүй", () => {
  const [d] = extractDates("2026 оны 9-р сард гарсан Muse агент");
  assert.equal(d?.day, null);
  assert.equal(d?.month, 9);
});

test("ISO огноо", () => {
  const [d] = extractDates("Тайлан 2026-09-21-нд гарсан.");
  assert.deepEqual({ year: d?.year, month: d?.month, day: d?.day }, { year: 2026, month: 9, day: 21 });
});

test("огноогүй текстээс юу ч гарахгүй", () => {
  assert.deepEqual(extractDates("Судлаач эмзэг байдлыг илрүүлжээ."), []);
});

test("нэг хэллэгийг хоёр загвар барьж давхардуулахгүй", () => {
  // «арван хоёрдугаар сар» — WORD_MONTH барина, NUMERIC_MONTH барихгүй
  assert.equal(extractDates("2026 оны арван хоёрдугаар сарын 5-нд").length, 1);
});

// ---------- Эх сурвалжтай тулгах ----------

const D = { text: "9-р сарын 21", year: 2026, month: 9, day: 21 };

test("«September 21» таарна", () => {
  assert.equal(sourceHasDate("The report came out on September 21, according to…", D), true);
});

test("«Sept. 21st» таарна", () => {
  assert.equal(sourceHasDate("Disclosed Sept. 21st by the researcher.", D), true);
});

test("«21 September» (эсрэг дараалал) таарна", () => {
  assert.equal(sourceHasDate("On 21 September the flaw was published.", D), true);
});

test("«9/21» таарна", () => {
  assert.equal(sourceHasDate("Filed 9/21 with the vendor.", D), true);
});

test("7 хоногийн нэр таарна — 2026-09-21 бол даваа", () => {
  assert.equal(weekdayOf(D)?.en, "monday");
  assert.equal(sourceHasDate("The bug was reported Monday morning.", D), true);
});

test("огноогүй эх текст таарахгүй", () => {
  assert.equal(sourceHasDate("The researcher found a serious 0-day in Muse.", D), false);
});

test("өөр сар таарахгүй", () => {
  assert.equal(sourceHasDate("Published in August 21 last year.", { ...D, month: 9 }), false);
});

test("сарын нэр үгийн дунд таарахгүй", () => {
  // «decorated» дотор «dec» байгаа ч 12-р сар гэж тоолохгүй
  assert.equal(sourceHasDate("A decorated officer spoke.", { text: "", year: 2026, month: 12, day: 3 }), false);
});

// ---------- Бодит хэрэг ----------

/** 2026-09-29-нд production-д гарсан Muse-ийн мэдээ — эх текстэд ОГНОО БАЙХГҮЙ */
const MUSE_SOURCE =
  "Muse, Meta's extraordinarily privileged AI assistant, has a serious 0-day. Security " +
  "researcher Patrick Wardle found that any app or terminal command running on macOS can " +
  "steal the assistant's authentication token. Amazon has begun restricting the agent.";

test("RSS-ийн pubDate биед баримт болж орсныг ноцтой гэж барина", () => {
  const issues = checkDates({
    text: "…илэрснийг 2026 оны 9-р сарын 21-нд мэдээллээ.",
    sourceText: MUSE_SOURCE,
    publishedAtSource: new Date("2026-09-21T22:24:38Z"),
    sourceName: "Ars Technica",
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "ноцтой");
  assert.match(issues[0]?.reason ?? "", /pubDate/);
  assert.match(issues[0]?.suggestion ?? "", /Ars Technica/);
});

test("pubDate-тай таарахгүй, эх сурвалжид ч байхгүй огноо — анхаарах", () => {
  const issues = checkDates({
    text: "2026 оны 3-р сарын 4-нд болсон.",
    sourceText: MUSE_SOURCE,
    publishedAtSource: new Date("2026-09-21T22:24:38Z"),
  });
  assert.equal(issues[0]?.severity, "анхаарах");
});

/** Пентагоны мэдээ — «February 28th» эх сурвалжид БАЙГАА тул зөрчил биш */
const PENTAGON_SOURCE =
  "According to new reporting by Bloomberg, the Pentagon's investigation into the " +
  "February 28th air strikes on the Shajareh Tayyebeh girls' school — a double-tap strike " +
  "which killed over 150 people, including at least 123 children — concluded that the " +
  "attack was the result of outdated intelligence and over-reliance on an AI targeting system.";

test("эх сурвалжид байгаа огноог зөрчил гэж үзэхгүй", () => {
  const issues = checkDates({
    text: "…2026 оны хоёрдугаар сарын 28-нд охидын сургуулийг агаараас цохисныг тогтоолоо.",
    sourceText: PENTAGON_SOURCE,
  });
  assert.deepEqual(issues, []);
});

test("эх текст хоосон бол шалгахгүй — худал зөрчил гаргахгүй", () => {
  assert.deepEqual(checkDates({ text: "2026 оны 9-р сарын 21-нд", sourceText: null }), []);
});

test("attributed нь эх сурвалжид хамааруулсан хэллэг өгнө", () => {
  assert.equal(attributed("Ars Technica", "9-р сарын 21-нд"), "Ars Technica 9-р сарын 21-нд мэдээлснээр");
});

test("«9-р сард 30 настай» — 30 нь өдөр БИШ, нас", () => {
  // Бодит production текст: «2025 оны 9-р сард 30 настай Грасиела Гомес Эрнандес…»
  const [d] = extractDates("Тухайлбал, 2025 оны 9-р сард 30 настай эмэгтэй хил давахыг оролдож…");
  assert.equal(d?.month, 9);
  assert.equal(d?.day, null, `өдөр олдсон: ${d?.text}`);
});

test("«сарын 21-нд» — өдөр зөв уншигдана", () => {
  const [d] = extractDates("2026 оны 9-р сарын 21-нд болов");
  assert.equal(d?.day, 21);
});

test("«сарын 3-ны» — өдөр зөв уншигдана", () => {
  assert.equal(extractDates("9 дүгээр сарын 3-ны өдөр")[0]?.day, 3);
});
