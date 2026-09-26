import assert from "node:assert/strict";
import { test } from "node:test";
import { fillMissing, hydrateEnv, missingKeys, parseEnviron, REQUIRED_KEYS } from "./env";

/** `/proc/1/environ`-ийн бодит хэлбэр: NUL-аар тусгаарласан, төгсгөлд нь мөн NUL */
const ENVIRON =
  "DATABASE_URL=postgres://a\0OPENROUTER_API_KEY=sk-or-v1-xxx\0SITE_URL=https://ai.mn\0PWD=/app\0";

test("parseEnviron — NUL-аар салгаж, эхний = дээр хуваана", () => {
  const e = parseEnviron(ENVIRON);
  assert.equal(e.DATABASE_URL, "postgres://a");
  assert.equal(e.OPENROUTER_API_KEY, "sk-or-v1-xxx");
  assert.equal(Object.keys(e).length, 4);
});

test("parseEnviron — утга дотор = байж болно", () => {
  const e = parseEnviron("A=b=c=d\0");
  assert.equal(e.A, "b=c=d");
});

test("parseEnviron — нэргүй, хоосон бичлэгийг алгасна", () => {
  const e = parseEnviron("\0=value\0A=1\0\0");
  assert.deepEqual(e, { A: "1" });
});

test("missingKeys — хоосон мөр ч дутуу", () => {
  assert.deepEqual(missingKeys({ DATABASE_URL: "x", OPENROUTER_API_KEY: "y" }), []);
  assert.deepEqual(missingKeys({ DATABASE_URL: "x", OPENROUTER_API_KEY: "  " }), ["OPENROUTER_API_KEY"]);
  assert.deepEqual(missingKeys({}), [...REQUIRED_KEYS]);
});

test("fillMissing — байгаа утгыг ХЭЗЭЭ Ч дарж бичихгүй", () => {
  const env: Record<string, string | undefined> = { DATABASE_URL: "локал" };
  const added = fillMissing(env, { DATABASE_URL: "prod", OPENROUTER_API_KEY: "sk" });
  assert.equal(env.DATABASE_URL, "локал", ".env давуу байх ёстой");
  assert.equal(env.OPENROUTER_API_KEY, "sk");
  assert.deepEqual(added, ["OPENROUTER_API_KEY"]);
});

test("fillMissing — процессийн хувийн хувьсагчдыг хуулахгүй", () => {
  const env: Record<string, string | undefined> = {};
  fillMissing(env, { PWD: "/app", SHLVL: "1", OLDPWD: "/", TERM: "xterm", A: "1" });
  assert.deepEqual(env, { A: "1" });
});

test("fillMissing — хоосон утгыг хуулахгүй", () => {
  const env: Record<string, string | undefined> = {};
  fillMissing(env, { A: "", B: "1" });
  assert.deepEqual(env, { B: "1" });
});

test("hydrateEnv — шаардлагатай нь бүрэн бол файл ч уншихгүй", () => {
  let read = 0;
  const added = hydrateEnv({
    env: { DATABASE_URL: "x", OPENROUTER_API_KEY: "y" },
    read: () => { read++; return ENVIRON; },
    platform: "linux",
  });
  assert.deepEqual(added, []);
  assert.equal(read, 0, "дэмий файл уншсан");
});

test("hydrateEnv — Linux биш бол юу ч хийхгүй", () => {
  let read = 0;
  const added = hydrateEnv({
    env: {},
    read: () => { read++; return ENVIRON; },
    platform: "darwin",
  });
  assert.deepEqual(added, []);
  assert.equal(read, 0);
});

test("hydrateEnv — /proc уншигдахгүй бол чимээгүй гарна", () => {
  const added = hydrateEnv({
    env: {},
    read: () => { throw new Error("EACCES"); },
    platform: "linux",
  });
  assert.deepEqual(added, []);
});

test("hydrateEnv — дутууг PID 1-ээс нөхнө", () => {
  const env: Record<string, string | undefined> = { DATABASE_URL: "локал" };
  const added = hydrateEnv({ env, read: () => ENVIRON, platform: "linux" });

  assert.equal(env.OPENROUTER_API_KEY, "sk-or-v1-xxx");
  assert.equal(env.SITE_URL, "https://ai.mn");
  assert.equal(env.DATABASE_URL, "локал", "байгааг нь хэвээр");
  assert.ok(added.includes("OPENROUTER_API_KEY"));
  assert.ok(!added.includes("PWD"));
});
