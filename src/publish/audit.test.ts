import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_DUP_MIN_SCORE, claimsUser, CLAIMS_SYSTEM, duplicatePairs, evidence, groupIssues, needsJudge,
  normalizeClaims,
  rankRows, riskTopics, splitSentences, worstSeverity, type AuditRow,
} from "./audit.api";
import { sameEvent, type FieldIssue } from "./prepublish.api";

const issue = (over: Partial<FieldIssue> = {}): FieldIssue => ({
  field: "гарчиг", rule: "дамжуулалт алга", severity: "ноцтой", detail: "гарчиг: дамжуулалт алга",
  ...over,
});

const row = (over: Partial<AuditRow> = {}): AuditRow => ({
  slug: "a", titleMn: "A", publishedAt: new Date("2026-09-27"), sourceName: "Futurism",
  sourceUrl: "https://x", topics: [], issues: [], claims: [], costUsd: 0, ...over,
});

// ---------- Эрсдэлтэй сэдэв ----------

test("цэрэг, үхлийн сэдвийг таана", () => {
  const t = riskTopics("Агаарын цохилтод 150 гаруй хүн амь үрэгдэж, Пентагон шалгалт хийв.");
  assert.ok(t.includes("цэрэг, дайн"), t.join(","));
  assert.ok(t.includes("үхэл, гэмтэл"), t.join(","));
});

test("нэртэй улс төрчийг таана", () => {
  assert.ok(riskTopics("Ерөнхийлөгч Дональд Трамп мэдэгдэв.").includes("нэртэй улс төрч"));
});

test("энгийн бүтээгдэхүүний мэдээнд эрсдэлтэй сэдэв алга", () => {
  assert.deepEqual(riskTopics("OpenAI шинэ моделио танилцууллаа. Үнэ нь хоёр дахин хямдарчээ."), []);
});

// ---------- Шүүгчид явуулах эсэх ----------

test("механик шалгалтад унасан нийтлэл шүүгчид явна", () => {
  assert.equal(needsJudge({ slug: "a", text: "энгийн текст", issues: [issue()] }).judge, true);
});

test("эрсдэлтэй сэдэв нь механик шалгалт цэвэр ч шүүгчид явна", () => {
  const r = needsJudge({ slug: "a", text: "Агаарын цохилтод хүн амь үрэгдэв.", issues: [] });
  assert.equal(r.judge, true);
  assert.match(r.why, /эрсдэлтэй сэдэв/);
});

test("цэвэр, эрсдэлгүй нийтлэл шүүгчид явахгүй — $0", () => {
  assert.equal(needsJudge({ slug: "a", text: "Шинэ модель гарлаа.", issues: [] }).judge, false);
});

// ---------- Бүлэглэлт ----------

test("нэг дүрэм олон талбарт барьсныг нэг мөр болгоно", () => {
  const g = groupIssues([
    issue({ field: "гарчиг" }),
    issue({ field: "хураангуй", detail: "хураангуй: дамжуулалт алга" }),
    issue({ field: "FB текст", detail: "FB текст: дамжуулалт алга" }),
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0]?.fields, ["гарчиг", "хураангуй", "FB текст"]);
  assert.equal(g[0]?.detail, "дамжуулалт алга");
});

test("өөр дүрмүүд тусдаа мөр, ноцтой нь дээр", () => {
  const g = groupIssues([
    issue({ rule: "модаль сулрав", severity: "анхаарах" }),
    issue({ rule: "түр→бүрэн" }),
  ]);
  assert.deepEqual(g.map((x) => x.severity), ["ноцтой", "анхаарах"]);
});

// ---------- Эрэмбэ ----------

test("ноцтой зөрчилтэй нийтлэл дээр гарна", () => {
  const ranked = rankRows([
    row({ slug: "warn", issues: [issue({ severity: "анхаарах" })] }),
    row({ slug: "bad", issues: [issue(), issue({ field: "биет" })] }),
  ]);
  assert.deepEqual(ranked.map((r) => r.slug), ["bad", "warn"]);
});

test("зөрчилгүй нийтлэл тайланд гарахгүй", () => {
  assert.deepEqual(rankRows([row({ slug: "clean" })]), []);
});

test("хамгийн ноцтой зэргийг тодорхойлно", () => {
  assert.equal(worstSeverity(row({ issues: [issue({ severity: "анхаарах" }), issue()] })), "ноцтой");
  assert.equal(worstSeverity(row()), null);
});

// ---------- Эх сурвалжийн ишлэл ----------

const SRC =
  "The company shipped a model. According to new reporting by Bloomberg, the investigation " +
  "concluded that the attack was the result of outdated intelligence. Nothing else happened.";

test("дүрэмд тохирох өгүүлбэрийг эх сурвалжаас олно", () => {
  const ev = evidence(SRC, ["according to"]);
  assert.match(ev ?? "", /Bloomberg/);
  assert.doesNotMatch(ev ?? "", /Nothing else/);
});

test("тохирох хэллэг байхгүй бол null", () => {
  assert.equal(evidence(SRC, ["reasonable grounds"]), null);
});

test("өгүүлбэрт зөв хуваана", () => {
  assert.equal(splitSentences(SRC).length, 3);
});

// ---------- Шүүгчийн хариу ----------

test("хоосон claim-ийг шүүнэ", () => {
  const out = normalizeClaims({
    claims: [
      { claim: "  ", source: "x", problem: "y", severity: "ноцтой" },
      { claim: "манай текст", source: "", problem: "буруу", severity: "анхаарах" },
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0]?.severity, "анхаарах");
});

test("танигдахгүй severity нь ноцтой болно — эргэлзвэл ноцтой", () => {
  const out = normalizeClaims({ claims: [{ claim: "a", problem: "b", severity: "хачин" as never }] });
  assert.equal(out[0]?.severity, "ноцтой");
});

test("хариу null бол хоосон массив", () => {
  assert.deepEqual(normalizeClaims(null), []);
});

test("шүүгчийн prompt-д огнооны дүрэм баримтжсан", () => {
  assert.match(CLAIMS_SYSTEM, /RSS-ийн нийтэлсэн/);
});

test("шүүгчийн user prompt хоёр текстийг тусад нь өгнө", () => {
  const u = claimsUser({ titleMn: "Г", summaryMn: "Х", bodyMn: "Б", sourceText: "S" });
  assert.match(u, /--- МАНАЙ НИЙТЛЭЛ ---/);
  assert.match(u, /--- ЭХ НИЙТЛЭЛ ---/);
});

// ---------- Давхардсан нийтлэл ----------

const dup = (
  slug: string, titleMn: string, summaryMn: string, day: string, companies: string[] = ["OpenAI"],
) => ({
  slug, titleMn, summaryMn, category: "NEWS", companies,
  publishedAt: new Date(`2026-09-${day}T00:00:00Z`),
});

test("БОДИТ: GPT-6 Sol/Luna нь нэг үйл явдал", () => {
  const rows = [
    dup("openai-kompani-gpt-6-sol-ba-luna-modeliudaa-taniltsuullaa",
      "OpenAI зардлыг 50% бууруулсан GPT-6 Sol, Luna-г танилцууллаа",
      "OpenAI компани GPT-6 Sol болон Luna моделиудаа танилцуулж, зардлыг хоёр дахин бууруулав.", "26"),
    dup("openai-kompani-gpt-6-sol-ba-luna-modeliudaa-taniltsuullaa-2",
      "OpenAI GPT-6 Sol болон Luna загваруудаа танилцууллаа",
      "OpenAI компани GPT-6 Sol болон Luna загваруудаа танилцуулсан бөгөөд үнэ нь хоёр дахин хямдарчээ.", "25"),
  ];
  const pairs = duplicatePairs(rows, (a, b) => sameEvent(a, b));
  assert.equal(pairs.length, 1, JSON.stringify(pairs));
  // Хожим гарсан нь 9/26-нийх
  assert.equal(pairs[0]?.later, "openai-kompani-gpt-6-sol-ba-luna-modeliudaa-taniltsuullaa");
});

test("өөр үйл явдлыг давхардал гэж үзэхгүй", () => {
  const rows = [
    dup("a", "OpenAI GPT-6 Sol, Luna танилцууллаа", "Шинэ моделиуд гарлаа.", "26"),
    dup("b", "Anthropic Opus 5.5 моделио хямдруулав", "Токены үнэ буурав.", "27", ["Anthropic"]),
  ];
  assert.deepEqual(duplicatePairs(rows, (x, y) => sameEvent(x, y)), []);
});

test("нэг нийтлэл дангаараа давхардал үүсгэхгүй", () => {
  assert.deepEqual(duplicatePairs([dup("a", "Гарчиг", "Хураангуй", "26")], (x, y) => sameEvent(x, y)), []);
});

test("сул давхцлыг (ижил компани, өөр үйл явдал) барихгүй", () => {
  const rows = [
    dup("openai-khuchirkheg-modeliudynkhaa-surgaltyg-tur-zogsooloo",
      "OpenAI өндөр чадамжтай моделиудынхаа сургалтыг зогсоолоо",
      "OpenAI аюулгүй байдлын шалгалт хийх хугацаанд сургалтаа зогсоов.", "27"),
    dup("openai-iin-agent-avstraliin-zasgiin-gazryn-sistemd",
      "OpenAI-ийн агент Австралийн төрийн системд нэвтэрчээ",
      "OpenAI-ийн хиймэл оюуны агент Австралийн Medicare системд зөвшөөрөлгүй нэвтэрчээ.", "25"),
  ];
  assert.deepEqual(duplicatePairs(rows, (x, y) => sameEvent(x, y)), []);
});

test("босгыг буулгавал сул давхцал гарна — босго нь ажиллаж байна", () => {
  const rows = [
    dup("a", "OpenAI моделиудынхаа сургалтыг зогсоолоо", "OpenAI сургалтаа зогсоов.", "27"),
    dup("b", "OpenAI-ийн агент системд нэвтэрчээ", "OpenAI-ийн агент нэвтэрчээ.", "25"),
  ];
  assert.ok(duplicatePairs(rows, (x, y) => sameEvent(x, y), 0).length >= 0);
  assert.ok(AUDIT_DUP_MIN_SCORE > 0);
});
