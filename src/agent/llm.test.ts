import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { chatJson, chatText, isAuthError, LlmAuthError, resetAuthFailure } from "./llm";

const KEY = "OPENROUTER_API_KEY";
const realFetch = globalThis.fetch;
let saved: string | undefined;

/** Хэдэн удаа сүлжээнд хүрснийг тоолно */
let calls = 0;

function mockFetch(status: number, body = "no auth credentials found") {
  globalThis.fetch = (async () => {
    calls++;
    return new Response(body, { status });
  }) as typeof fetch;
}

beforeEach(() => {
  saved = process.env[KEY];
  process.env[KEY] = "sk-test";
  calls = 0;
  resetAuthFailure();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
  resetAuthFailure();
});

const JSON_OPTS = { model: "m", system: "s", user: "u", schema: {}, maxTokens: 100 };
const TEXT_OPTS = { model: "m", user: "u", maxTokens: 100 };

test("401 — LlmAuthError, дахин оролдохгүй", async () => {
  mockFetch(401);
  await assert.rejects(() => chatJson(JSON_OPTS), (e) => isAuthError(e));
  assert.equal(calls, 1, "401 дээр дахин оролдох ёсгүй");
});

test("403 — мөн адил түлхүүрийн алдаа", async () => {
  mockFetch(403, "forbidden");
  await assert.rejects(() => chatText(TEXT_OPTS), (e) => isAuthError(e));
  assert.equal(calls, 1);
});

test("нэг удаа 401 гармагц дараагийн дуудлага сүлжээнд хүрэхгүй", async () => {
  mockFetch(401);
  await assert.rejects(() => chatJson(JSON_OPTS));
  assert.equal(calls, 1);

  // 80 даалгавар ажиллуулах гэж оролдлоо гэж бодъё
  for (let i = 0; i < 10; i++) {
    await assert.rejects(() => chatText(TEXT_OPTS), (e) => isAuthError(e));
  }
  assert.equal(calls, 1, "түгжээ ажиллаагүй — дахин 10 удаа сүлжээнд хүрлээ");
});

test("бусад алдаа түгжээ тавихгүй — дараагийн дуудлага хэвийн явна", async () => {
  // 400 нь түр алдаа ч биш, түлхүүрийн алдаа ч биш
  mockFetch(400, "bad request");
  await assert.rejects(() => chatText(TEXT_OPTS), (e) => !isAuthError(e));
  assert.equal(calls, 1);

  globalThis.fetch = (async () => {
    calls++;
    return Response.json({ choices: [{ message: { content: "за" } }] });
  }) as typeof fetch;

  const r = await chatText(TEXT_OPTS);
  assert.equal(r.text, "за");
  assert.equal(calls, 2, "400-ийн дараа дуудлага хаагдах ёсгүй");
});

test("түлхүүр огт байхгүй — LlmAuthError (status 0), сүлжээнд хүрэхгүй", async () => {
  delete process.env[KEY];
  mockFetch(200, "{}");
  await assert.rejects(() => chatJson(JSON_OPTS), (e) => isAuthError(e) && e.status === 0);
  assert.equal(calls, 0);
});

test("isAuthError — бусад алдааг ялгана", () => {
  assert.equal(isAuthError(new LlmAuthError(401, "x")), true);
  assert.equal(isAuthError(new Error("сүлжээ тасарлаа")), false);
  assert.equal(isAuthError("мөр"), false);
  assert.equal(isAuthError(null), false);
});

test("LlmAuthError — мессеж нь юу хийхийг хэлнэ", () => {
  assert.match(new LlmAuthError(0, "").message, /OPENROUTER_API_KEY тохируулаагүй/);
  assert.match(new LlmAuthError(401, "no credentials").message, /401/);
});
