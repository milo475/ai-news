import assert from "node:assert/strict";
import test from "node:test";
import {
  autoAnswer, average, clampScore, CRITERIA, normalizeVerdict, spread, summarize, type EvalRow,
} from "./eval.api";
import { judgeInput, loadRequests } from "./eval";
import type { StudioOutput } from "./output.api";

test("25 бодит хүсэлт бүрэн бүтэн", () => {
  const rows = loadRequests();
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows.map((r) => r.id)).size, 25);
  for (const r of rows) {
    assert.ok(r.request.length > 15, r.id);
    assert.ok(["IMAGE", "VIDEO", "TEXT", "AUDIO", "SLIDES"].includes(r.format), r.id);
    assert.ok(r.persona.length > 0, r.id);
  }
  // Таван өөр хүний ажил хамрагдсан
  assert.equal(new Set(rows.map((r) => r.persona)).size, 5);
});

test("оноог 1–10 хооронд барина", () => {
  assert.equal(clampScore(0), 1);
  assert.equal(clampScore(99), 10);
  assert.equal(clampScore("7"), 7);
  assert.equal(clampScore(undefined), 1);
  assert.equal(clampScore(7.6), 8);
});

test("дутуу хариуг хэвийн болгоно", () => {
  const v = normalizeVerdict({ clarity: 9, weakness: "  " });
  assert.equal(v.clarity, 9);
  assert.equal(v.toolFit, 1);
  assert.equal(v.weakness, "—");
});

test("дундаж оноо", () => {
  const scores = Object.fromEntries(CRITERIA.map((c) => [c, 8])) as Record<(typeof CRITERIA)[number], number>;
  assert.equal(average(scores), 8);
});

function row(id: string, avg: number): EvalRow {
  const scores = Object.fromEntries(CRITERIA.map((c) => [c, avg])) as EvalRow["scores"];
  return {
    id, persona: "багш", format: "IMAGE", request: "зар",
    scores, avg, weakness: "сул", costUsd: 0.01, seconds: 10, issues: [],
  };
}

test("дүн — хамгийн муу 3-ыг эрэмбэлж гаргана", () => {
  const s = summarize([row("a", 9), row("b", 4), row("c", 7), row("d", 2)]);
  assert.deepEqual(s.worst.map((r) => r.id), ["d", "b", "c"]);
  assert.equal(s.rows, 4);
  assert.equal(s.avg, 5.5);
  assert.equal(Number(s.costUsd.toFixed(2)), 0.04);
  assert.equal(Number(s.avgCost.toFixed(2)), 0.01);
});

test("шүүгчид бүтэн багц текстээр өгнө", () => {
  const out: StudioOutput = {
    tools: [{
      tool: "gemini", prompt: "a shoe on a shelf",
      params: [{ name: "aspect", value: "4:5", why: "FB пост" }],
      parts: [{ part: "a shoe", why: "гол субьект" }],
      steps: ["Gemini нээ"],
    }],
    storyboard: [{ n: 1, seconds: 3, prompt: "wide shot", mn: "гутлын лангуу" }],
    consistency: "лавлагаа зураг", music: { prompt: "warm folk", mn: "дулаан" },
    assembly: ["CapCut нээ"], ideas: ["story болгож бас тавь"],
  };
  const text = judgeInput(
    { id: "x", persona: "жижиг бизнес", format: "IMAGE", request: "гутлын зар" },
    out,
  );
  assert.match(text, /жижиг бизнес/);
  assert.match(text, /a shoe on a shelf/);
  assert.match(text, /гутлын лангуу/);
  assert.match(text, /warm folk/);
  assert.match(text, /story болгож/);
});

test("автомат хариулт бодит сонголтыг эхэлж авна", () => {
  assert.equal(autoAnswer(["дулаан", "албан", "Та шийд", "Өөрөө бичих"], "Та шийд"), "дулаан");
  // Бодит сонголт байхгүй бол «Та шийд»
  assert.equal(autoAnswer(["Та шийд", "Өөрөө бичих"], "Та шийд"), "Та шийд");
});

test("--spread нь хэлбэр тус бүрээс нэгийг авна", () => {
  const picked = spread(loadRequests());
  assert.deepEqual(new Set(picked.map((r) => r.format)).size, 5);
  assert.equal(picked.length, 5);
});
