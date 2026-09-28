import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  chatJson, chatText, creditDetail, isAuthError, isCreditError, isTruncated, LlmAuthError,
  resetAuthFailure,
} from "./llm";

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

/** Илгээсэн body-г шалгахын тулд */
function captureFetch(handler: (body: Record<string, any>, n: number) => unknown) {
  const bodies: Record<string, any>[] = [];
  globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
    calls++;
    const body = JSON.parse(init?.body ?? "{}");
    bodies.push(body);
    return Response.json(handler(body, calls));
  }) as typeof fetch;
  return bodies;
}

test("тасралт: max_tokens 2 дахин өргөж, reasoning унтраан НЭГ удаа дахин", async () => {
  const bodies = captureFetch((_b, n) =>
    n === 1
      ? {
          choices: [{ finish_reason: "length", message: { content: '{"a":' } }],
          usage: { total_tokens: 100, completion_tokens_details: { reasoning_tokens: 94 } },
        }
      : { choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }], usage: {} },
  );

  const r = await chatJson<{ ok: boolean }>(JSON_OPTS);
  assert.deepEqual(r.data, { ok: true });
  assert.equal(calls, 2);
  assert.equal(bodies[0]!.max_tokens, 100);
  assert.equal(bodies[1]!.max_tokens, 200, "2 дахин өргөх ёстой");
  assert.deepEqual(bodies[1]!.reasoning, { enabled: false }, "reasoning унтраасан байх ёстой");
});

test("тасралт: хоёр дахь удаад ч багтахгүй бол алдаа, гурав дахь оролдлого байхгүй", async () => {
  captureFetch(() => ({
    choices: [{ finish_reason: "length", message: { content: "{" } }],
    usage: { completion_tokens_details: { reasoning_tokens: 180 } },
  }));

  await assert.rejects(
    () => chatJson(JSON_OPTS),
    (e) => isTruncated(e) && !isAuthError(e) && /max_tokens=200/.test((e as Error).message),
  );
  assert.equal(calls, 2, "нэг л удаа өргөнө");
});

test("тасралтын мессежид reasoning токены тоо бичигдэнэ", async () => {
  captureFetch(() => ({
    choices: [{ finish_reason: "length", message: { content: "{" } }],
    usage: { completion_tokens_details: { reasoning_tokens: 2_950 } },
  }));
  await assert.rejects(() => chatJson(JSON_OPTS), /2950 токеныг reasoning идсэн/);
});

test("chatText: тасралтад мөн ижил дүрэм", async () => {
  const bodies = captureFetch((_b, n) =>
    n === 1
      ? { choices: [{ finish_reason: "length", message: { content: "хагас" } }], usage: {} }
      : { choices: [{ finish_reason: "stop", message: { content: "бүтэн" } }], usage: {} },
  );

  const r = await chatText(TEXT_OPTS);
  assert.equal(r.text, "бүтэн");
  assert.equal(calls, 2);
  assert.equal(bodies[1]!.max_tokens, 200);
  assert.deepEqual(bodies[1]!.reasoning, { enabled: false });
});

test("isTruncated: бусад алдаанд false", () => {
  assert.equal(isTruncated(new Error("сүлжээ")), false);
  assert.equal(isTruncated(null), false);
  assert.equal(isTruncated(undefined), false);
  assert.equal(isTruncated("мөр"), false);
});

test("402 «Insufficient credits» — түгжигдэж, дахин оролдохгүй", async () => {
  mockFetch(402, '{"error":{"message":"Insufficient credits. Add more using https://openrouter.ai/settings/credits"}}');
  await assert.rejects(
    () => chatJson(JSON_OPTS),
    (e) => isAuthError(e) && e.kind === "credits" && /данс дууссан/.test(e.message),
  );
  assert.equal(calls, 1);

  // Дараагийн алхмууд сүлжээнд огт хүрэхгүй — мөнгө, цаг үрэхгүй
  for (let i = 0; i < 5; i++) await assert.rejects(() => chatText(TEXT_OPTS));
  assert.equal(calls, 1);
});

test("402-ийн ГУРВАН хэлбэр бүгд үхлийн алдаа — дахин оролдохгүй", async () => {
  // 2026-09-27: «in_flight» нь түр хязгаар гэж дахин оролдож, «can only afford» нь
  // max_tokens бууруулж ажилласаар байснаас бенчмарк хагас хариу цуглуулсан
  const bodies = [
    '{"error":{"message":"would exceed your available credits given your current in-flight requests"}}',
    '{"error":{"message":"This request requires more credits, or fewer max_tokens. You requested up to 4000 tokens, but can only afford 308"}}',
    '{"error":{"message":"Insufficient credits"}}',
  ];
  for (const body of bodies) {
    resetAuthFailure();
    mockFetch(402, body);
    const before = calls;
    await assert.rejects(
      () => chatJson(JSON_OPTS),
      (e) => isCreditError(e) && isAuthError(e),
      body.slice(0, 40),
    );
    // Үхлийн алдаа — нэг л дуудлага, backoff-гүй
    assert.equal(calls - before, 1, `${body.slice(0, 40)}: ${calls - before} дуудлага`);
  }
});

test("кредитийн түгжээ тавигдсаны дараа дуудлага огт гарахгүй", async () => {
  resetAuthFailure();
  mockFetch(402, '{"error":{"message":"Insufficient credits"}}');
  await assert.rejects(() => chatJson(JSON_OPTS), isCreditError);
  const before = calls;
  await assert.rejects(() => chatJson(JSON_OPTS), isCreditError);
  assert.equal(calls, before, "түгжээний дараа сүлжээнд хүрэх ёсгүй");
  resetAuthFailure();
});

test("402-ийн гурван хэлбэр бүрд ойлгомжтой монгол тайлбар", () => {
  assert.match(
    creditDetail("would exceed your available credits given your current in-flight requests"),
    /зэрэг явж буй/,
  );
  assert.match(creditDetail("can only afford 308"), /308 токен/);
  assert.match(creditDetail("Insufficient credits"), /үлдэгдэл хүрэлцэхгүй/);
});
