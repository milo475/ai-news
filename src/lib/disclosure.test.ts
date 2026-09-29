import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("ХЭРЭГЛЭГЧИД ХАРАГДАХ хуудсуудад худал мэдэгдэл үлдээгүй", () => {
  // Регресс хамгаалалт: дахин «редактор хянасан» гэж бичигдэхээс сэргийлнэ
  const pages = [
    "src/app/layout.tsx",
    "src/app/medee/[slug]/page.tsx",
    "src/app/hereglee/[slug]/page.tsx",
    "src/lib/jsonld.api.ts",
  ];
  for (const p of pages) {
    const text = readFileSync(join(process.cwd(), p), "utf8");
    const bad = hasFalseClaim(text);
    assert.equal(bad, null, `${p} дотор «${bad}»`);
  }
});
