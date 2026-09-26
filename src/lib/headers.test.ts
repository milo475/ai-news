import assert from "node:assert/strict";
import { test } from "node:test";
import { cspEnforced, cspValue, securityHeaders } from "./headers";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const HTTPS = { SITE_URL: "https://ai.mn" };

test("CSP — үндсэндээ report-only", () => {
  const h = securityHeaders(env(HTTPS));
  assert.ok(h["Content-Security-Policy-Report-Only"]);
  assert.equal(h["Content-Security-Policy"], undefined);
});

test("CSP_ENFORCE=true — хатуу горим", () => {
  const h = securityHeaders(env({ ...HTTPS, CSP_ENFORCE: "true" }));
  assert.ok(h["Content-Security-Policy"]);
  assert.equal(h["Content-Security-Policy-Report-Only"], undefined);
  assert.equal(cspEnforced(env({ CSP_ENFORCE: "TRUE" })), true);
  assert.equal(cspEnforced(env({ CSP_ENFORCE: "1" })), false);
});

test("HSTS — зөвхөн https дээр", () => {
  assert.ok(securityHeaders(env(HTTPS))["Strict-Transport-Security"]);
  assert.equal(
    securityHeaders(env({ SITE_URL: "http://localhost:3000" }))["Strict-Transport-Security"],
    undefined,
    "локал http дээр HSTS тавибал хөтөч гацна",
  );
});

test("бусад header-ууд үргэлж байна", () => {
  const h = securityHeaders(env(HTTPS));
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.ok(h["Permissions-Policy"]?.includes("camera=()"));
});

test("CSP — Umami-ийн хаягийг script-src, connect-src-д нэмнэ", () => {
  const csp = cspValue(env({ NEXT_PUBLIC_UMAMI_URL: "https://umami.example.com/" }));
  assert.ok(csp.includes("script-src 'self' 'unsafe-inline' https://umami.example.com"));
  assert.ok(csp.includes("connect-src 'self' https://umami.example.com"));
});

test("CSP — Umami тохируулаагүй бол зөвхөн өөрийн эх", () => {
  const csp = cspValue(env({}));
  assert.ok(csp.includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(csp.includes("connect-src 'self'"));
  assert.ok(!csp.includes("undefined"));
});

test("CSP — үндсэн хязгаарлалтууд", () => {
  const csp = cspValue(env({}));
  for (const part of [
    "default-src 'self'", "object-src 'none'", "base-uri 'self'",
    "form-action 'self'", "frame-ancestors 'self'",
  ]) {
    assert.ok(csp.includes(part), part);
  }
});

test("upgrade-insecure-requests — зөвхөн хатуу горимд", () => {
  // report-only үед хөтөч үүнийг үл тоомсорлож консолд алдаа бичдэг
  assert.ok(!cspValue(env({})).includes("upgrade-insecure-requests"));
  assert.ok(cspValue(env({ CSP_ENFORCE: "true" })).includes("upgrade-insecure-requests"));
});
