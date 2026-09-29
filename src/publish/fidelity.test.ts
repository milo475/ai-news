import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dropsModality, dropsSourceRelay, FIDELITY_BODY_CHARS, FIDELITY_SOURCE_CHARS, hardensLegal,
  inflections, relaySource, speculationVerdict,
  dropsAttribution, dropsHedge, dropsRelay, FIDELITY_DAILY_WARN, FIDELITY_SYSTEM, fidelitySystem,
  fidelityUser, hardensSpeculation, hasAssertion, hasAttribution, hasFinality, hasHedge, hasRelay,
  hasSpeculation, isUsableVerdict, keepsRelay, needsAttribution, normalizeVerdict,
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

// ---------- Жишээ 2: Futurism / Пентагон (2026-09-27) ----------

/** Эх нь Futurism, тэр нь Bloomberg-оос дамжуулсан. Тайлан нийтлэгдээгүй. */
const PENTAGON_SOURCE =
  "Bloomberg-ийн мэдээлснээр Пентагоны мөрдөн шалгалт хөлөг онгоцыг цохисон гэж дүгнэжээ. " +
  "Мөрдөн шалгалтын тайлан нийтлэгдээгүй бөгөөд шалгалт үргэлжилж байна.";

/** Трамп бичлэгийг «AI-аар үүсгэсэн байж болох» гэж САНАЛ БОЛГОСОН */
const TRUMP_SOURCE =
  "Трамп тухайн бичлэгийг хиймэл оюунаар үүсгэсэн байж болох гэж санал болгов. " +
  "Тэрээр эх хувилбарыг шалгуулах шаардлагатай гэж нэмж хэлэв.";

test("дамжуулсан эх сурвалжийг таана", () => {
  assert.equal(hasRelay(PENTAGON_SOURCE), true);
  assert.equal(hasRelay("Пентагон мэдэгдэл гаргав."), false);
  // Гаргалт талд өргөн жагсаалт: «мэдээлэв» ч дамжуулалт хэвээр
  assert.equal(keepsRelay("гэж Bloomberg мэдээлэв"), true);
  assert.equal(keepsRelay("Пентагон тогтоов"), false);
});

test("БОДИТ АЛДАА: «…цохисныг Пентагон тогтоов» — дамжуулалт алга", () => {
  assert.equal(dropsRelay("АНУ-ын хүчин завиудыг цохисныг Пентагон тогтоов", PENTAGON_SOURCE), true);
});

test("дамжуулалтаа хадгалсан гарчиг зөрчилгүй", () => {
  assert.equal(dropsRelay("Пентагон завиудыг цохисон гэж Bloomberg мэдээлэв", PENTAGON_SOURCE), false);
  assert.equal(dropsRelay("Bloomberg-ийн мэдээлснээр Пентагон завиудыг цохижээ", PENTAGON_SOURCE), false);
});

test("эх нь дамжуулаагүй бол шалгалт ажиллахгүй", () => {
  assert.equal(dropsRelay("Пентагон тогтоов", "Пентагон албан ёсны мэдэгдэл гаргав."), false);
});

test("таамаг ба баталгааг ялгана", () => {
  assert.equal(hasSpeculation(TRUMP_SOURCE), true);
  assert.equal(hasAssertion("Трамп бичлэгийг хуурамч гэж мэдэгдсэн"), true);
  assert.equal(hasAssertion("Трамп бичлэгийг хуурамч гэж үзэж байна"), false);
});

test("БОДИТ АЛДАА: «санал болгов» → «мэдэгдсэн»", () => {
  assert.equal(hardensSpeculation("Трамп бичлэгийг хуурамч гэж мэдэгдсэн", TRUMP_SOURCE), true);
  assert.equal(hardensSpeculation("Трамп бичлэг AI-аар хийгдсэн гэдгийг тогтоов", TRUMP_SOURCE), true);
});

test("таамгаа хадгалсан бол зөрчил биш", () => {
  assert.equal(
    hardensSpeculation("Трамп бичлэгийг AI-аар үүсгэсэн байж болзошгүй гэв", TRUMP_SOURCE),
    false,
  );
});

test("эх нь өөрөө баталгаатай бол зөөлрүүлэхийг шаардахгүй", () => {
  assert.equal(
    hardensSpeculation("Шүүх хуурамч болохыг тогтоов", "Шүүх бичлэгийг хуурамч болохыг тогтоов."),
    false,
  );
});

test("шүүгчийн prompt-д 8, 9 дэх зөрчлийн төрөл баримтжсан", () => {
  const sys = fidelitySystem("гарчиг");
  assert.match(sys, /ДАМЖУУЛСАН ЭХ СУРВАЛЖИЙГ ОРХИСОН/);
  assert.match(sys, /ТААМГИЙГ БАТАЛГАА БОЛГОСОН/);
  assert.match(sys, /Bloomberg/);
});

// ---------- Эх сурвалжтай шууд тулгах (2026-09-27, Пентагоны мэдээ) ----------

/** Futurism-ийн эх текстийн гол хэсэг */
const PENTAGON_EN =
  "According to new reporting by Bloomberg, the Pentagon's investigation into the " +
  "February 28th air strikes on the Shajareh Tayyebeh girls' school — a double-tap strike " +
  "which killed over 150 people, including at least 123 children — concluded that the attack " +
  "was the result of outdated intelligence and over-reliance on an AI targeting system. " +
  "Interviewed by Bloomberg, anonymous military investigators characterized the attack as a " +
  "series of small errors. Those errors seem to have been compounded by an as-yet unidentified " +
  "AI targeting system, likely similar to the one used to fast-track air strikes on over 2,000 " +
  "Iranian targets. In July, Trump downplayed the United States' responsibility, even suggesting " +
  "that images of the massacre could have been generated by AI. Yet as a UN fact-finding " +
  "commission wrote, there are \"reasonable grounds\" to conclude the US attacks amount to \"war crimes\".";

test("дамжуулсан хэвлэлийн нэрийг гаргаж авна", () => {
  assert.equal(relaySource(PENTAGON_EN), "Bloomberg");
});

test("«reported» гэсэн үг дангаараа дамжуулалт болохгүй", () => {
  assert.equal(relaySource("Several users reported issues with the app this week."), null);
});

test("өгүүлбэрийн эхний том үсгийг хэвлэлийн нэр гэж андуурахгүй", () => {
  assert.equal(relaySource("According to the documents, the system failed."), null);
});

test("БОДИТ АЛДАА: гарчиг Bloomberg-ийн давхаргыг хассан", () => {
  assert.equal(
    dropsSourceRelay("АНУ хиймэл оюунд найдаж сургууль цохисныг Пентагон тогтоов", PENTAGON_EN),
    true,
  );
});

test("хэвлэлийн нэрийг бичсэн бол дамжуулалт хадгалагдсан", () => {
  assert.equal(
    dropsSourceRelay("Bloomberg-ийн мэдээлснээр Пентагоны шалгалт ийм дүгнэлтэд хүрчээ", PENTAGON_EN),
    false,
  );
});

test("«гэж мэдээлэв» гэж бичсэн бол дамжуулалт хадгалагдсан", () => {
  // Хэвлэлийн нэр байхгүй ч дамжуулсан гэдэг нь уншигчид ойлгогдож байна
  assert.equal(
    dropsSourceRelay("Пентагоны шалгалт ийм дүгнэлтэд хүрсэн гэж мэдээлэв", PENTAGON_EN),
    false,
  );
});

test("БОДИТ АЛДАА: «likely similar» → «уг системтэй төстэй» (модаль алга)", () => {
  assert.equal(
    dropsModality(
      "Америкийн цэргийнхэн мөргөлдөөний эхэнд уг системтэй төстэй хиймэл оюун ашиглан " +
        "4 хоногийн дотор Ираны 2,000 гаруй байг оносон байна.",
      PENTAGON_EN,
    ),
    true,
  );
});

test("модалиа хадгалсан бол зөрчил биш", () => {
  assert.equal(
    dropsModality("…магадгүй уг системтэй төстэй хиймэл оюун ашигласан байж болзошгүй.", PENTAGON_EN),
    false,
  );
});

test("эх сурвалж болгоомжлолгүй бол модалийг шаардахгүй", () => {
  assert.equal(dropsModality("Компани моделио танилцууллаа.", "OpenAI released a new model today."), false);
});

test("БОДИТ АЛДАА: «reasonable grounds» → «бүрэн үндэслэлтэй»", () => {
  assert.equal(
    hardensLegal(
      "НҮБ-ын баримт шалгах комисс тус агаарын цохилтыг дайны гэмт хэрэг гэж үзэх бүрэн үндэслэлтэйг онцоллоо.",
      PENTAGON_EN,
    ),
    true,
  );
});

test("хуулийн болзолт утгыг хадгалсан бол зөрчил биш", () => {
  assert.equal(
    hardensLegal(
      "НҮБ-ын комисс дайны гэмт хэрэгт тооцох «үндэслэлтэй шалтгаан» байна гэж дүгнэжээ.",
      PENTAGON_EN,
    ),
    false,
  );
});

test("эх нь болзолт хэллэггүй бол шалгалт ажиллахгүй", () => {
  assert.equal(hardensLegal("Гэмт хэрэг болох нь бүрэн үндэслэлтэй.", "The court convicted him."), false);
});

// ---------- Үйл үгийн нөхцөл ----------

test("«тогтоолоо» — нөхцөлтэй хэлбэрийг таана", () => {
  assert.equal(hasAssertion("Пентагоны дотоод шалгалтаар … цохисныг тогтоолоо."), true);
});

test("«мэдэгдэж байсан» — нөхцөлтэй хэлбэрийг таана", () => {
  assert.equal(hasAssertion("бичлэгийг хуурамч дүрс гэж мэдэгдэж байсан"), true);
});

test("inflections нь үндсээс нөхцөл үүсгэнэ", () => {
  assert.ok(inflections("тогтоо").includes("тогтоолоо"));
  assert.ok(inflections("тогтоо").includes("тогтоов"));
});

// ---------- Нарийвчлалын засвар (2026-09-29 аудитаас) ----------

test("«бүрэн шийдэж чадахгүй» нь эцсийн шийдвэр БИШ", () => {
  // «Монголд юу гэсэн үг» хэсгийн зөв өгүүлбэрийг зөрчил гэж барьж байв
  assert.equal(hasFinality("Дэвшилтэт хяналтын систем дангаараа аюулгүй байдлыг бүрэн шийдэж чадахгүй."), false);
});

test("«бүрэн зогсоолоо» нь эцсийн шийдвэр мөн", () => {
  assert.equal(hasFinality("OpenAI сургалт болон үнэлгээгээ бүрэн зогсоолоо."), true);
});

test("дамжуулалтаа хадгалсан өгүүлбэрийг «таамаг→баталгаа» гэж барихгүй", () => {
  // Засварын ДАРАА: «Bloomberg-ийн мэдээлснээр … дүгнэжээ» нь бидний батлалт биш
  assert.equal(
    hardensSpeculation(
      "Bloomberg-ийн мэдээлснээр, АНУ-ын арми хиймэл оюунд хэт найдсанаас болж сургуулийг " +
        "бөмбөгдсөн гэж Пентагоны дотоод шалгалтаар дүгнэжээ.",
      PENTAGON_EN,
    ),
    false,
  );
});

test("дамжуулалтгүй батлан хэлсэн өгүүлбэрийг барина", () => {
  // Засварын ӨМНӨ
  assert.equal(
    hardensSpeculation(
      "АНУ-ын арми хиймэл оюунд хэт найдсанаас болж сургуулийг бөмбөгдсөнийг " +
        "Пентагоны дотоод шалгалтаар тогтоожээ.",
      PENTAGON_EN,
    ),
    true,
  );
});

test("нэг өгүүлбэр цэвэр ч нөгөө нь зөрчилтэй бол барина", () => {
  assert.equal(
    hardensSpeculation(
      "Bloomberg-ийн мэдээлснээр шалгалт үргэлжилж байна. Трамп бичлэгийг хуурамч гэж мэдэгдсэн.",
      PENTAGON_EN,
    ),
    true,
  );
});

// ---------- Ишлэлтэй мэдэгдэл: ноцтой vs анхаарах ----------

test("ИШЛЭЛГҮЙ батлан хэлсэн бол НОЦТОЙ", () => {
  assert.equal(
    speculationVerdict("АНУ-ын арми сургуулийг цохисныг Пентагон тогтоожээ.", PENTAGON_EN),
    "ноцтой",
  );
});

test("ИШЛЭЛТЭЙ бол АНХААРАХ — ишлэлийн хүчийг шүүгч шийднэ", () => {
  // Бодит худал эерэг: «…гэж Ерөнхий сайд мэдэгдэв» нь эх сурвалж дээр ч
  // тэр хүний хэлсэн үг байсан
  assert.equal(
    speculationVerdict(
      "OpenAI-ийн агент Medicare системд зөвшөөрөлгүй нэвтэрсэн гэж тус улсын Ерөнхий сайд мэдэгдэв.",
      PENTAGON_EN,
    ),
    "анхаарах",
  );
});

test("зөрчилгүй бол null", () => {
  assert.equal(speculationVerdict("Bloomberg-ийн мэдээлснээр шалгалт үргэлжилж байна.", PENTAGON_EN), null);
});

test("«эсэх» нь тодорхойгүйг илэрхийлнэ — батлалт биш", () => {
  assert.equal(
    speculationVerdict("AI систем аюулд орсон хүмүүсийг илрүүлсэн эсэх нь тодорхойгүй.", PENTAGON_EN),
    null,
  );
});

// ---------- Шүүгчид өгөх эх текстийн урт ----------

test("анхдагчаар биеийг 2,000 тэмдэгтээр таслана", () => {
  const u = fidelityUser({ hook: "г", titleMn: "т", summaryMn: "х", bodyMn: "a".repeat(9_000) });
  assert.equal(u.includes("a".repeat(2_000)), true);
  assert.equal(u.includes("a".repeat(2_001)), false);
});

test("эх сурвалжтай тулгах үед БҮТЭН текстийг өгнө", () => {
  // 2,000 тэмдэгтээр таслахад шүүгч «нийтлэлд ийм тоо байхгүй — зохиосон» гэж
  // ХУДАЛ зөрчил гаргаж байв (2026-09-30, 138 цагаачийн IG тайлбар)
  const u = fidelityUser({
    hook: "г", titleMn: null, summaryMn: null,
    bodyMn: "b".repeat(9_000), bodyChars: FIDELITY_SOURCE_CHARS,
  });
  assert.equal(u.includes("b".repeat(FIDELITY_SOURCE_CHARS)), true);
  assert.ok(FIDELITY_SOURCE_CHARS > FIDELITY_BODY_CHARS);
});
