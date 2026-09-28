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

/** Хэрэгслийн дуудлага ба төлөвлөгөөний дуудлагыг system prompt-оор нь ялгана */
function buildMock(over: {
  toolData?: Record<string, unknown>;
  planData?: Record<string, unknown>;
} = {}) {
  const systems: string[] = [];
  const chat = (async (opts: { system: string }) => {
    systems.push(opts.system.slice(0, 60));
    const isPlan = /ЕРӨНХИЙ төлөвлөгөөг гарга/.test(opts.system);
    return {
      data: (isPlan
        ? {
            storyboard: [], consistency: "", music: null, assembly: [],
            ideas: ["санаа1", "санаа2"], ...over.planData,
          }
        : {
            prompt: "a shoe on a shelf", params: [], parts: [], steps: ["Хэрэгслээ нээ"],
            ...over.toolData,
          }) as Record<string, unknown>,
      tokens: 100, costUsd: 0.0002,
    };
  }) as never;
  return { chat, systems: () => systems, count: () => systems.length };
}

const CTX = {
  brief: BRIEF, format: "IMAGE" as const, direction: DIR, toolIds: ["gemini", "canva"],
};

test("хэрэгсэл тус бүр + төлөвлөгөө = тусдаа дуудлагууд", async () => {
  const m = buildMock();
  const r = await buildOutput(CTX, { chat: m.chat });

  // 2 хэрэгсэл + 1 төлөвлөгөө
  assert.equal(m.count(), 3);
  assert.equal(r.output.tools.length, 2);
  assert.deepEqual(r.output.tools.map((t) => t.tool).sort(), ["canva", "gemini"]);
  assert.equal(Number(r.costUsd.toFixed(4)), 0.0006);
});

test("хэрэгслийн дуудлагад ЗӨВХӨН өөрийнх нь лавлах орно", async () => {
  const users: string[] = [];
  const chat = (async (opts: { system: string; user: string }) => {
    users.push(opts.user);
    return {
      data: /ЕРӨНХИЙ төлөвлөгөө/.test(opts.system)
        ? { storyboard: [], consistency: "", music: null, assembly: [], ideas: ["а", "б"] }
        : { prompt: "a shoe", params: [], parts: [], steps: ["Нээ"] },
      tokens: 10, costUsd: 0,
    };
  }) as never;

  await buildOutput({ ...CTX, toolIds: ["gemini", "canva"] }, { chat });
  const geminiUser = users.find((u) => u.startsWith("ХЭРЭГСЭЛ: Gemini"))!;
  assert.ok(geminiUser, users.map((u) => u.slice(0, 30)).join(" | "));
  assert.match(geminiUser, /Nano Banana/, "өөрийнх нь лавлах орсон байх");
  assert.ok(!geminiUser.includes("Canva-г нээ"), "өөр хэрэгслийн лавлах орох ёсгүй");
  assert.ok(!/# Canva/.test(geminiUser), "өөр хэрэгслийн лавлах орох ёсгүй");
});

test("лавлахад байхгүй тоог алхмаас хасна", async () => {
  const m = buildMock({
    toolData: {
      prompt: "a shoe",
      steps: ["Kling дээр өдөрт 999 кредит үнэгүй", "Хоёр дахь алхам"],
      params: [], parts: [],
    },
  });
  const r = await buildOutput({ ...CTX, toolIds: ["kling"], format: "VIDEO" }, { chat: m.chat });
  const steps = r.output.tools[0]!.steps.join(" ");
  assert.ok(!steps.includes("999"), steps);
  assert.match(steps, /албан ёсны сайтаас шалгана уу/);
  assert.ok(r.stripped.length > 0);
});

test("лавлахад байгаа тоог хөндөхгүй", async () => {
  const m = buildMock({
    toolData: { prompt: "a shoe", steps: ["Өдөрт 66 кредит үнэгүй"], params: [], parts: [] },
  });
  const r = await buildOutput({ ...CTX, toolIds: ["kling"], format: "VIDEO" }, { chat: m.chat });
  assert.match(r.output.tools[0]!.steps[0]!, /66 кредит/);
  assert.deepEqual(r.stripped, []);
});

test("хаагдсан хэрэгсэл сонговол алдаа", async () => {
  const m = buildMock();
  await assert.rejects(
    buildOutput({ ...CTX, format: "VIDEO", toolIds: ["sora"] }, { chat: m.chat }),
    /Хэрэгсэл сонгогдоогүй/,
  );
});

test("дутуу талбартай хариуг хэвийн болгоно", async () => {
  const chat = (async (opts: { system: string }) => ({
    data: /ЕРӨНХИЙ төлөвлөгөө/.test(opts.system)
      ? { ideas: ["а", "б"] }
      : { prompt: "a shoe", steps: ["Нээ"] },
    tokens: 10, costUsd: 0,
  })) as never;

  const r = await buildOutput({ ...CTX, toolIds: ["gemini"] }, { chat });
  assert.deepEqual(r.output.tools[0]!.params, []);
  assert.deepEqual(r.output.storyboard, []);
  assert.equal(r.output.music, null);
  assert.deepEqual(r.output.assembly, []);
});

test("бичвэр хэлбэрт бэлэн эх бичвэр шаардана", async () => {
  const m = buildMock({
    toolData: {
      prompt: "Чи албан бичгийн мэргэжилтэн. Монголоор захидал бич.",
      draft:
        "Эрхэм хүндэт дарга аа,\n\nГэрээний хугацаа сунгах хүсэлтээ албан ёсоор илгээж байна. " +
        "Одоогийн гэрээ 2026 оны 12 дугаар сард дуусах тул нэг жилээр сунгахыг хүсч байна.",
      params: [], parts: [], steps: ["ChatGPT нээ"],
    },
  });
  const r = await buildOutput({ ...CTX, format: "TEXT", toolIds: ["chatgpt"] }, { chat: m.chat });
  assert.match(r.output.tools[0]!.draft ?? "", /Эрхэм хүндэт/);
  assert.deepEqual(r.issues, [], JSON.stringify(r.issues));
});
