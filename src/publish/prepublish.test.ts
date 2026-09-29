import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blocking, bodyWithoutSections, canRepair, checkAge, checkBeforePublish, checkDuplicate,
  DEFAULT_NEWS_MAX_AGE_H, mdSections, offendingSentence, sectionText, sourceNeedles,
  type FieldIssue,
  EVENT_JACCARD, EVENT_SHARED_STEMS, newsMaxAgeHours, TIMELESS_CATEGORIES,
  factTokens, MIN_NEW_FACTS, newFactsVs, RECENT_HOURS, sameEvent,
  UPDATE_PREFIX, withUpdatePrefix, type RecentArticle,
} from "./prepublish.api";

// ---------- 1. Механик fidelity ----------

/** 2026-09-27-ны бодит эх мэдээ */
const PAUSE = {
  titleMn: "OpenAI өндөр чадамжтай моделиудынхаа сургалтыг түр зогсоов",
  summaryMn: "OpenAI аюулгүй байдлын шалгалт хийх хугацаанд сургалтаа түр зогсоов.",
  bodyMn: "Компани хэдэн долоо хоногийн дараа үргэлжлүүлнэ. Энэ нь салбарын хэвийн практик юм.",
};

test("бэлэн картын гарчиг «түр»-гүй бол барина", () => {
  // fe6907e-ээс ӨМНӨ үүссэн карт
  const issues = checkBeforePublish({
    ...PAUSE,
    fbHook: "AI агент төрийн системд халдсанаар OpenAI сургалтаа зогсоов",
    fbText: null,
  });
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0]?.field, "картын гарчиг");
  assert.equal(issues[0]?.rule, "түр→бүрэн");
});

test("FB текст «бүрэн зогсоолоо» бол барина", () => {
  const issues = checkBeforePublish({
    ...PAUSE,
    fbHook: null,
    fbText: "OpenAI сургалт болон үнэлгээгээ бүрэн зогсоолоо. Салбарт том өөрчлөлт болох нь.",
  });
  assert.deepEqual(issues.map((i) => i.field), ["FB текст"]);
});

test("hedge-ээ хадгалсан бол зөрчилгүй", () => {
  assert.deepEqual(
    checkBeforePublish({
      ...PAUSE,
      fbHook: "OpenAI сургалтаа түр зогсоолоо",
      fbText: "OpenAI шалгалт хийх хугацаанд сургалтаа түр зогсоов. Хэдэн долоо хоногийн дараа үргэлжилнэ.",
    }),
    [],
  );
});

test("дамжуулсан эх сурвалж алга бол барина", () => {
  const issues = checkBeforePublish({
    titleMn: "Пентагон завиудыг цохисныг тогтоов",
    summaryMn: "Bloomberg-ийн мэдээлснээр Пентагоны шалгалт ийнхүү дүгнэжээ.",
    bodyMn: "Тайлан нийтлэгдээгүй байна.",
    fbHook: null,
    fbText: null,
  });
  assert.ok(issues.some((i) => i.rule === "дамжуулалт алга"), JSON.stringify(issues));
});

test("таамгийг баталгаа болгосныг барина", () => {
  const issues = checkBeforePublish({
    titleMn: "Асуудал гарсан",
    summaryMn: "Трамп бичлэгийг хиймэл оюунаар үүсгэсэн байж болох гэж санал болгов.",
    bodyMn: "Эх хувилбарыг шалгуулах шаардлагатай гэв.",
    fbHook: "Трамп бичлэгийг хуурамч гэж мэдэгдсэн",
    fbText: null,
  });
  assert.ok(issues.some((i) => i.field === "картын гарчиг" && i.rule === "таамаг→баталгаа"));
});

test("хоосон талбарыг шалгахгүй", () => {
  assert.deepEqual(
    checkBeforePublish({ ...PAUSE, fbHook: "  ", fbText: null }),
    [],
  );
});

test("нийтлэлийн өөрийн гарчиг зөрчилтэй бол карт дахин үүсгээд нэмэргүй", () => {
  const titleBroken = checkBeforePublish({
    titleMn: "OpenAI сургалтаа бүрэн зогсоолоо",
    summaryMn: "OpenAI сургалтаа түр зогсоов.",
    bodyMn: "Хэдэн долоо хоногийн дараа үргэлжилнэ.",
    fbHook: null, fbText: null,
  });
  assert.ok(titleBroken.some((i) => i.field === "гарчиг"));
  assert.equal(canRepair(titleBroken), false);

  const cardBroken = checkBeforePublish({ ...PAUSE, fbHook: "OpenAI сургалтаа зогсоолоо", fbText: null });
  assert.equal(canRepair(cardBroken), true);
  assert.equal(canRepair([]), false, "зөрчилгүй бол засварлах юм алга");
});

// ---------- 2. Ижил үйл явдлын давхардал ----------

const A: RecentArticle = {
  slug: "openai-agent-53-zurag",
  titleMn: "OpenAI-ийн агентууд хэрэглэгчийн 53 зургийг алдагдуулжээ",
  summaryMn: "OpenAI-ийн агент систем хэрэглэгчийн 53 зургийг гуравдагч этгээдэд задруулсан байна.",
  category: "RISK",
  companies: ["OpenAI"],
};

const B: RecentArticle = {
  slug: "openai-surgaltaa-tur-zogsoov",
  titleMn: "OpenAI өндөр чадамжтай моделиудынхаа сургалтыг түр зогсоолоо",
  summaryMn: "OpenAI аюулгүй байдлын шалгалт хийх хугацаанд сургалтаа түр зогсоов.",
  category: "RISK",
  companies: ["OpenAI"],
};

/** Гурав дахь ноорог — өмнөх хоёрын үргэлжлэл */
const C: RecentArticle = {
  slug: "ai-agent-toriin-system",
  titleMn: "AI агент төрийн системд халдсанаар OpenAI сургалтаа зогсоов",
  summaryMn: "OpenAI-ийн агент төрийн системд зөвшөөрөлгүй хандсаны дараа сургалтаа түр зогсоов.",
  category: "RISK",
  companies: ["OpenAI"],
};

test("нэг үйл явдлын хоёр нийтлэлийг таана", () => {
  const r = sameEvent(C, B);
  assert.equal(r.same, true, `оноо ${r.score}`);
});

test("өөр үйл явдлыг нэгтгэхгүй", () => {
  const other: RecentArticle = {
    slug: "eu-journal",
    titleMn: "Европын холбоо хиймэл оюуны шинэ журам баталлаа",
    summaryMn: "Журам нь өндөр эрсдэлт системд тавигдах шаардлагыг чангатгана.",
    category: "RISK",
    companies: ["European Commission"],
  };
  assert.equal(sameEvent(B, other).same, false);
});

test("ижил компани + ижил ангилалд үндсийн тоогоор шийднэ", () => {
  const r = sameEvent(C, B);
  assert.ok(r.shared >= EVENT_SHARED_STEMS, `${r.shared} үндэс`);
  assert.equal(EVENT_JACCARD, 0.4);
  assert.equal(RECENT_HOURS, 48);

  // Компани таарахгүй бол зөвхөн үгийн давхцлаар — үндсийн тоо хангалтгүй
  const otherCompany = { ...C, companies: ["Google"] };
  assert.equal(sameEvent(otherCompany, B).same, false, "өөр компанийг нэгтгэх ёсгүй");
});

test("баримтын тэмдэгтүүдийг ялгана", () => {
  const t = factTokens("OpenAI 53 зургийг 12 хувиар нэмэгдүүлсэн GPT-6 дээр");
  assert.ok(t.has("53"));
  assert.ok(t.has("gpt-6"));
  assert.ok(t.has("openai"));
  // Нэг оронтой тоо баримт биш
  assert.ok(!factTokens("3 дахь").has("3"));
});

test("шинэ баримтыг олно", () => {
  const facts = newFactsVs(A, B);
  assert.ok(facts.includes("53"), facts.join(","));
  assert.equal(MIN_NEW_FACTS, 1);
});

test("зөвхөн ойр үйл явдлыг нэгтгэнэ — сэдэв нь өөр бол үгүй", () => {
  // A нь өгөгдөл задарсан тухай, B нь сургалт зогссон тухай — ӨӨР үйл явдал
  assert.equal(sameEvent(A, B).same, false, "хоёр өөр мэдээг нэгтгэх ёсгүй");
});

test("шинэ баримтгүй давхардлыг алгасна", () => {
  const same: RecentArticle = { ...B, slug: "duplicate", titleMn: B.titleMn, summaryMn: B.summaryMn };
  const v = checkDuplicate(same, [B]);
  assert.equal(v.action, "skip");
  assert.equal(v.match?.slug, B.slug);
  assert.match(v.reason, /шинэ баримтгүй/);
});

test("ижил үйл явдал, шинэ баримтгүй бол алгасна", () => {
  // Бодит тохиолдол: C нь B-ийн давтагдал, шинэ тоо баримт нэмээгүй
  const v = checkDuplicate(C, [B]);
  assert.equal(v.action, "skip", JSON.stringify(v));
  assert.equal(v.match?.slug, B.slug);
});

test("ижил үйл явдал, шинэ баримттай бол «Шинэчлэл:» болно", () => {
  const withNumber: RecentArticle = {
    ...C,
    titleMn: "AI агент төрийн системд халдсанаар OpenAI сургалтаа зогсоов",
    summaryMn: "OpenAI-ийн агент төрийн системд зөвшөөрөлгүй хандаж 1200 бичлэгийг үзсэний дараа сургалтаа түр зогсоов.",
  };
  const v = checkDuplicate(withNumber, [B]);
  assert.equal(v.action, "update", JSON.stringify(v));
  assert.ok(v.newFacts.includes("1200"), v.newFacts.join(","));
  assert.match(v.reason, /үргэлжлэл/);
});

test("давхардалгүй бол хэвийн нийтлэгдэнэ", () => {
  const v = checkDuplicate(B, []);
  assert.equal(v.action, "publish");
  assert.equal(v.match, null);
});

test("өөрийгөө давхардал гэж үзэхгүй", () => {
  assert.equal(checkDuplicate(B, [B]).action, "publish");
});

test("«Шинэчлэл:» угтвар давхардахгүй", () => {
  assert.equal(withUpdatePrefix("Гарчиг"), `${UPDATE_PREFIX}Гарчиг`);
  assert.equal(withUpdatePrefix(`${UPDATE_PREFIX}Гарчиг`), `${UPDATE_PREFIX}Гарчиг`);
});

test("монгол нөхцөл нь «шинэ баримт» болохгүй", () => {
  // «OpenAI-ийн» ба «OpenAI» нь нэг л нэр
  const t = factTokens("OpenAI-ийн агент");
  assert.ok(t.has("openai"), [...t].join(","));
  assert.ok(!t.has("openai-"), [...t].join(","));
  assert.deepEqual(
    newFactsVs(
      { slug: "x", titleMn: "OpenAI-ийн агент", summaryMn: "", category: "RISK", companies: [] },
      { slug: "y", titleMn: "OpenAI агент", summaryMn: "", category: "RISK", companies: [] },
    ),
    [],
  );
});

// ---------- Хуучирсан мэдээ ----------

const NOW = new Date("2026-09-29T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

test("хязгаарын анхдагч нь хэмжилтэд тулгуурласан", () => {
  // Дарааллыг (RSS 48ц, шинэлэг байдлын жин) зассаны дараа симуляцаар
  // p90 = 56.9ц болсон тул 120-оос 72 болгов — npm run publish:sim
  assert.equal(DEFAULT_NEWS_MAX_AGE_H, 72);
  assert.equal(newsMaxAgeHours({} as unknown as NodeJS.ProcessEnv), 72);
  assert.equal(newsMaxAgeHours({ NEWS_MAX_AGE_H: "48" } as unknown as NodeJS.ProcessEnv), 48);
  assert.equal(newsMaxAgeHours({ NEWS_MAX_AGE_H: "муу" } as unknown as NodeJS.ProcessEnv), 72);
});

test("хуучирсан мэдээг хаана", () => {
  const fresh = checkAge({ category: "NEWS", publishedAtSource: hoursAgo(20), now: NOW });
  assert.equal(fresh.stale, false);

  // Бодит тохиолдол: Muse zero-day, эх сурвалж 181 цагийн өмнөх
  const old = checkAge({ category: "NEWS", publishedAtSource: hoursAgo(181), now: NOW });
  assert.equal(old.stale, true);
  assert.equal(old.hours, 181);
  assert.match(old.reason!, /181ц \(8 хоног\) хуучин/);
});

test("яг хязгаар дээр өнгөрнө", () => {
  assert.equal(checkAge({ category: "NEWS", publishedAtSource: hoursAgo(72), now: NOW }).stale, false);
  assert.equal(checkAge({ category: "NEWS", publishedAtSource: hoursAgo(73), now: NOW }).stale, true);
});

test("HOWTO, FACT-д хугацаа хамаарахгүй", () => {
  for (const category of ["HOWTO", "FACT"]) {
    const v = checkAge({ category, publishedAtSource: hoursAgo(500), now: NOW });
    assert.equal(v.stale, false, category);
  }
  assert.ok(TIMELESS_CATEGORIES.has("HOWTO"));
  // Бусад ангилалд хамаарна
  for (const category of ["NEWS", "RISK", "BUSINESS"]) {
    assert.equal(checkAge({ category, publishedAtSource: hoursAgo(500), now: NOW }).stale, true, category);
  }
});

test("огноо мэдэгдэхгүй бол хаахгүй", () => {
  const v = checkAge({ category: "NEWS", publishedAtSource: null, now: NOW });
  assert.equal(v.stale, false);
  assert.equal(v.hours, null);
});

// ---------- Эх сурвалжтай тулгах (2026-09-29-ний өргөтгөл) ----------

const PENTAGON_SRC =
  "According to new reporting by Bloomberg, the Pentagon's investigation into the February 28th " +
  "air strikes on the girls' school — which killed over 150 people, including at least 123 " +
  "children — concluded that the attack was the result of outdated intelligence and " +
  "over-reliance on an AI targeting system. Those errors seem to have been compounded by an " +
  "as-yet unidentified AI targeting system, likely similar to the one used to fast-track strikes " +
  "on over 2,000 Iranian targets. In July, Trump downplayed responsibility, even suggesting that " +
  "images could have been generated by AI. Yet as a UN commission wrote, there are " +
  "\"reasonable grounds\" to conclude the attacks amount to \"war crimes\".";

const PENTAGON_BODY = [
  "Пентагоны дотоод шалгалтаар АНУ-ын зэвсэгт хүчин хуучирсан өгөгдөлд хэт найдан " +
    "хоёрдугаар сарын 28-нд охидын сургуулийг агаараас цохисныг тогтоолоо.",
  "",
  "## Гол баримт",
  "1. Агаарын цохилтод 150 гаруй хүн амь үрэгдсэний 123 нь хүүхэд байжээ.",
  "2. Америкийн цэргийнхэн уг системтэй төстэй хиймэл оюун ашиглажээ.",
  "",
  "## Олон улсын байр суурь",
  "НҮБ-ын комисс дайны гэмт хэрэг гэж үзэх бүрэн үндэслэлтэйг онцоллоо.",
  "",
  "## Монголд юу гэсэн үг",
  "Цэрэг, төрийн шийдвэрт хүний хяналтыг орхигдуулж болохгүй.",
].join("\n");

test("markdown хэсгүүдийг таслана", () => {
  const s = mdSections(PENTAGON_BODY);
  assert.deepEqual(s.map((x) => x.heading), ["Гол баримт", "Олон улсын байр суурь", "Монголд юу гэсэн үг"]);
});

test("нэрээр нь хэсгийг олно", () => {
  assert.match(sectionText(PENTAGON_BODY, "Гол баримт") ?? "", /150 гаруй/);
  assert.equal(sectionText(PENTAGON_BODY, "Байхгүй хэсэг"), null);
});

test("биеэс нэрлэсэн хэсгүүдийг хасна — давхар мэдээлэхгүй", () => {
  const rest = bodyWithoutSections(PENTAGON_BODY, ["Гол баримт", "Монголд юу гэсэн үг"]);
  assert.doesNotMatch(rest, /150 гаруй/);
  assert.match(rest, /Пентагоны дотоод шалгалтаар/);
});

test("БОДИТ АЛДАА: эх тексттэй тулгахад 4 төрлийн зөрчил гарна", () => {
  const issues = checkBeforePublish({
    titleMn: "АНУ хиймэл оюунд найдаж сургууль цохисныг Пентагон тогтоов",
    summaryMn: "АНУ-ын арми хиймэл оюунд хэт найдсанаас сургуулийг бөмбөгдсөнийг Пентагон тогтоожээ.",
    bodyMn: PENTAGON_BODY,
    fbHook: null,
    fbText: null,
    sourceText: PENTAGON_SRC,
    publishedAtSource: new Date("2026-09-21T00:00:00Z"),
    sourceName: "Futurism",
  });
  const rules = new Set(issues.map((i) => i.rule));
  assert.ok(rules.has("дамжуулалт алга"), [...rules].join(","));
  assert.ok(rules.has("таамаг→баталгаа"), [...rules].join(","));
  assert.ok(rules.has("хуулийн томьёолол хүчтэй болов"), [...rules].join(","));
  assert.ok(rules.has("модаль сулрав"), [...rules].join(","));
});

test("дамжуулалтыг «Монголд юу гэсэн үг» хэсэгт шаардахгүй", () => {
  const issues = checkBeforePublish({
    titleMn: "Bloomberg-ийн мэдээлснээр Пентагон дүгнэжээ",
    summaryMn: "Bloomberg-ийн мэдээлснээр Пентагон дүгнэжээ.",
    bodyMn: "## Монголд юу гэсэн үг\nХүний хяналтыг орхигдуулж болохгүй.",
    fbHook: null, fbText: null,
    sourceText: PENTAGON_SRC,
  });
  assert.equal(issues.filter((i) => i.rule === "дамжуулалт алга").length, 0, JSON.stringify(issues));
});

test("«модаль сулрав» нь нийтлэхийг зогсоохгүй", () => {
  const warn: FieldIssue = { field: "биет", rule: "модаль сулрав", severity: "анхаарах", detail: "x" };
  assert.deepEqual(blocking([warn]), []);
});

test("нийтлэлийн ӨӨРИЙН текст зөрчилтэй бол карт дахин үүсгэж засахгүй", () => {
  const bad: FieldIssue = { field: "биет", rule: "таамаг→баталгаа", severity: "ноцтой", detail: "x" };
  assert.equal(canRepair([bad]), false);
});

test("зөвхөн карт/FB текст зөрчилтэй бол дахин үүсгэж засна", () => {
  const bad: FieldIssue = { field: "картын гарчиг", rule: "түр→бүрэн", severity: "ноцтой", detail: "x" };
  assert.equal(canRepair([bad]), true);
});

test("анхааруулга дангаараа дахин үүсгэхийг өдөөхгүй", () => {
  const warn: FieldIssue = { field: "биет", rule: "модаль сулрав", severity: "анхаарах", detail: "x" };
  assert.equal(canRepair([warn]), false);
});

test("эх текстгүй бол хуучин зан төлөв хэвээр (DIGEST)", () => {
  const issues = checkBeforePublish({
    ...PAUSE,
    fbHook: "AI агент төрийн системд халдсанаар OpenAI сургалтаа зогсоов",
    fbText: null,
    sourceText: null,
  });
  assert.deepEqual(issues.map((i) => i.field), ["картын гарчиг"]);
});

test("хуучирсан мэдээний анхдагч босго 72 цаг", () => {
  assert.equal(DEFAULT_NEWS_MAX_AGE_H, 72);
});

// ---------- Зөрчил яг хаана байна вэ ----------

test("«таамаг→баталгаа» барьсан ЯГ ТЭР хэсгийг буцаана", () => {
  const body =
    "Bloomberg-ийн мэдээлснээр шалгалт үргэлжилж байна.\n\n" +
    "Ерөнхийлөгч Дональд Трамп хариуцлагыг үгүйсгэж байсан ч албаны шалгалт үүнийг няцаав.";
  const s = offendingSentence("таамаг→баталгаа", body, PENTAGON_SRC);
  // «үгүйсгэж» (эх нь «downplayed») нь эхний зөрчил — хэсэг тус бүрээр барина
  assert.match(s ?? "", /үгүйсгэж/);
  assert.doesNotMatch(s ?? "", /Bloomberg/, "цэвэр өгүүлбэр буцаж болохгүй");
  assert.doesNotMatch(s ?? "", /няцаав/, "зөвхөн барьсан ХЭСГИЙГ буцаана, бүтэн өгүүлбэрийг биш");
});

test("ишлэлтэй эхний хэсгийн ард байгаа зөрчлийг ч олно", () => {
  const body = "Трамп хариуцлагыг бага үнэлсэн гэж мэдэгдэж байсан ч албаны шалгалт үүнийг няцаав.";
  assert.match(offendingSentence("таамаг→баталгаа", body, PENTAGON_SRC) ?? "", /няцаав/);
});

test("«хуулийн томьёолол» барьсан өгүүлбэрийг буцаана", () => {
  const body = "Мэдээ гарлаа. НҮБ-ын комисс дайны гэмт хэрэг гэж үзэх бүрэн үндэслэлтэйг онцоллоо.";
  assert.match(offendingSentence("хуулийн томьёолол хүчтэй болов", body, PENTAGON_SRC) ?? "", /НҮБ/);
});

test("текст бүхэлдээ дутуу дүрэмд өгүүлбэр заахгүй", () => {
  assert.equal(offendingSentence("дамжуулалт алга", "Ямар нэг текст.", PENTAGON_SRC), null);
  assert.equal(offendingSentence("модаль сулрав", "Ямар нэг текст.", PENTAGON_SRC), null);
});

test("зөрчилгүй текстэд null", () => {
  assert.equal(
    offendingSentence("таамаг→баталгаа", "Bloomberg-ийн мэдээлснээр дүгнэжээ.", PENTAGON_SRC),
    null,
  );
});

test("дүрэм бүрт эх сурвалжаас юуг ишлэхийг мэднэ", () => {
  assert.ok(sourceNeedles("дамжуулалт алга").includes("according to"));
  assert.ok(sourceNeedles("хуулийн томьёолол хүчтэй болов").includes("reasonable grounds"));
  assert.deepEqual(sourceNeedles("эх сурвалжид байхгүй огноо"), []);
});
