import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTH_MESSAGES, AuthError } from "./errors";

test("AuthError: нэвтрээгүй ба баталгаажаагүй тохиолдлын мессеж", () => {
  const unauth = new AuthError("unauthenticated");
  assert.equal(unauth.code, "unauthenticated");
  assert.match(unauth.message, /нэвтэрсэн байх шаардлагатай/);

  const unverified = new AuthError("unverified");
  assert.equal(unverified.code, "unverified");
  assert.match(unverified.message, /баталгаажуул/i);

  // Аль аль нь Error тул try/catch-д баригдана
  assert.ok(unauth instanceof Error && unverified instanceof Error);
  assert.equal(unauth.name, "AuthError");

  // Мессежүүд нэг газар тодорхойлогдсон
  assert.equal(unauth.message, AUTH_MESSAGES.unauthenticated);
  assert.equal(unverified.message, AUTH_MESSAGES.unverified);
});
