import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canRepair, checkAge, checkBeforePublish, checkDuplicate, DEFAULT_NEWS_MAX_AGE_H,
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
  // 72ц нь production-ийн гаралтын 47%-ийг хаах байсан (p50 = 65ц)
  assert.equal(DEFAULT_NEWS_MAX_AGE_H, 120);
  assert.equal(newsMaxAgeHours({} as unknown as NodeJS.ProcessEnv), 120);
  assert.equal(newsMaxAgeHours({ NEWS_MAX_AGE_H: "72" } as unknown as NodeJS.ProcessEnv), 72);
  assert.equal(newsMaxAgeHours({ NEWS_MAX_AGE_H: "муу" } as unknown as NodeJS.ProcessEnv), 120);
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
  assert.equal(checkAge({ category: "NEWS", publishedAtSource: hoursAgo(120), now: NOW }).stale, false);
  assert.equal(checkAge({ category: "NEWS", publishedAtSource: hoursAgo(121), now: NOW }).stale, true);
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
