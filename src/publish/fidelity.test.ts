import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dropsAttribution, dropsHedge, FIDELITY_DAILY_WARN, FIDELITY_SYSTEM, fidelitySystem, fidelityUser,
  hasAttribution, hasFinality, hasHedge, isUsableVerdict, needsAttribution, normalizeVerdict,
} from "./fidelity.api";
import { judgeFidelity } from "./fidelity";

// ——— 2026-09-27-ны production дээр гарсан 3 бодит жишээ ———

/** 1. Буруутгалыг баримт болгосон */
const LAWSUIT = {
  titleMn: "Муж ChatGPT-ийг буудалцаанд хүргэсэн гэж үзэн OpenAI-г шүүхэд өгчээ",
  summaryMn:
    "Нэгэн мужийн прокурор ChatGPT-тэй хийсэн харилцан яриа нь сургууль дээрх буудалцаанд " +
    "нөлөөлсөн гэж үзэн OpenAI компанийг шүүхэд өгсөн байна.",
  bodyMn: null,
};
const LAWSUIT_BAD = "Сургууль дээр гарсан зэвсэгт халдлагад хүүхдийн ашигладаг чатбот хүртэл нөлөөлжээ.";
const LAWSUIT_GOOD = "Чатботын яриа халдлагад хүргэсэн гэж үзэн муж OpenAI-г шүүхэд өгчээ.";

/** 2. Шалтгаан-үр дагаврыг зохиосон («эрдэмтдийн оронд») */
const ENZYME = {
  titleMn: "Anthropic шинэ ферментийн систем илрүүлснээ зарлав",
  summaryMn: "Anthropic компани 950 хиймэл оюуны агент ажиллуулж шинэ ферментийн систем илрүүлснээ зарлалаа.",
  bodyMn: null,
};
const ENZYME_BAD = "Эрдэмтдийн оронд 950 хиймэл оюун генийн шинэ бүтцийг олжээ.";

/** 3. Хамрах хүрээ, тоог гуйвуулсан */
const ACADEMY = {
  titleMn: "AI Academy-ийн баг олон улсын шалгаруулалтын нэг төрөлд дэд байр эзэллээ",
  summaryMn: "1,500 оролцогчтой олон улсын шалгаруулалтын нэг төрөлд монгол баг дэд байр эзэлсэн байна.",
  bodyMn: null,
};
const ACADEMY_BAD = "Монгол баг дэлхийн 1,500 төслөөс хоёрт шалгарчээ.";

test("needsAttribution: буруутгал, мэдэгдэл, судалгааг таньна", () => {
  assert.equal(needsAttribution(LAWSUIT.summaryMn), true, "шүүхэд өгсөн");
  assert.equal(needsAttribution(ENZYME.summaryMn), true, "зарлалаа");
  assert.equal(needsAttribution("Судалгаагаар 40 хувь нь ингэж хэлсэн."), true);
  assert.equal(needsAttribution("Шинэ загвар 40 хувиар хурдан болжээ."), false);
});

test("hasAttribution: гарчигт ишлэл үлдсэн эсэх", () => {
  assert.equal(hasAttribution(LAWSUIT_GOOD), true);
  assert.equal(hasAttribution(LAWSUIT_BAD), false);
  assert.equal(hasAttribution("Anthropic шинэ систем илрүүлснээ зарлав."), true);
});

test("dropsAttribution: жишээ 1 — буруутгалыг баримт болгосныг LLM-гүйгээр барина", () => {
  assert.equal(dropsAttribution(LAWSUIT_BAD, LAWSUIT.summaryMn), true);
  assert.equal(dropsAttribution(LAWSUIT_GOOD, LAWSUIT.summaryMn), false);
  // Эх мэдээ нь буруутгал биш бол шаардахгүй
  assert.equal(dropsAttribution("Загвар 40 хувиар хурдан болжээ.", "Загвар 40 хувиар хурдан болсон."), false);
});

test("judgeFidelity: механик шалгалт LLM-д хүрэлгүй зогсооно", async () => {
  let calls = 0;
  const chat = (async () => { calls++; return { data: { faithful: true, issues: [] }, tokens: 0, costUsd: 0 }; }) as never;

  const v = await judgeFidelity({ hook: LAWSUIT_BAD, ...LAWSUIT }, { chat });
  assert.equal(v.ok, true, "механик шалгалт бол шийдвэр мөн");
  assert.equal(v.faithful, false);
  assert.match(v.issues[0]!, /буруутгал|эх сурвалж/i);
  assert.equal(calls, 0, "механик барьсан бол LLM дуудахгүй");
});

test("judgeFidelity: жишээ 2 — «зарлав»-ыг орхисныг механик барина", async () => {
  let calls = 0;
  const chat = (async () => { calls++; return { data: { faithful: true, issues: [] }, tokens: 0, costUsd: 0 }; }) as never;

  // Эх мэдээ «Anthropic ... зарлалаа», гарчиг нь батлан хэлсэн
  const v = await judgeFidelity({ hook: ENZYME_BAD, ...ENZYME }, { chat });
  assert.equal(v.faithful, false);
  assert.equal(calls, 0);
});

test("judgeFidelity: жишээ 3 — механик давдаг тул LLM шүүгч шийднэ", async () => {
  let seen = "";
  const chat = (async (o: { user: string }) => {
    seen = o.user;
    return {
      data: { faithful: false, issues: ["1,500 нь оролцогчийн тоо, төслийн тоо биш."] },
      tokens: 10, costUsd: 0.0001,
    };
  }) as never;

  // Эх мэдээнд буруутгал/мэдэгдлийн шинж алга — LLM хүртэл очно
  const v = await judgeFidelity({ hook: ACADEMY_BAD, ...ACADEMY }, { chat });
  assert.equal(v.ok, true);
  assert.equal(v.faithful, false);
  assert.equal(v.issues.length, 1);
  assert.equal(v.costUsd, 0.0001);
  assert.match(seen, /1,500 оролцогчтой/, "нийтлэл шүүгчид очсон байх ёстой");
});

test("judgeFidelity: шүүгч унавал ҮНЭНЧ ГЭЖ ТООЦОХГҮЙ (ok=false)", async () => {
  const chat = (async () => { throw new Error("сүлжээ тасарлаа"); }) as never;
  const v = await judgeFidelity({ hook: "Ямар нэг гарчиг.", titleMn: "Т", summaryMn: "Х", bodyMn: null }, { chat });
  // Шалгагдаагүй гарчгийг нийтэд гаргахгүй — дуудагч нь нийтлэлийн гарчгийг ашиглана
  assert.equal(v.ok, false);
  assert.equal(v.faithful, false);
  assert.equal(v.costUsd, 0);
});

test("judgeFidelity: дутуу/хоосон хариу ч шийдвэр биш", async () => {
  for (const bad of [{}, { faithful: "тийм" }, { issues: [] }, { faithful: true }, null]) {
    const chat = (async () => ({ data: bad, tokens: 0, costUsd: 0.0001 })) as never;
    const v = await judgeFidelity({ hook: "Г.", titleMn: "Т", summaryMn: "Х", bodyMn: null }, { chat });
    assert.equal(v.ok, false, JSON.stringify(bad));
    assert.equal(v.faithful, false);
  }
});

test("isUsableVerdict: faithful нь boolean, issues нь массив байх ёстой", () => {
  assert.equal(isUsableVerdict({ faithful: true, issues: [] }), true);
  assert.equal(isUsableVerdict({ faithful: false, issues: ["a"] }), true);
  assert.equal(isUsableVerdict({ faithful: true }), false, "issues дутуу");
  assert.equal(isUsableVerdict({ issues: [] }), false, "faithful дутуу");
  assert.equal(isUsableVerdict(null), false);
  assert.equal(FIDELITY_DAILY_WARN, 3);
});

test("normalizeVerdict: issues байвал faithful=true гэж тооцохгүй", () => {
  assert.deepEqual(normalizeVerdict({ faithful: true, issues: [] }), { faithful: true, issues: [] });
  // Загвар заримдаа зөрчил жагсаад faithful=true гэдэг
  assert.deepEqual(normalizeVerdict({ faithful: true, issues: ["зөрчил"] }), { faithful: false, issues: ["зөрчил"] });
  assert.deepEqual(normalizeVerdict(null), { faithful: false, issues: [] });
  assert.deepEqual(normalizeVerdict({ faithful: false, issues: ["  a  ", "", "b"] }), { faithful: false, issues: ["a", "b"] });
});

test("fidelityUser: гарчиг ба нийтлэл хоёулаа prompt-д орно", () => {
  const u = fidelityUser({ hook: "Г", ...ACADEMY });
  assert.match(u, /ШАЛГАХ ГАРЧИГ: Г/);
  assert.match(u, /1,500 оролцогчтой/);
});

test("FIDELITY_SYSTEM: 3 бодит жишээний дүрэм бүгд prompt дотор", () => {
  for (const rule of ["НЭМСЭН БАРИМТ", "БУРУУТГАЛЫГ БАРИМТ БОЛГОСОН", "ШАЛТГААН-ҮР ДАГАВРЫГ ЗОХИОСОН",
                      "ХАМРАХ ХҮРЭЭГ ӨӨРЧИЛСӨН", "ТООГ КОНТЕКСТООС НЬ САЛГАСАН"]) {
    assert.ok(FIDELITY_SYSTEM.includes(rule), rule);
  }
});

export { LAWSUIT, LAWSUIT_BAD, LAWSUIT_GOOD, ENZYME, ENZYME_BAD, ACADEMY, ACADEMY_BAD };

// ---------- «түр зогсоосон» → «зогсоолоо» (2026-09-27-ны production алдаа) ----------

const PAUSE_SOURCE =
  "OpenAI шинэ загварынхаа сургалтыг түр зогсоов. Компани аюулгүй байдлын шалгалт " +
  "дуусмагц хэдэн долоо хоногийн дараа үргэлжлүүлнэ гэж мэдэгдэв.";

test("эх мэдээний hedge-ийг таана", () => {
  assert.equal(hasHedge(PAUSE_SOURCE), true);
  assert.equal(hasHedge("Google загвараа бүрмөсөн хаалаа."), false);
  assert.equal(hasHedge("Зарим бүс нутагт үйлчилгээг хязгаарлав."), true);
});

test("эцсийн өнгө аяс бүхий үгсийг таана", () => {
  assert.equal(hasFinality("OpenAI сургалтыг зогсоолоо"), true);
  assert.equal(hasFinality("сургалт болон үнэлгээгээ бүрэн зогсоолоо"), true);
  assert.equal(hasFinality("OpenAI сургалтаа үргэлжлүүлнэ"), false);
});

test("«түр»-ийг хассан гарчгийг зөрчил гэж үзнэ", () => {
  // Нийтлэлийн бодит гарчиг: «…сургалтыг зогсоолоо» (slug нь -tur- гүй байсан)
  assert.equal(dropsHedge("OpenAI шинэ загварын сургалтыг зогсоолоо", PAUSE_SOURCE), true);
  // FB/IG текст нь бүр өргөжүүлсэн
  assert.equal(
    dropsHedge("OpenAI сургалт болон үнэлгээгээ бүрэн зогсоолоо", PAUSE_SOURCE),
    true,
  );
});

test("«түр»-ээ хадгалсан бол зөрчил биш", () => {
  assert.equal(dropsHedge("OpenAI сургалтаа түр зогсоов", PAUSE_SOURCE), false);
  assert.equal(dropsHedge("OpenAI сургалтаа хэсэг хугацаанд зогсоов", "OpenAI түр зогсоов"), true);
});

test("эх мэдээ өөрөө эцсийн бол зөрчил биш", () => {
  assert.equal(dropsHedge("Google загвараа зогсоолоо", "Google загвараа бүрмөсөн хаалаа."), false);
});

test("шүүгчийн prompt шалгаж буй зүйлийн төрлийг агуулна", () => {
  assert.match(fidelitySystem("гарчиг"), /ГАРЧИГ нь эх нийтлэлдээ үнэнч/);
  assert.match(fidelitySystem("FB текст"), /FB ТЕКСТ нь эх нийтлэлдээ үнэнч/);
  assert.match(fidelitySystem("IG тайлбар"), /IG ТАЙЛБАР нь эх нийтлэлдээ үнэнч/);
  // Тэмдэглэгээ үлдэх ёсгүй
  assert.ok(!fidelitySystem("гарчиг").includes("{{KIND}}"));
  // 7 дахь зөрчлийн төрөл баримтжсан эсэх
  assert.match(fidelitySystem("гарчиг"), /ТҮР \/ ХЭСЭГЧИЛСЭНИЙГ БҮРЭН/);
});

test("шалгах текстийн төрөл user prompt-д гарна", () => {
  const u = fidelityUser({
    hook: "тест", kind: "FB текст", titleMn: "Гарчиг", summaryMn: null, bodyMn: null,
  });
  assert.match(u, /ШАЛГАХ FB ТЕКСТ: тест/);
  // Төрөл заагаагүй бол гарчиг
  assert.match(
    fidelityUser({ hook: "тест", titleMn: null, summaryMn: null, bodyMn: null }),
    /ШАЛГАХ ГАРЧИГ/,
  );
});
