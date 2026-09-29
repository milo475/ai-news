import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIGEST_DISCLOSURE, FALSE_CLAIMS, FOOTER_DISCLOSURE, hasFalseClaim, NEWS_DISCLOSURE,
  TOOLS_DISCLOSURE,
} from "./disclosure.api";

const ALL = [NEWS_DISCLOSURE, DIGEST_DISCLOSURE, FOOTER_DISCLOSURE, TOOLS_DISCLOSURE];

test("мэдэгдлүүд хүний хяналтыг ХЭЛЭХГҮЙ", () => {
  // Нийтлэл нь reviewedBy: "auto" -оор гардаг — хүн хянадаггүй
  for (const text of ALL) assert.equal(hasFalseClaim(text), null, text.slice(0, 60));
});

test("мэдэгдлүүд автомат шалгалтыг дурдана", () => {
  assert.match(NEWS_DISCLOSURE, /автоматаар тулган шалгасан/);
  assert.match(DIGEST_DISCLOSURE, /автоматаар тулган шалгасан/);
  assert.match(FOOTER_DISCLOSURE, /автоматаар тулган шалгадаг/);
  for (const text of ALL) assert.match(text, /хиймэл оюун/i, text.slice(0, 40));
});

test("худал мэдэгдлийг таана", () => {
  assert.equal(hasFalseClaim("Энэ хураангуйг редактор хянан нийтэлсэн."), "редактор хянан");
  assert.equal(hasFalseClaim("AI agent бэлтгэж, хүн хянан нийтэлдэг"), "хүн хянан");
  assert.equal(hasFalseClaim("Энэ жагсаалтыг хүн бэлтгэсэн."), "хүн бэлтгэсэн");
  assert.ok(FALSE_CLAIMS.length >= 5);
});

/** src/ доторх бүх эх файлыг цуглуулна (generated, тестээс бусад) */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules") continue;
      sourceFiles(full, out);
    } else if (/\.(ts|tsx|md|json)$/.test(e.name) && !e.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

test("src/ БҮХЭЛД нь худал мэдэгдэл алга", () => {
  // Регресс хамгаалалт: тодорхой файл биш, бүхэл модулийг шүүрдэнэ.
  // Хэрэв шинэ хуудас «редактор хянасан» гэж бичвэл энд баригдана.
  const root = join(process.cwd(), "src");
  const bad: string[] = [];

  for (const file of sourceFiles(root)) {
    // Энэ модуль өөрөө хориотой хэллэгүүдийн жагсаалтыг агуулна
    if (file.endsWith("disclosure.api.ts")) continue;
    const claim = hasFalseClaim(readFileSync(file, "utf8"));
    if (claim) bad.push(`${file.replace(root, "src")} — «${claim}»`);
  }

  assert.deepEqual(bad, [], `Худал мэдэгдэл:\n${bad.join("\n")}`);
});
