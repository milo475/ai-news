/**
 * `scripts/prod.sh` нь аргументыг Railway-ийн shell рүү ЗӨВ дамжуулж байгаа эсэх.
 *
 * `--title "Урт гарчиг энд"` гэсэн зай бүхий утга гурван аргумент болж задарвал
 * article:fix нь буруу гарчиг хүлээж авна. RAILWAY_BIN-г `echo` болгож,
 * үүссэн командыг шалгана.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "prod.sh");

/** prod.sh-ийг жинхэнэ railway-гүйгээр ажиллуулж, гаргасан командыг буцаана */
function run(...args) {
  return execFileSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, RAILWAY_BIN: "/bin/echo" },
  });
}

test("--service ба DATABASE_PUBLIC_URL-ийг тавина", () => {
  const out = run("cost:report");
  assert.match(out, /run --service ai-news sh -c/);
  assert.match(out, /DATABASE_URL="\$DATABASE_PUBLIC_URL"/);
});

test("npm script-ийг npm run-аар дуудна", () => {
  assert.match(run("cost:report"), /npm run --silent cost:report/);
});

test("нэмэлт аргументууд дамжина", () => {
  assert.match(run("publish:audit", "--", "--days", "30", "--judge"), /publish:audit -- --days 30 --judge/);
});

test("ЗАЙ бүхий аргумент нэг бүхэлдээ дамжина", () => {
  const out = run("article:fix", "--", "--slug", "abc", "--title", "Урт гарчиг энд");
  // sh нь `\ ` -г нэг зай гэж уншина — гурван аргумент болж задрахгүй
  assert.match(out, /--title Урт\\ гарчиг\\ энд/);
});

test("prisma нь npx-ээр дуудагдана", () => {
  const out = run("prisma", "migrate", "deploy");
  assert.match(out, /npx prisma migrate deploy/);
  assert.doesNotMatch(out, /npm run/);
});

test("аргументгүй бол хэрэглээг хэвлээд унана", () => {
  assert.throws(() => run(), /Command failed/);
});

test("RAILWAY_SERVICE-ээр үйлчилгээг солино", () => {
  const out = execFileSync("bash", [SCRIPT, "cost:report"], {
    encoding: "utf8",
    env: { ...process.env, RAILWAY_BIN: "/bin/echo", RAILWAY_SERVICE: "ai-news-staging" },
  });
  assert.match(out, /--service ai-news-staging/);
});
