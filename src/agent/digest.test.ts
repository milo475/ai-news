import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assembleBody, isDigestDay, MIN_ARTICLES, rankingSection, weekLabel,
  type DigestOut, type DigestSource, type RankingChange,
} from "./digest.api";

const EMPTY: RankingChange = {
  enteredTop10: [], leftTop10: [], biggestRise: null, biggestFall: null, arenaNew: [],
};

const item = (slug: string, titleMn: string, relevance = 9): DigestSource => ({
  slug, titleMn, relevance, summaryMn: `${titleMn} — хураангуй.`, sourceName: "TechCrunch AI",
});

test("isDigestDay: зөвхөн Ням гараг (UTC)", () => {
  // 2026-09-20 бол Ням гараг
  assert.equal(isDigestDay(new Date("2026-09-20T00:00:00Z")), true);
  assert.equal(isDigestDay(new Date("2026-09-20T23:59:59Z")), true);
  assert.equal(isDigestDay(new Date("2026-09-21T00:00:00Z")), false); // Даваа
  assert.equal(isDigestDay(new Date("2026-09-19T12:00:00Z")), false); // Бямба
  assert.equal(isDigestDay(new Date("2026-09-27T06:00:00Z")), true);  // дараагийн Ням
});

test("weekLabel", () => {
  assert.equal(weekLabel(new Date("2026-09-15T00:00:00Z"), new Date("2026-09-21T00:00:00Z")), "9/15–9/21");
});

test("MIN_ARTICLES: 3-аас цөөн мэдээнд digest үүсгэхгүй", () => {
  assert.equal(MIN_ARTICLES, 3);
  const few = [item("a", "Нэг"), item("b", "Хоёр")];
  assert.ok(few.length < MIN_ARTICLES, "2 мэдээ нь босго хангахгүй");
  const enough = [...few, item("c", "Гурав")];
  assert.ok(enough.length >= MIN_ARTICLES);
});

test("rankingSection: LLM-гүйгээр жагсаалтын өөрчлөлтийг бичнэ", () => {
  const md = rankingSection({
    enteredTop10: [{ name: "GLM 5.3 Flash", slug: "z-ai/glm-5.3-flash", rank: 2 }],
    leftTop10: [{ name: "Hy3", slug: "tencent/hy3" }],
    biggestRise: { name: "GLM 5.3 Flash", slug: "z-ai/glm-5.3-flash", delta: 4 },
    biggestFall: { name: "Hy4 preview", slug: "tencent/hy4-preview", delta: -6 },
    arenaNew: [{ name: "ernie-5.1", slug: "ernie51", rank: 24 }],
  });
  assert.match(md, /^## Жагсаалтын өөрчлөлт/);
  assert.match(md, /\[GLM 5\.3 Flash\]\(\/model\/z-ai\/glm-5\.3-flash\) \(#2\)/);
  assert.match(md, /Топ 10-оос гарсан:\*\* \[Hy3\]/);
  assert.match(md, /4 байр дээшилсэн/);
  assert.match(md, /6 байр буурсан/);   // сөрөг утгыг эерэгээр бичнэ
  assert.match(md, /\[ernie-5\.1\]\(\/model\/ernie51\) \(#24\)/);

  assert.match(rankingSection(EMPTY), /томоохон өөрчлөлт гараагүй/);
});

test("assembleBody: LLM-ийн хариуг бүтэн нийтлэл болгоно", () => {
  // LLM-ийг дуурайлган бэлэн хариу өгнө — сүлжээ хэрэггүй
  const llm: DigestOut = {
    titleMn: "AI-ийн долоо хоног: 9/15–9/21",
    leadMn: "Энэ долоо хоногт хоёр том модель гарлаа.",
    sections: [
      { heading: "Шинэ моделиуд", body: "[Эхний мэдээ](/medee/a) гарлаа.\n\nХоёр дахь догол мөр." },
      { heading: "Зохицуулалт", body: "[Гурав дахь](/medee/c) мэдээ." },
    ],
    nextWeek: ["Нэг", "Хоёр", "Гурав"],
  };
  const items = [item("a", "Эхний мэдээ"), item("b", "Хоёр дахь"), item("c", "Гурав дахь")];
  const body = assembleBody(llm, EMPTY, items);

  assert.match(body, /## Шинэ моделиуд/);
  assert.match(body, /## Зохицуулалт/);
  assert.match(body, /## Жагсаалтын өөрчлөлт/);
  assert.match(body, /## Дараагийн долоо хоногт анхаарах\n\n- Нэг\n- Хоёр\n- Гурав/);
  // Орсон мэдээ бүр эх нийтлэл рүүгээ холбоостой
  assert.match(body, /## Энэ digest-д орсон мэдээ/);
  for (const a of items) assert.ok(body.includes(`[${a.titleMn}](/medee/${a.slug})`), `${a.slug} холбоосгүй`);
  // Гарчиг, lead нь биед давхардахгүй (тэдгээр нь titleMn/summaryMn болно)
  assert.ok(!body.includes(llm.leadMn));
});
