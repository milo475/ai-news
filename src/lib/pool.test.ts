import assert from "node:assert/strict";
import { test } from "node:test";
import { CRON_POOL, poolMax, processRole, SCRIPT_POOL, WEB_POOL } from "./pool.api";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("APP_ROLE нь бусдаас давуу", () => {
  assert.equal(processRole(env({ APP_ROLE: "cron", NEXT_RUNTIME: "nodejs" })), "cron");
  assert.equal(processRole(env({ APP_ROLE: "WEB" })), "web");
});

test("Next-ийн процессийг web гэж таньна", () => {
  assert.equal(processRole(env({ NEXT_RUNTIME: "nodejs" })), "web");
  assert.equal(processRole(env({ NEXT_PHASE: "phase-production-build" })), "web");
});

test("бусад тохиолдолд script", () => {
  assert.equal(processRole(env({})), "script");
  assert.equal(processRole(env({ APP_ROLE: "танихгүй" })), "script");
});

test("poolMax — үүргээс хамаарна", () => {
  assert.equal(poolMax(env({ APP_ROLE: "web" })), WEB_POOL);
  assert.equal(poolMax(env({ APP_ROLE: "cron" })), CRON_POOL);
  assert.equal(poolMax(env({})), SCRIPT_POOL);
});

test("PRISMA_POOL_MAX — гараар дарж болно", () => {
  assert.equal(poolMax(env({ APP_ROLE: "cron", PRISMA_POOL_MAX: "20" })), 20);
  assert.equal(poolMax(env({ APP_ROLE: "web", PRISMA_POOL_MAX: "0" })), WEB_POOL, "0 нь утгагүй");
  assert.equal(poolMax(env({ APP_ROLE: "web", PRISMA_POOL_MAX: "тоо биш" })), WEB_POOL);
});

test("web + cron нь Postgres-ийн энгийн хязгаарт багтана", () => {
  assert.ok(WEB_POOL + CRON_POOL <= 20, "Railway-ийн жижиг план ~20 холболт");
});
