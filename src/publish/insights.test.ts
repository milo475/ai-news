import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReport, engagementOf, groupBy, INSIGHTS_DELAY_HOURS, insightsDue, metricOf, parseFbStats,
  parseIgStats, REPORT_DAYS, statsFor, vsOverall, type PostRow,
} from "./insights.api";

const NOW = new Date("2026-09-27T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const row = (over: Partial<PostRow> = {}): PostRow => ({
  category: "NEWS",
  hookType: "number",
  fbReach: 1_000, fbLikes: 10, fbShares: 2, fbComments: 3,
  igReach: 400, igLikes: 20, igComments: 1,
  ...over,
});

test("metricOf: метрикийн тоог гаргана, байхгүйг null", () => {
  const json = {
    data: [
      { name: "post_impressions_unique", values: [{ value: 1_234 }] },
      { name: "reach", values: [{ value: 0 }] },
    ],
  };
  assert.equal(metricOf(json, "post_impressions_unique"), 1_234);
  assert.equal(metricOf(json, "reach"), 0, "0 нь хүчинтэй утга");
  assert.equal(metricOf(json, "байхгүй"), null);
  assert.equal(metricOf({ error: { message: "буруу токен" } }, "reach"), null);
  assert.equal(metricOf({ data: [{ name: "reach", values: [] }] }, "reach"), null);
  assert.equal(metricOf({ data: [{ name: "reach", values: [{ value: -5 }] }] }, "reach"), null);
});

test("parseFbStats: хоёр дуудлагын хариуг нэгтгэнэ", () => {
  const s = parseFbStats(
    { data: [{ name: "post_impressions_unique", values: [{ value: 2_500 }] }] },
    {
      reactions: { summary: { total_count: 42 } },
      shares: { count: 7 },
      comments: { summary: { total_count: 5 } },
    },
  );
  assert.deepEqual(s, { reach: 2_500, likes: 42, shares: 7, comments: 5 });
});

test("parseFbStats: хэсэгчилсэн хариу — байхгүйг null (0 гэж дарж бичихгүй)", () => {
  const onlyReach = parseFbStats(
    { data: [{ name: "post_impressions_unique", values: [{ value: 100 }] }] },
    null,
  );
  assert.deepEqual(onlyReach, { reach: 100, likes: null, shares: null, comments: null });

  const onlyEngagement = parseFbStats(null, { reactions: { summary: { total_count: 3 } } });
  assert.deepEqual(onlyEngagement, { reach: null, likes: 3, shares: 0, comments: 0 });

  assert.equal(parseFbStats(null, null), null);
  assert.equal(parseFbStats({ error: { message: "x" } }, { error: { message: "x" } }), null);
});

test("parseIgStats: reach/likes/comments", () => {
  assert.deepEqual(
    parseIgStats({
      data: [
        { name: "reach", values: [{ value: 800 }] },
        { name: "likes", values: [{ value: 30 }] },
        { name: "comments", values: [{ value: 4 }] },
      ],
    }),
    { reach: 800, likes: 30, comments: 4 },
  );
  assert.equal(parseIgStats(null), null);
  assert.equal(parseIgStats({ error: { message: "эрх хүрэхгүй" } }), null);
});

test("insightsDue: 24 цагийн дараа НЭГ л удаа", () => {
  assert.equal(INSIGHTS_DELAY_HOURS, 24);

  // Хугацаа болоогүй
  assert.equal(insightsDue(hoursAgo(2), null, NOW), false);
  assert.equal(insightsDue(hoursAgo(23.9), null, NOW), false);
  // Болсон, хараахан татаагүй
  assert.equal(insightsDue(hoursAgo(24), null, NOW), true);
  assert.equal(insightsDue(hoursAgo(48), null, NOW), true);
  // Хугацаа болсны ДАРАА татсан — дахин шаардлагагүй
  assert.equal(insightsDue(hoursAgo(48), hoursAgo(1), NOW), false);
  // Хугацаа болохоос ӨМНӨ татсан (жишээ нь fbstats) — дахин татна
  assert.equal(insightsDue(hoursAgo(48), hoursAgo(40), NOW), true);
  // Постлоогүй
  assert.equal(insightsDue(null, null, NOW), false);
});

test("engagementOf / statsFor: дундаж ба хариу/хүрэлтийн хувь", () => {
  assert.equal(engagementOf(row()), 15);

  const s = statsFor("NEWS", [
    row({ fbReach: 1_000, fbLikes: 10, fbShares: 0, fbComments: 0, igReach: 200 }),
    row({ fbReach: 3_000, fbLikes: 20, fbShares: 10, fbComments: 0, igReach: 400 }),
  ]);
  assert.equal(s.posts, 2);
  assert.equal(s.avgReach, 2_000);
  assert.equal(s.avgEngagement, 20);
  assert.equal(s.engagementRate, 1, "40 / 4000 = 1%");
  assert.equal(s.avgIgReach, 300);
});

test("statsFor: хүрэлт 0 бол хувь нь null (тэгд хуваахгүй)", () => {
  const s = statsFor("х", [row({ fbReach: 0, fbLikes: 5, fbShares: 0, fbComments: 0 })]);
  assert.equal(s.avgReach, 0);
  assert.equal(s.engagementRate, null);
  assert.deepEqual(statsFor("хоосон", []), {
    key: "хоосон", posts: 0, avgReach: 0, avgEngagement: 0, engagementRate: null, avgIgReach: 0,
  });
});

test("groupBy: хүрэлтээр буурахаар эрэмбэлнэ, minPosts-оос багыг хасна", () => {
  const rows = [
    row({ category: "RISK", fbReach: 5_000 }),
    row({ category: "RISK", fbReach: 3_000 }),
    row({ category: "NEWS", fbReach: 1_000 }),
    row({ category: "NEWS", fbReach: 1_000 }),
    row({ category: "HOWTO", fbReach: 9_000 }),
  ];
  const all = groupBy(rows, (r) => r.category);
  assert.deepEqual(all.map((g) => g.key), ["HOWTO", "RISK", "NEWS"]);
  assert.equal(all[0]!.posts, 1);

  // 1 постын тоо санамсаргүй тул хасна
  const solid = groupBy(rows, (r) => r.category, 2);
  assert.deepEqual(solid.map((g) => g.key), ["RISK", "NEWS"]);

  // hookType null бол бүлэглэхгүй
  const byHook = groupBy([row({ hookType: null }), row({ hookType: "question" })], (r) => r.hookType);
  assert.deepEqual(byHook.map((g) => g.key), ["question"]);
});

test("buildReport: ангилал ба hook загвараар, нийт дундажтай", () => {
  const rows = [
    row({ category: "RISK", hookType: "number", fbReach: 4_000 }),
    row({ category: "NEWS", hookType: "question", fbReach: 2_000 }),
  ];
  const r = buildReport(rows);
  assert.equal(r.posts, 2);
  assert.equal(r.overall.avgReach, 3_000);
  assert.deepEqual(r.byCategory.map((g) => g.key), ["RISK", "NEWS"]);
  assert.deepEqual(r.byHookType.map((g) => g.key), ["number", "question"]);
  assert.equal(REPORT_DAYS, 7);
});

test("vsOverall: дундажаас хэдэн хувиар", () => {
  const overall = statsFor("бүгд", [row({ fbReach: 1_000 }), row({ fbReach: 3_000 })]);
  assert.equal(vsOverall(statsFor("a", [row({ fbReach: 3_000 })]), overall), "+50%");
  assert.equal(vsOverall(statsFor("b", [row({ fbReach: 1_000 })]), overall), "-50%");
  assert.equal(vsOverall(statsFor("c", [row({ fbReach: 2_000 })]), overall), "0%");
  assert.equal(vsOverall(statsFor("d", [row()]), statsFor("тэг", [row({ fbReach: 0 })])), null);
});
