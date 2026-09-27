import assert from "node:assert/strict";
import test from "node:test";
import {
  checkOutput, hasCyrillic, hasPlaceholder, ISSUE_FEEDBACK, outputSystem, outputUser, PROMPT_LANG, WARN_BRAND,
  WARN_CYRILLIC, WARN_REAL_FACE, warningsFor, type StudioOutput,
} from "./output.api";
import { toolById, type StudioTool } from "./studio.api";
import type { StudioBrief, StudioDirection } from "./prompts.api";

const BRIEF: StudioBrief = {
  goal: "зар", audience: "залуус", message: "хямдрал", tone: "дулаан", subject: "гутал",
  setting: "дэлгүүр", style: "гэрэл зураг", placement: "Facebook", length: "1 зураг",
  brand: "ногоон", avoid: "кирилл текст",
};

const DIR: StudioDirection = { key: "safe", title: "Энгийн", idea: "санаа", why: "учир" };

function out(over: Partial<StudioOutput> = {}): StudioOutput {
  return {
    tools: [{ tool: "gemini", prompt: "a young woman holds a shoe", params: [], parts: [], steps: ["Gemini нээ"] }],
    storyboard: [], consistency: "", music: null, assembly: [], ideas: ["санаа1", "санаа2"],
    ...over,
  };
}

test("кирилл илрүүлэх", () => {
  assert.equal(hasCyrillic("a young woman"), false);
  assert.equal(hasCyrillic("залуу эмэгтэй"), true);
});

test("промпт монголоор ирвэл алдаа", () => {
  const issues = checkOutput(
    out({ tools: [{ tool: "gemini", prompt: "залуу эмэгтэй", params: [], parts: [], steps: ["Нээ"] }] }),
    { format: "IMAGE", toolIds: ["gemini"] },
  );
  assert.deepEqual(issues, ["prompt-cyrillic"]);
  assert.match(ISSUE_FEEDBACK["prompt-cyrillic"], /АНГЛИАР/);
});

test("алхам англиар ирвэл алдаа", () => {
  const issues = checkOutput(
    out({ tools: [{ tool: "gemini", prompt: "a shoe", params: [], parts: [], steps: ["Open Gemini"] }] }),
    { format: "IMAGE", toolIds: ["gemini"] },
  );
  assert.deepEqual(issues, ["explanation-not-mn"]);
});

test("өгөөгүй хэрэгсэл нэрлэвэл алдаа", () => {
  const issues = checkOutput(out(), { format: "IMAGE", toolIds: ["canva"] });
  assert.ok(issues.includes("unknown-tool"));
});

test("видеод 4–8 кадар шаардана", () => {
  const few = checkOutput(out({ storyboard: [] }), { format: "VIDEO", toolIds: ["gemini"] });
  assert.ok(few.includes("shots-too-few"));

  const shots = Array.from({ length: 9 }, (_, i) => ({
    n: i + 1, seconds: 3, prompt: "a shoe on a table", mn: "гутал",
  }));
  const many = checkOutput(out({ storyboard: shots }), { format: "VIDEO", toolIds: ["gemini"] });
  assert.ok(many.includes("shots-too-many"));

  const ok = checkOutput(out({ storyboard: shots.slice(0, 5) }), { format: "VIDEO", toolIds: ["gemini"] });
  assert.deepEqual(ok, []);
});

test("зурагт кадар шаардахгүй", () => {
  assert.deepEqual(checkOutput(out(), { format: "IMAGE", toolIds: ["gemini"] }), []);
});

test("зураг/видеонд кирилл сэрэмжлүүлэг үргэлж", () => {
  const w = warningsFor({ format: "IMAGE", tools: [], request: "зар зураг" });
  assert.ok(w.includes(WARN_CYRILLIC));
  // Бичвэрт хамаагүй
  assert.ok(!warningsFor({ format: "TEXT", tools: [], request: "захидал" }).includes(WARN_CYRILLIC));
});

test("хүний царай, брэнд дурдвал тусгай сэрэмжлүүлэг", () => {
  const w = warningsFor({ format: "IMAGE", tools: [], request: "захирлынхаа зургийг гаргая" });
  assert.ok(w.includes(WARN_REAL_FACE));
  assert.ok(warningsFor({ format: "IMAGE", tools: [], request: "манай логотой" }).includes(WARN_BRAND));
});

test("prompt-д ЗӨВХӨН сонгосон хэрэгслийн лавлах орно — токен хэмнэнэ", () => {
  const gemini = toolById("gemini") as StudioTool;
  const u = outputUser({
    brief: BRIEF, format: "IMAGE", aspect: "4:5", direction: DIR, tools: [gemini],
    docs: { gemini: "GEMINI-ИЙН ЛАВЛАХ", kling: "KLING-ИЙН ЛАВЛАХ" },
    craft: "CRAFT", mongol: "MONGOL",
  });
  assert.match(u, /GEMINI-ИЙН ЛАВЛАХ/);
  assert.ok(!u.includes("KLING-ИЙН ЛАВЛАХ"), "сонгоогүй хэрэгслийн лавлах орох ёсгүй");
  assert.match(u, /ХАРЬЦАА: 4:5/);
  assert.match(u, /Аюулгүй/);
});

test("бичвэр/слайдын промпт МОНГОЛООР — гаралт нь монгол байх ёстой", () => {
  const eng = out({ tools: [{ tool: "chatgpt", prompt: "Write a formal letter", params: [], parts: [], steps: ["Нээ"] }] });
  assert.deepEqual(checkOutput(eng, { format: "TEXT", toolIds: ["chatgpt"] }), ["prompt-not-mn"]);

  const mn = out({
    tools: [{ tool: "chatgpt", prompt: "Чи албан бичгийн мэргэжилтэн. Монгол хэлээр захидал бич.", params: [], parts: [], steps: ["Нээ"] }],
  });
  assert.deepEqual(checkOutput(mn, { format: "TEXT", toolIds: ["chatgpt"] }), []);
  assert.deepEqual(checkOutput(mn, { format: "SLIDES", toolIds: ["chatgpt"] }), []);
});

test("зураг/видео/хөгжмийн промпт англиар хэвээр", () => {
  assert.equal(PROMPT_LANG.IMAGE, "en");
  assert.equal(PROMPT_LANG.VIDEO, "en");
  assert.equal(PROMPT_LANG.AUDIO, "en");
  assert.equal(PROMPT_LANG.TEXT, "mn");
  assert.equal(PROMPT_LANG.SLIDES, "mn");
});

test("кадарын промпт нь бичвэрийн дүрмээс хамаарахгүй — үргэлж англиар", () => {
  const bad = out({
    tools: [{ tool: "veo", prompt: "a wide shot of an office", params: [], parts: [], steps: ["Нээ"] }],
    storyboard: Array.from({ length: 4 }, (_, i) => ({
      n: i + 1, seconds: 3, prompt: i === 0 ? "албан тасалгаа" : "a wide shot", mn: "тасалгаа",
    })),
  });
  assert.ok(checkOutput(bad, { format: "VIDEO", toolIds: ["veo"] }).includes("prompt-cyrillic"));
});

test("system prompt хэлбэрт тохирсон хэлний дүрэм агуулна", () => {
  assert.match(outputSystem("IMAGE"), /"prompt" талбар бүр АНГЛИАР/);
  assert.match(outputSystem("TEXT"), /"prompt" талбар бүр МОНГОЛООР/);
  // Тэмдэглэгээ үлдэх ёсгүй
  assert.ok(!outputSystem("TEXT").includes("{{LANG}}"));
  // Үнэгүй хязгаарыг тоогоор бичих дүрэм
  assert.match(outputSystem("VIDEO"), /үнэгүй хязгаарыг ТООГООР/);
});

test("алхамд дуусгаагүй «[...]» үлдээвэл алдаа", () => {
  const bad = out({
    tools: [{ tool: "gemini", prompt: "a shoe", params: [], parts: [], steps: ["Gemini нээгээд [...] хийнэ"] }],
  });
  assert.ok(checkOutput(bad, { format: "IMAGE", toolIds: ["gemini"] }).includes("placeholder"));
  assert.equal(hasPlaceholder("Gemini нээ"), false);
  // Хэрэгтэй хаалт — доторх утгатай текстийг барихгүй
  assert.equal(hasPlaceholder("Style талбарт [Verse] гэж бич"), false);
});
