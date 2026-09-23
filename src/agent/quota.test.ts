import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoPublishMinScore, dailyPublishLimit, MAX_PER_SOURCE, selectForPublish,
  type PublishCandidate,
} from "./quota.api";

const DAY = new Date("2026-09-23T02:00:00Z");

function draft(id: string, relevance: number, over: Partial<PublishCandidate> = {}): PublishCandidate {
  return {
    id,
    relevance,
    sourceId: over.sourceId ?? `src-${id}`,
    modelSlugs: over.modelSlugs ?? [],
    companySlugs: over.companySlugs ?? [],
    tags: over.tags ?? [],
    publishedAtSource: over.publishedAtSource ?? DAY,
    createdAt: over.createdAt ?? DAY,
  };
}

test("selectForPublish: оноо өндөрөөс нь квотын хэрээр сонгоно", () => {
  const picked = selectForPublish(
    [draft("a", 7), draft("b", 10), draft("c", 9), draft("d", 8)],
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
    draft("a", 10, { sourceId: "techcrunch" }),
    draft("b", 9, { sourceId: "techcrunch" }),
    draft("c", 8, { sourceId: "techcrunch" }),
    draft("d", 5, { sourceId: "verge" }),
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
      draft("openai-money-1", 8, { companySlugs: ["openai"], tags: ["хөрөнгө оруулалт"] }),
      draft("openai-money-2", 7, { companySlugs: ["openai"], tags: ["хөрөнгө оруулалт", "модель"] }),
      draft("anthropic", 6, { companySlugs: ["anthropic"], tags: ["зохицуулалт"] }),
    ],
    3,
  );
  assert.deepEqual(picked.map((p) => p.id), ["gpt-1", "openai-money-1", "anthropic"]);
});

test("selectForPublish: өнөөдөр нийтлэгдсэн нь эх сурвалж/сэдвийн хязгаарт тооцогдоно", () => {
  const already = [
    draft("published-1", 10, { sourceId: "techcrunch" }),
    draft("published-2", 9, { sourceId: "techcrunch", modelSlugs: ["google/gemini-3.8-flash"] }),
  ];
  const picked = selectForPublish(
    [
      draft("same-source", 10, { sourceId: "techcrunch" }),
      draft("same-model", 9, { modelSlugs: ["google/gemini-3.8-flash"], sourceId: "verge" }),
      draft("ok", 8, { sourceId: "verge" }),
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
