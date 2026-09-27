/**
 * Студийн LLM урсгал — мок chat-аар. Сүлжээ, DB хөндөхгүй.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { askQuestions, buildDirections, buildOutput } from "./run";
import { DECIDE_OPTION, FREE_OPTION } from "./prompts.api";
import type { StudioBrief, StudioDirection } from "./prompts.api";
import type { StudioOutput } from "./output.api";

const BRIEF: StudioBrief = {
  goal: "зар", audience: "залуус", message: "хямдрал", tone: "дулаан", subject: "гутал",
  setting: "дэлгүүр", style: "гэрэл зураг", placement: "Facebook", length: "1 зураг",
  brand: "ногоон", avoid: "кирилл текст",
};
const DIR: StudioDirection = { key: "safe", title: "Энгийн", idea: "санаа", why: "учир" };

/** Дуудлага бүрийн user мессежийг цуглуулдаг мок */
function mock<T>(replies: T[]) {
  const calls: { user: string; system: string; maxTokens?: number }[] = [];
  let i = 0;
  const chat = (async (opts: { user: string; system: string; maxTokens?: number }) => {
    calls.push({ user: opts.user, system: opts.system, maxTokens: opts.maxTokens });
    const data = replies[Math.min(i, replies.length - 1)];
    i += 1;
    return { data, tokens: 100, costUsd: 0.0002 };
  }) as never;
  return { chat, calls, count: () => i };
}

test("асуултаас мэдэгдсэн талбарыг хасна, сонголтод нэмэлт хоёрыг залгана", async () => {
  const m = mock([
    {
      questions: [
        { field: "goal", question: "Зорилго?", options: ["а", "б", "в"] },
        { field: "tone", question: "Өнгө аяс?", options: ["дулаан", "албан", "хөгжилтэй"] },
      ],
    },
  ]);
  const r = await askQuestions(
    { request: "зар зураг", format: "IMAGE", known: ["goal"], round: 0 },
    { chat: m.chat },
  );
  assert.deepEqual(r.questions.map((q) => q.field), ["tone"]);
  assert.deepEqual(r.questions[0]!.options.slice(-2), [DECIDE_OPTION, FREE_OPTION]);
  assert.equal(r.costUsd, 0.0002);
});

test("чиглэлүүд эрэмбэлэгдэж ирнэ", async () => {
  const m = mock([
    {
      directions: [
        { key: "bold", title: "б", idea: "", why: "" },
        { key: "safe", title: "а", idea: "", why: "" },
        { key: "creative", title: "в", idea: "", why: "" },
      ],
    },
  ]);
  const r = await buildDirections({ brief: BRIEF, format: "IMAGE" }, { chat: m.chat });
  assert.deepEqual(r.directions.map((d) => d.key), ["safe", "creative", "bold"]);
});

function output(over: Partial<StudioOutput> = {}): StudioOutput {
  return {
    tools: [{ tool: "gemini", prompt: "a shoe on a shelf", params: [], parts: [], steps: ["Gemini нээ"] }],
    storyboard: [], consistency: "", music: null, assembly: [], ideas: ["санаа1", "санаа2"],
    ...over,
  };
}

test("гаргалт зөв бол нэг л дуудлага", async () => {
  const m = mock([output()]);
  const r = await buildOutput(
    { brief: BRIEF, format: "IMAGE", direction: DIR, toolIds: ["gemini"] },
    { chat: m.chat },
  );
  assert.equal(m.count(), 1);
  assert.deepEqual(r.issues, []);
  assert.equal(r.costUsd, 0.0002);
});

test("алдаатай гаргалтыг нэг удаа засуулна — алдааг feedback болгож өгнө", async () => {
  const bad = output({
    tools: [{ tool: "gemini", prompt: "залуу эмэгтэй гутал барьж байна", params: [], parts: [], steps: ["Нээ"] }],
  });
  const m = mock([bad, output()]);
  const r = await buildOutput(
    { brief: BRIEF, format: "IMAGE", direction: DIR, toolIds: ["gemini"] },
    { chat: m.chat },
  );
  assert.equal(m.count(), 2);
  assert.deepEqual(r.issues, []);
  assert.match(m.calls[1]!.user, /ӨМНӨХ ОРОЛДЛОГЫН АЛДАА/);
  assert.match(m.calls[1]!.user, /АНГЛИАР/);
  // Хоёр дуудлагын зардал нийлнэ
  assert.equal(Number(r.costUsd.toFixed(4)), 0.0004);
});

test("хоёр дахь оролдлого ч алдаатай бол гаргалтыг өгсөн хэвээр, алдааг тэмдэглэнэ", async () => {
  const bad = output({
    tools: [{ tool: "gemini", prompt: "залуу эмэгтэй", params: [], parts: [], steps: ["Нээ"] }],
  });
  const m = mock([bad]);
  const r = await buildOutput(
    { brief: BRIEF, format: "IMAGE", direction: DIR, toolIds: ["gemini"] },
    { chat: m.chat },
  );
  // Карт шиг: бүтээл огт гаргахгүй байснаас дутуу ч гаргасан нь дээр
  assert.equal(m.count(), 2);
  assert.equal(r.output.tools.length, 1);
  assert.ok(r.issues.length > 0);
});

test("хаагдсан хэрэгсэл сонговол алдаа", async () => {
  const m = mock([output()]);
  await assert.rejects(
    buildOutput({ brief: BRIEF, format: "VIDEO", direction: DIR, toolIds: ["sora"] }, { chat: m.chat }),
    /Хэрэгсэл сонгогдоогүй/,
  );
});

test("дутуу талбартай хариуг хэвийн болгоно", async () => {
  const m = mock([{ tools: [{ tool: "gemini", prompt: "a shoe", steps: ["Нээ"] }], ideas: ["а", "б"] }]);
  const r = await buildOutput(
    { brief: BRIEF, format: "IMAGE", direction: DIR, toolIds: ["gemini"] },
    { chat: m.chat },
  );
  assert.deepEqual(r.output.tools[0]!.params, []);
  assert.deepEqual(r.output.storyboard, []);
  assert.equal(r.output.music, null);
});
