import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoPublishMinScore, dailyPublishLimit, MAX_PER_CATEGORY, MAX_PER_SOURCE, MIN_NON_NEWS,
  selectForPublish, type PublishCandidate,
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

test("selectForPublish: ижил модель/сэдвийг давхардуулахгүй", () => {
  const picked = selectForPublish(
    [
      draft("gpt-1", 10, { modelSlugs: ["openai/gpt-6-astra"], companySlugs: ["openai"] }),
      draft("gpt-2", 9, { modelSlugs: ["openai/gpt-6-astra"], companySlugs: ["openai"] }),
      // ижил компани, ижил шошго — нэг сэдэв гэж үзнэ
      draft("openai-money-1", 8, { companySlugs: ["openai"], tags: ["хөрөнгө оруулалт"], category: "BUSINESS" }),
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
