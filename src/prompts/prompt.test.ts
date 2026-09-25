import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allFilled, chatGptUrl, checkSubmission, DAILY_SUBMIT_LIMIT, extractVariables, fillVariables,
  geminiUrl, MIN_BODY, pickOfDay, remainingToday, splitVariables, toSort,
} from "./prompt.api";
import { decide, REJECT_LABEL, type ModerationOutput } from "./moderate.api";
import { checkSeed, sanitizeSeed } from "./seed.api";
import { promptJsonLd } from "./seo.api";

const BODY = "Чи {компанийн нэр}-ийн санхүүч. {сарын орлого} төгрөгийн орлоготой сарын тайлан бич. {компанийн нэр}-ийн онцлогийг анхаар.";

test("extractVariables: давхардалгүй, бичигдсэн дараалалаар", () => {
  assert.deepEqual(extractVariables(BODY), ["компанийн нэр", "сарын орлого"]);
  assert.deepEqual(extractVariables("хувьсагчгүй текст"), []);
  assert.deepEqual(extractVariables("{ зайтай }"), ["зайтай"], "зай тайрагдана");
  assert.deepEqual(extractVariables("{}"), [], "хоосон хаалт тооцогдохгүй");
  assert.deepEqual(extractVariables("{мөр\nтаслалт}"), [], "мөр таслалттай нь хувьсагч биш");
  assert.deepEqual(extractVariables("{{давхар}}"), ["давхар"]);
});

test("fillVariables: бөглөсөн нь солигдоно, бөглөөгүй нь хэвээр", () => {
  const filled = fillVariables(BODY, { "компанийн нэр": "Гоё ХХК" });
  assert.ok(filled.includes("Гоё ХХК-ийн санхүүч"));
  assert.ok(filled.includes("{сарын орлого}"), "бөглөөгүй нүх хэвээр");
  assert.equal(filled.match(/Гоё ХХК/g)?.length, 2, "бүх давталт солигдоно");

  // Зөвхөн зай бол бөглөөгүйд тооцно
  assert.ok(fillVariables(BODY, { "сарын орлого": "   " }).includes("{сарын орлого}"));
  assert.equal(fillVariables("текст", { a: "b" }), "текст");

  assert.equal(allFilled(BODY, { "компанийн нэр": "A" }), false);
  assert.equal(allFilled(BODY, { "компанийн нэр": "A", "сарын орлого": "1 сая" }), true);
  assert.equal(allFilled("хувьсагчгүй", {}), true);
});

test("splitVariables: текстийг хэсэгчилж, хувьсагчийг тэмдэглэнэ", () => {
  const segs = splitVariables("Сайн уу {нэр}, баяртай");
  assert.deepEqual(segs, [
    { text: "Сайн уу ", variable: false },
    { text: "нэр", variable: true },
    { text: ", баяртай", variable: false },
  ]);
  // Эхлэл ба төгсгөлд хувьсагч
  assert.deepEqual(splitVariables("{a}"), [{ text: "a", variable: true }]);
  assert.deepEqual(splitVariables(""), []);
  // Задалсныг эргүүлж угсарвал эх текст гарна
  const joined = splitVariables(BODY).map((s) => (s.variable ? `{${s.text}}` : s.text)).join("");
  assert.equal(joined, BODY);
});

test("chatGptUrl / geminiUrl: текст зөв encode хийгдэнэ", () => {
  const url = chatGptUrl("Сайн уу & тест?");
  assert.ok(url.startsWith("https://chat.openai.com/?q="));
  assert.equal(decodeURIComponent(url.split("?q=")[1]!), "Сайн уу & тест?");
  assert.ok(geminiUrl("тест").startsWith("https://gemini.google.com/app?q="));
});

test("toSort: танигдахгүй утга «шинэ» болно", () => {
  assert.equal(toSort("huulsan"), "huulsan");
  assert.equal(toSort("taalagdsan"), "taalagdsan");
  assert.equal(toSort("гадны"), "shine");
  assert.equal(toSort(undefined), "shine");
});

test("checkSubmission: богино, урт, ангилалгүйг барина", () => {
  const ok = {
    title: "Сарын тайлан бичих",
    body: "х".repeat(MIN_BODY),
    description: "Санхүүчид зориулсан",
    category: "AJIL",
  };
  assert.deepEqual(checkSubmission(ok), []);

  const codes = (patch: Partial<typeof ok>) => checkSubmission({ ...ok, ...patch }).map((p) => p.code);
  assert.ok(codes({ title: "ab" }).includes("title-short"));
  assert.ok(codes({ title: "х".repeat(81) }).includes("title-long"));
  assert.ok(codes({ body: "богино" }).includes("body-short"));
  assert.ok(codes({ body: "х".repeat(4_001) }).includes("body-long"));
  assert.ok(codes({ description: "х".repeat(201) }).includes("description-long"));
  assert.ok(codes({ category: "БАЙХГҮЙ" }).includes("bad-category"));
});

test("remainingToday: өдрийн хязгаар", () => {
  assert.equal(DAILY_SUBMIT_LIMIT, 5);
  assert.equal(remainingToday(0), 5);
  assert.equal(remainingToday(4), 1);
  assert.equal(remainingToday(5), 0);
  assert.equal(remainingToday(9), 0, "сөрөг болохгүй");
});

test("pickOfDay: өдөр бүр дараагийнх, мөчлөгөөр эргэнэ", () => {
  const items = ["a", "b", "c"];
  const day = (iso: string) => new Date(iso);

  const d1 = pickOfDay(items, day("2026-09-25T00:00:00Z"));
  const d2 = pickOfDay(items, day("2026-09-26T00:00:00Z"));
  const d3 = pickOfDay(items, day("2026-09-27T00:00:00Z"));
  assert.equal(new Set([d1, d2, d3]).size, 3, "3 өдөрт 3 өөр");
  assert.equal(pickOfDay(items, day("2026-09-28T00:00:00Z")), d1, "4 дэх өдөр эргэнэ");

  // Нэг өдрийн дотор тогтвортой
  assert.equal(pickOfDay(items, day("2026-09-25T23:00:00Z")), d1);
  assert.equal(pickOfDay([], day("2026-09-25T00:00:00Z")), null);
  assert.equal(pickOfDay(["ганц"], day("2026-09-26T00:00:00Z")), "ганц");
});

test("moderation: илт муу нь REJECTED, бусад нь PENDING", () => {
  const base: ModerationOutput = {
    ok: true, reason: "ok", explanation: "Зүгээр.", category: "AJIL", language: "MN",
  };

  // Хэвийн — админ шалгана
  const good = decide(base);
  assert.equal(good.status, "PENDING");
  assert.equal(good.rejectReason, null);
  assert.equal(good.category, "AJIL");

  // Илт муу — шууд татгалзана, шалтгаан нь монголоор
  for (const reason of ["spam", "unsafe", "nonsense", "not-prompt", "language"] as const) {
    const bad = decide({ ...base, ok: false, reason, explanation: "Тайлбар." });
    assert.equal(bad.status, "REJECTED", reason);
    assert.ok(bad.rejectReason!.startsWith(REJECT_LABEL[reason]), reason);
    assert.ok(bad.rejectReason!.includes("Тайлбар."));
  }

  // Танигдахгүй шалтгаан — хэрэглэгчийг шийтгэхгүй
  const unknown = decide({ ...base, ok: false, reason: "гадны" as never, explanation: "?" });
  assert.equal(unknown.status, "PENDING");

  // LLM дуудлага унасан — PENDING
  assert.deepEqual(decide(null), { status: "PENDING", rejectReason: null });

  // Тайлбаргүй бол зөвхөн шошго
  assert.equal(decide({ ...base, ok: false, reason: "spam", explanation: "" }).rejectReason, REJECT_LABEL.spam);
});

test("checkSeed: үгийн тоо, хувьсагчийн тоог шалгана", () => {
  const body = Array.from({ length: 80 }, () => "үг").join(" ");
  const draft = { title: "Тайлан бичих", description: "Тайлбар", body, tools: ["ChatGPT"] };
  assert.deepEqual(checkSeed(draft, ["а", "б"]), []);

  const codes = (d: Partial<typeof draft>, vars = ["а", "б"]) =>
    checkSeed({ ...draft, ...d }, vars).map((p) => p.code);
  assert.ok(codes({ body: "богино" }).includes("few-words"));
  assert.ok(codes({ body: Array.from({ length: 300 }, () => "үг").join(" ") }).includes("many-words"));
  assert.ok(codes({}, ["ганц"]).includes("no-variables"));
  assert.ok(codes({ title: "х".repeat(61) }).includes("title-long"));
  assert.ok(codes({ title: "Тайлан 🚀" }).includes("emoji"));
  assert.deepEqual(codes({ body: "" }), ["empty"], "хоосон бол цааш шалгахгүй");
});

test("sanitizeSeed: emoji арилна, prompt-ийн мөр таслалт хэвээр", () => {
  const clean = sanitizeSeed({
    title: "  Тайлан 🚀  бичих ",
    description: "х".repeat(250),
    body: "Эхний мөр 🎯\n\nХоёр дахь мөр",
    tools: [" ChatGPT ", ""],
  });
  assert.equal(clean.title, "Тайлан бичих");
  assert.equal(clean.description.length, 200);
  assert.equal(clean.body, "Эхний мөр\n\nХоёр дахь мөр");
  assert.deepEqual(clean.tools, ["ChatGPT"]);
});

test("promptJsonLd: CreativeWork бүтэц", () => {
  const ld = promptJsonLd(
    {
      slug: "tailan-bichih", title: "Тайлан бичих", description: "Санхүүчид",
      body: BODY, authorName: null, isSite: true,
      publishedAt: new Date("2026-09-20T00:00:00Z"), updatedAt: new Date("2026-09-25T00:00:00Z"),
    },
    "https://ai-news.mn/",
  );
  assert.equal(ld["@type"], "CreativeWork");
  assert.equal(ld.url, "https://ai-news.mn/prompt/tailan-bichih");
  assert.equal(ld.text, BODY);
  assert.equal(ld.inLanguage, "mn");
  assert.deepEqual(ld.author, { "@type": "Organization", name: "AI News" });
  assert.equal(ld.datePublished, "2026-09-20T00:00:00.000Z");
  assert.ok(JSON.parse(JSON.stringify(ld)));

  const byUser = promptJsonLd(
    {
      slug: "x", title: "T", description: "d", body: "b", authorName: "Болд", isSite: false,
      publishedAt: null, updatedAt: new Date("2026-09-25T00:00:00Z"),
    },
    "https://ai-news.mn",
  );
  assert.deepEqual(byUser.author, { "@type": "Person", name: "Болд" });
  assert.ok(!("datePublished" in byUser));
});
