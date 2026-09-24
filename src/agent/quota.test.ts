import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoPublishMinScore, dailyPublishLimit, MAX_PER_CATEGORY, MAX_PER_SOURCE, MIN_NON_NEWS,
  MIN_SHARED_TAGS, sameTopic, selectForPublish, type PublishCandidate,
} from "./quota.api";

const DAY = new Date("2026-09-23T02:00:00Z");

function draft(id: string, relevance: number, over: Partial<PublishCandidate> = {}): PublishCandidate {
  return {
    id,
    relevance,
    sourceId: over.sourceId ?? `src-${id}`,
    category: over.category ?? "NEWS",
    modelSlugs: over.modelSlugs ?? [],
    companySlugs: over.companySlugs ?? [],
    tags: over.tags ?? [],
    publishedAtSource: over.publishedAtSource ?? DAY,
    createdAt: over.createdAt ?? DAY,
  };
}

test("selectForPublish: оноо өндөрөөс нь квотын хэрээр сонгоно", () => {
  const picked = selectForPublish(
    [
      draft("a", 7, { category: "HOWTO" }),
      draft("b", 10, { category: "NEWS" }),
      draft("c", 9, { category: "RISK" }),
      draft("d", 8, { category: "PROJECT" }),
    ],
    3,
  );
  assert.deepEqual(picked.map((p) => p.id), ["b", "c", "d"]);
});

test("selectForPublish: квот 0 эсвэл нэр дэвшигчгүй бол хоосон", () => {
  assert.deepEqual(selectForPublish([draft("a", 10)], 0), []);
  assert.deepEqual(selectForPublish([], 3), []);
});

test("selectForPublish: нэг эх сурвалжаас 2-оос илүүг авахгүй", () => {
  const same = [
    draft("a", 10, { sourceId: "techcrunch", category: "NEWS" }),
    draft("b", 9, { sourceId: "techcrunch", category: "RISK" }),
    draft("c", 8, { sourceId: "techcrunch", category: "PROJECT" }),
    draft("d", 5, { sourceId: "verge", category: "PROJECT" }),
  ];
  const picked = selectForPublish(same, 3);
  assert.equal(MAX_PER_SOURCE, 2);
  assert.deepEqual(picked.map((p) => p.id), ["a", "b", "d"]);
});

test("sameTopic: ижил модель бол үргэлж нэг сэдэв", () => {
  const a = draft("a", 9, { modelSlugs: ["openai/gpt-6-astra"], companySlugs: ["openai"] });
  const b = draft("b", 8, { modelSlugs: ["openai/gpt-6-astra"], companySlugs: ["google"], tags: ["өөр"] });
  assert.equal(sameTopic(a, b), true);
});

test("sameTopic: ижил компанид 1 шошго хангалтгүй, 2 шошго давхцвал нэг сэдэв", () => {
  assert.equal(MIN_SHARED_TAGS, 2);
  const base = { companySlugs: ["openai"], category: "BUSINESS" as const };

  const oneTag = sameTopic(
    draft("a", 9, { ...base, tags: ["хөрөнгө оруулалт", "модель"] }),
    draft("b", 8, { ...base, tags: ["хөрөнгө оруулалт", "зохицуулалт"] }),
  );
  assert.equal(oneTag, false, "нэг шошго давхцсан нь өөр сэдэв");

  const twoTags = sameTopic(
    draft("a", 9, { ...base, tags: ["хөрөнгө оруулалт", "модель"] }),
    draft("b", 8, { ...base, tags: ["хөрөнгө оруулалт", "модель", "судалгаа"] }),
  );
  assert.equal(twoTags, true);

  // Өөр компани бол хичнээн шошго давхцсан ч өөр сэдэв
  assert.equal(
    sameTopic(
      draft("a", 9, { companySlugs: ["openai"], tags: ["модель", "судалгаа"] }),
      draft("b", 8, { companySlugs: ["anthropic"], tags: ["модель", "судалгаа"] }),
    ),
    false,
  );
});

test("sameTopic: нэг компанийн хоёр RISK мэдээ — нэг шошго давхцахад л давхардал", () => {
  const risk = (id: string, tags: string[]) =>
    draft(id, 9, { companySlugs: ["openai"], tags, category: "RISK" as const });

  assert.equal(sameTopic(risk("a", ["кибер аюулгүй байдал"]), risk("b", ["кибер аюулгүй байдал", "агент"])), true);
  assert.equal(sameTopic(risk("a", ["зохицуулалт"]), risk("b", ["кибер аюулгүй байдал"])), false, "давхцсан шошго алга");

  // Зөвхөн нэг нь RISK бол ердийн дүрэм (2 шошго)
  const news = draft("n", 8, { companySlugs: ["openai"], tags: ["кибер аюулгүй байдал"], category: "NEWS" });
  assert.equal(sameTopic(risk("a", ["кибер аюулгүй байдал"]), news), false);
});

test("selectForPublish: ижил модель/сэдвийг давхардуулахгүй", () => {
  const picked = selectForPublish(
    [
      draft("gpt-1", 10, { modelSlugs: ["openai/gpt-6-astra"], companySlugs: ["openai"] }),
      draft("gpt-2", 9, { modelSlugs: ["openai/gpt-6-astra"], companySlugs: ["openai"] }),
      // ижил компани, 2 ижил шошго — нэг сэдэв
      draft("openai-money-1", 8, { companySlugs: ["openai"], tags: ["хөрөнгө оруулалт", "модель"], category: "BUSINESS" }),
      draft("openai-money-2", 7, { companySlugs: ["openai"], tags: ["хөрөнгө оруулалт", "модель"], category: "BUSINESS" }),
      draft("anthropic", 6, { companySlugs: ["anthropic"], tags: ["зохицуулалт"], category: "RISK" }),
    ],
    3,
  );
  assert.deepEqual(picked.map((p) => p.id), ["gpt-1", "openai-money-1", "anthropic"]);
});

test("selectForPublish: нэг ангиллаас өдөрт 2-оос илүүг авахгүй", () => {
  assert.equal(MAX_PER_CATEGORY, 2);
  const picked = selectForPublish(
    [
      draft("news-1", 10, { category: "NEWS" }),
      draft("news-2", 9, { category: "NEWS" }),
      draft("news-3", 8, { category: "NEWS" }),   // 3 дахь NEWS — алгасагдана
      draft("howto", 5, { category: "HOWTO" }),
    ],
    3,
  );
  assert.deepEqual(picked.map((p) => p.id), ["news-1", "news-2", "howto"]);

  // Өнөөдөр 2 RISK нийтлэгдсэн бол гурав дахь RISK орохгүй
  const withToday = selectForPublish(
    [draft("risk-3", 10, { category: "RISK" }), draft("fact", 4, { category: "FACT" })],
    2,
    [draft("risk-1", 9, { category: "RISK" }), draft("risk-2", 8, { category: "RISK" })],
  );
  assert.deepEqual(withToday.map((p) => p.id), ["fact"]);
});

test("selectForPublish: сүүлийн суудлыг NEWS-ээс бусдад өгнө", () => {
  assert.equal(MIN_NON_NEWS, 1);

  // Оноогоор бол 3 NEWS сонгогдох байсан ч сүүлийнх нь HOWTO болно
  const picked = selectForPublish(
    [
      draft("news-1", 10, { category: "NEWS" }),
      draft("news-2", 9, { category: "NEWS" }),
      draft("news-3", 8, { category: "NEWS" }),
      draft("howto", 4, { category: "HOWTO" }),
    ],
    3,
  );
  assert.deepEqual(picked.map((p) => p.id), ["news-1", "news-2", "howto"]);

  // Өнөөдөр 1 NEWS нийтлэгдсэн, квот 2 үлдсэн → нэг нь NEWS, нэг нь бусад
  const withToday = selectForPublish(
    [draft("news-b", 10, { category: "NEWS" }), draft("risk", 5, { category: "RISK" })],
    2,
    [draft("news-a", 9, { category: "NEWS" })],
  );
  assert.deepEqual(withToday.map((p) => p.id), ["news-b", "risk"]);

  // NEWS-ээс бусад нэр дэвшигч байхгүй бол NEWS-ээр дүүргэнэ (суудал хоосон үлдэхгүй)
  const onlyNews = selectForPublish(
    [draft("n1", 10, { category: "NEWS" }), draft("n2", 9, { category: "NEWS" })],
    3,
  );
  assert.deepEqual(onlyNews.map((p) => p.id), ["n1", "n2"]);
});

test("selectForPublish: өнөөдөр нийтлэгдсэн нь эх сурвалж/сэдвийн хязгаарт тооцогдоно", () => {
  const already = [
    draft("published-1", 10, { sourceId: "techcrunch", category: "NEWS" }),
    draft("published-2", 9, { sourceId: "techcrunch", modelSlugs: ["google/gemini-3.8-flash"], category: "RISK" }),
  ];
  const picked = selectForPublish(
    [
      draft("same-source", 10, { sourceId: "techcrunch", category: "PROJECT" }),
      draft("same-model", 9, { modelSlugs: ["google/gemini-3.8-flash"], sourceId: "verge", category: "PROJECT" }),
      draft("ok", 8, { sourceId: "verge", category: "PROJECT" }),
    ],
    2,
    already,
  );
  assert.deepEqual(picked.map((p) => p.id), ["ok"]);
});

test("dailyPublishLimit / autoPublishMinScore: env, анхдагч утга", () => {
  assert.equal(dailyPublishLimit({}), 3);
  assert.equal(dailyPublishLimit({ DAILY_PUBLISH_LIMIT: "5" }), 5);
  assert.equal(dailyPublishLimit({ DAILY_PUBLISH_LIMIT: "0" }), 0);       // унтраалттай
  assert.equal(dailyPublishLimit({ DAILY_PUBLISH_LIMIT: "" }), 3);        // хоосон = анхдагч
  assert.equal(dailyPublishLimit({ DAILY_PUBLISH_LIMIT: "гурав" }), 3);   // буруу утга = анхдагч

  assert.equal(autoPublishMinScore({}), 7);
  assert.equal(autoPublishMinScore({ AUTO_PUBLISH_MIN_SCORE: "9" }), 9);
  assert.equal(autoPublishMinScore({ AUTO_PUBLISH_MIN_SCORE: "" }), 7);
});
