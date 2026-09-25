import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPassword, hashPassword, MIN_PASSWORD, verifyPassword } from "./password";
import { googleEnabled, GENERIC_LOGIN_ERROR, SESSION_MAX_AGE } from "./config.api";
import { expiresAt, identifierFor, parseIdentifier, RESET_HOURS, VERIFY_HOURS } from "./tokens.api";
import { LOGIN_MAX, REGISTER_MAX, RESET_MAX } from "./rate-limit";
import { rateLimit, resetRateLimit } from "../newsletter/rate-limit";

test("checkPassword: 8 тэмдэгтээс богино, хоосон, түгээмэл нууц үгийг барина", () => {
  assert.equal(MIN_PASSWORD, 8);
  assert.deepEqual(checkPassword("saihan-nuuts-ug"), []);

  const codes = (p: string) => checkPassword(p).map((x) => x.code);
  assert.deepEqual(codes(""), ["empty"]);
  assert.deepEqual(codes("   "), ["empty"]);
  assert.ok(codes("богино").includes("short"));
  assert.ok(codes("1234567").includes("short"));
  assert.ok(codes("password").includes("common"));
  assert.ok(codes("PASSWORD").includes("common"), "том жижгээс үл хамаарна");
  assert.deepEqual(codes("12345678"), ["common"], "урт боловч түгээмэл");
});

test("hashPassword / verifyPassword: bcrypt hash шалгагдана", async () => {
  const hash = await hashPassword("saihan-nuuts-ug");
  assert.notEqual(hash, "saihan-nuuts-ug", "hash хадгална");
  assert.match(hash, /^\$2[aby]\$/, "bcrypt формат");

  assert.equal(await verifyPassword("saihan-nuuts-ug", hash), true);
  assert.equal(await verifyPassword("өөр нууц үг", hash), false);
  assert.equal(await verifyPassword("saihan-nuuts-ug", null), false, "нууц үггүй (Google) хэрэглэгч");
  assert.equal(await verifyPassword("x", "hash биш"), false, "эвдэрсэн hash дээр унахгүй");

  // Давс тус бүр өөр — ижил нууц үг өөр hash өгнө
  assert.notEqual(await hashPassword("saihan-nuuts-ug"), hash);
});

test("googleEnabled: хоёр түлхүүр хоёулаа байвал л идэвхжинэ", () => {
  assert.equal(googleEnabled({}), false);
  assert.equal(googleEnabled({ GOOGLE_CLIENT_ID: "id" }), false);
  assert.equal(googleEnabled({ GOOGLE_CLIENT_SECRET: "secret" }), false);
  assert.equal(googleEnabled({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "secret" }), false);
  assert.equal(googleEnabled({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }), true);
});

test("identifierFor: зорилго + имэйл, жижиг үсгээр", () => {
  assert.equal(identifierFor("verify", "Test@Example.MN "), "verify:test@example.mn");
  assert.equal(identifierFor("reset", "test@example.mn"), "reset:test@example.mn");
  assert.notEqual(identifierFor("verify", "a@b.mn"), identifierFor("reset", "a@b.mn"));

  assert.equal(VERIFY_HOURS, 24);
  assert.equal(RESET_HOURS, 1, "сэргээх холбоос 1 цаг");

  // Задлахад буцаж ижил утга гарна (имэйлд ":" байсан ч)
  assert.deepEqual(parseIdentifier("verify:test@example.mn"), { purpose: "verify", email: "test@example.mn" });

  const now = new Date("2026-09-25T00:00:00Z");
  assert.equal(expiresAt("reset", now).toISOString(), "2026-09-25T01:00:00.000Z");
  assert.equal(expiresAt("verify", now).toISOString(), "2026-09-26T00:00:00.000Z");
});

test("rate limit: нэвтрэх 5/мин, бүртгэл 3/цаг, IP тус бүрээр тусдаа", () => {
  resetRateLimit();
  assert.equal(LOGIN_MAX, 5);
  assert.equal(REGISTER_MAX, 3);
  assert.equal(RESET_MAX, 3);

  const MINUTE = 60_000;
  for (let i = 0; i < LOGIN_MAX; i++) {
    assert.equal(rateLimit("login:1.1.1.1", LOGIN_MAX, MINUTE), true, `оролдлого ${i + 1}`);
  }
  assert.equal(rateLimit("login:1.1.1.1", LOGIN_MAX, MINUTE), false, "6 дахь нь хаагдана");

  // Өөр IP хамаарахгүй
  assert.equal(rateLimit("login:2.2.2.2", LOGIN_MAX, MINUTE), true);

  // Цонх өнгөрөхөд дахин нээгдэнэ
  assert.equal(rateLimit("login:1.1.1.1", LOGIN_MAX, MINUTE, Date.now() + MINUTE + 1), true);

  // Бүртгэл — цагт 3
  const HOUR = 3_600_000;
  for (let i = 0; i < REGISTER_MAX; i++) {
    assert.equal(rateLimit("register:3.3.3.3", REGISTER_MAX, HOUR), true);
  }
  assert.equal(rateLimit("register:3.3.3.3", REGISTER_MAX, HOUR), false);
  resetRateLimit();
});

test("Нэвтрэх алдааны мессеж нь шалтгааныг задруулахгүй", () => {
  assert.equal(GENERIC_LOGIN_ERROR, "Имэйл эсвэл нууц үг буруу байна.");
  assert.ok(!/бүртгэлгүй|олдсонгүй|байхгүй/i.test(GENERIC_LOGIN_ERROR));
});

test("Session 30 хоног", () => {
  assert.equal(SESSION_MAX_AGE, 30 * 24 * 60 * 60);
});
