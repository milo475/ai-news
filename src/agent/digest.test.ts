import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assembleBody, checkDigest, dedupeItems, isDigestDay, MIN_ARTICLES, rankingSection,
  sameTopic, sectionMarkdown, titleTokens, weekLabel,
  type DigestOut, type DigestSource, type RankingChange,
  cleanOutline, DIGEST_MAX_TOKENS, resolveOutline, DIGEST_OUTLINE_SCHEMA, fillUnused, OUTLINE_MAX_TOKENS,
  SECTION_MAX_TOKENS,
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
      {
        heading: "Шинэ моделиуд",
        body: "Энэ долоо хоногт хоёр том лаборатори загвараа зэрэг танилцуулав.\n\nХоёр дахь догол мөр.",
        slugs: ["a", "b"],
      },
      { heading: "Зохицуулалт", body: "Зохицуулагчид шинэ шаардлага тавилаа.", slugs: ["c"] },
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

// ---------- Хэсэгчилсэн горим ----------

const KNOWN = ["a", "b", "c", "d"];

test("cleanOutline: зохиосон slug-ийг шүүж, мэдээгүй хэсгийг хаяна", () => {
  const out = cleanOutline(
    {
      titleMn: "T", leadMn: "L", nextWeek: ["1", "2", "3"],
      sections: [
        { heading: "Байгаа", slugs: ["a", "зохиосон", "b"] },
        { heading: "Бүгд зохиомол", slugs: ["алга-1", "алга-2"] },
        { heading: "Давхардсан", slugs: ["c", "c"] },
      ],
    },
    KNOWN,
  );
  assert.deepEqual(out.sections, [
    { heading: "Байгаа", slugs: ["a", "b"] },
    { heading: "Давхардсан", slugs: ["c"] },
  ]);
  assert.equal(out.titleMn, "T", "бусад талбар хэвээр");
});

test("fillUnused: аль ч хэсэгт ороогүй мэдээ сүүлийн хэсэгт нэмэгдэнэ", () => {
  const out = fillUnused(
    {
      titleMn: "T", leadMn: "L", nextWeek: [],
      sections: [{ heading: "Нэг", slugs: ["a"] }, { heading: "Хоёр", slugs: ["b"] }],
    },
    KNOWN,
  );
  assert.deepEqual(out.sections.map((s) => s.slugs), [["a"], ["b", "c", "d"]]);
});

test("fillUnused: бүх мэдээ орсон бол хөндөхгүй", () => {
  const sections = [{ heading: "Нэг", slugs: ["a", "b"] }, { heading: "Хоёр", slugs: ["c", "d"] }];
  const out = fillUnused({ titleMn: "T", leadMn: "L", nextWeek: [], sections }, KNOWN);
  assert.deepEqual(out.sections, sections);
});

test("fillUnused: хэсэггүй бол юу ч хийхгүй (unused мэдээ хаана ч очихгүй)", () => {
  const out = fillUnused({ titleMn: "T", leadMn: "L", nextWeek: [], sections: [] }, KNOWN);
  assert.deepEqual(out.sections, []);
});

test("токены хязгаар: нэг дуудлага 8000, хэсэгчилсэн нь түүнээс бага", () => {
  assert.equal(DIGEST_MAX_TOKENS, 8_000, "4000 нь монгол тоймд хүрэлцэхгүй байсан");
  assert.ok(OUTLINE_MAX_TOKENS < DIGEST_MAX_TOKENS);
  assert.ok(SECTION_MAX_TOKENS < DIGEST_MAX_TOKENS);
});

test("DIGEST_OUTLINE_SCHEMA: биеийг БИШ, зөвхөн бүтцийг нэхнэ", () => {
  const props = DIGEST_OUTLINE_SCHEMA.properties.sections.items.properties as Record<string, unknown>;
  assert.ok("heading" in props);
  assert.ok("slugs" in props);
  assert.ok(!("body" in props), "бүтцийн дуудлагад бие орох ёсгүй");
});

test("resolveOutline: бүх slug зохиомол байвал гарчгуудыг үлдээж мэдээг тэнцүү хуваана", () => {
  const out = resolveOutline(
    {
      titleMn: "T", leadMn: "L", nextWeek: [],
      sections: [
        { heading: "Моделиуд", slugs: ["алга-1"] },
        { heading: "Бизнес", slugs: ["алга-2", "алга-3"] },
      ],
    },
    KNOWN,
  );
  // Тойм унахгүй — 4 мэдээ 2 хэсэгт ээлжлэн хуваагдана
  assert.deepEqual(out.sections, [
    { heading: "Моделиуд", slugs: ["a", "c"] },
    { heading: "Бизнес", slugs: ["b", "d"] },
  ]);
});

test("resolveOutline: хэвийн үед цэвэрлээд дутууг нөхнө", () => {
  const out = resolveOutline(
    {
      titleMn: "T", leadMn: "L", nextWeek: [],
      sections: [{ heading: "Нэг", slugs: ["a", "зохиомол"] }, { heading: "Хоёр", slugs: ["b"] }],
    },
    KNOWN,
  );
  assert.deepEqual(out.sections, [
    { heading: "Нэг", slugs: ["a"] },
    { heading: "Хоёр", slugs: ["b", "c", "d"] },
  ]);
});

test("resolveOutline: мэдээ ч, гарчиг ч байхгүй бол хоосон", () => {
  assert.deepEqual(
    resolveOutline({ titleMn: "T", leadMn: "L", nextWeek: [], sections: [{ heading: "Нэг", slugs: ["x"] }] }, []).sections,
    [],
  );
  assert.deepEqual(
    resolveOutline({ titleMn: "T", leadMn: "L", nextWeek: [], sections: [] }, KNOWN).sections,
    [],
  );
});

// ---------- Холбоосыг өгүүлбэрээс салгах (2026-09-27-ны тойм) ----------

test("хэсгийн холбоосууд биеийн ДООР жагсаалтаар гарна", () => {
  const items = [item("a", "OpenAI зардлыг 50% бууруулсан GPT-6 Sol, Luna-г танилцууллаа")];
  const md = sectionMarkdown(
    {
      heading: "Үнэ ба загвар",
      body: "OpenAI энэ долоо хоногт API үнээ хагасаар бууруулж, хоёр шинэ загвараа танилцуулав.",
      slugs: ["a"],
    },
    new Map(items.map((x) => [x.slug, x])),
  );

  assert.match(md, /^## Үнэ ба загвар/);
  assert.match(md, /\*\*Энэ хэсгийн мэдээ:\*\*/);
  assert.match(md, /- \[OpenAI зардлыг 50% бууруулсан GPT-6 Sol, Luna-г танилцууллаа\]\(\/medee\/a\)/);
  // Өгүүлбэрийн хэсэгт холбоос байхгүй
  const prose = md.split("**Энэ хэсгийн мэдээ:**")[0]!;
  assert.ok(!/\]\(/.test(prose), prose);
});

test("мэдээгүй хэсэгт жагсаалт нэмэхгүй", () => {
  const md = sectionMarkdown({ heading: "Тойм", body: "Текст.", slugs: [] }, new Map());
  assert.ok(!md.includes("Энэ хэсгийн мэдээ"));
});

test("байхгүй slug-ийг жагсаалтад оруулахгүй", () => {
  const md = sectionMarkdown(
    { heading: "Тойм", body: "Текст.", slugs: ["a", "байхгүй"] },
    new Map([["a", item("a", "Эхний")]]),
  );
  assert.match(md, /\/medee\/a/);
  assert.ok(!md.includes("байхгүй"));
});

// ---------- Ижил сэдвийн давхардал ----------

test("нэг мэдээний хоёр нийтлэлийг ижил сэдэв гэж таана", () => {
  // 2026-09-27-ны тоймд давхар орсон бодит хос
  assert.equal(
    sameTopic(
      "OpenAI зардлыг 50% бууруулсан GPT-6 Sol, Luna-г танилцууллаа",
      "OpenAI GPT-6 Sol болон Luna загваруудаа танилцууллаа",
    ),
    true,
  );
});

test("өөр сэдвийг нэгтгэхгүй", () => {
  assert.equal(
    sameTopic(
      "OpenAI GPT-6 Sol болон Luna загваруудаа танилцууллаа",
      "Европын холбоо хиймэл оюуны шинэ журам баталлаа",
    ),
    false,
  );
  assert.equal(
    sameTopic("Google Gemini 4 загвараа гаргалаа", "OpenAI GPT-6 загвараа гаргалаа"),
    false,
  );
});

test("монгол нөхцөлийг таслаж харьцуулна", () => {
  const t = titleTokens("Luna-г танилцууллаа");
  assert.ok(t.has("luna"), [...t].join(","));
  // Утгагүй богино үг, холбоос үгсийг хасна
  assert.ok(!t.has("болон"));
});

test("давхардлыг хасахдаа эхнийхийг (өндөр оноотойг) үлдээнэ", () => {
  const list = [
    item("a", "OpenAI зардлыг 50% бууруулсан GPT-6 Sol, Luna-г танилцууллаа"),
    item("b", "Европын холбоо хиймэл оюуны шинэ журам баталлаа"),
    item("c", "OpenAI GPT-6 Sol болон Luna загваруудаа танилцууллаа"),
  ];
  const { kept, dropped } = dedupeItems(list);
  assert.deepEqual(kept.map((x) => x.slug), ["a", "b"]);
  assert.deepEqual(dropped.map((x) => x.slug), ["c"]);
});

// ---------- Нийтлэхийн өмнөх механик шалгалт ----------

const ITEMS = [
  item("a", "OpenAI зардлыг 50% бууруулсан GPT-6 Sol, Luna-г танилцууллаа"),
  item("b", "Европын холбоо хиймэл оюуны шинэ журам баталлаа"),
];

function digest(sections: DigestOut["sections"]): DigestOut {
  return { titleMn: "Тойм", leadMn: "Тойм", sections, nextWeek: ["a", "b", "c"] };
}

const GOOD_BODY =
  "OpenAI энэ долоо хоногт API үнээ хагасаар бууруулж, хоёр шинэ загвараа танилцуулав. " +
  "Энэ нь өрсөлдөгчдөд шууд дарамт болох нь ойлгомжтой байна.";

test("цэвэр тойм алдаагүй", () => {
  assert.deepEqual(checkDigest(digest([{ heading: "Үнэ", body: GOOD_BODY, slugs: ["a"] }]), ITEMS), []);
});

test("өгүүлбэрт шигтгэсэн бүтэн гарчгийг барина", () => {
  // 2026-09-27-ны бодит эвдрэл
  const broken =
    "OpenAI компани зардал болон API үнийг 50 хувиар бууруулсан " +
    "OpenAI зардлыг 50% бууруулсан GPT-6 Sol, Luna-г танилцууллаа мөн мэдэгдлийг гаргав. " +
    "Энэ нь салбарт томоохон нөлөө үзүүлэх нь тодорхой боллоо.";
  const issues = checkDigest(digest([{ heading: "Үнэ", body: broken, slugs: ["a"] }]), ITEMS);
  assert.ok(issues.some((i) => i.problem === "өгүүлбэрт бүтэн гарчиг"), JSON.stringify(issues));
});

test("өгүүлбэрт үлдсэн markdown холбоосыг барина", () => {
  const issues = checkDigest(
    digest([{ heading: "Үнэ", body: `${GOOD_BODY} [Эхний мэдээ](/medee/a) гарлаа.`, slugs: ["a"] }]),
    ITEMS,
  );
  assert.ok(issues.some((i) => i.problem === "өгүүлбэрт холбоос"), JSON.stringify(issues));
});

test("«[...]» үлдэгдлийг барина", () => {
  const issues = checkDigest(
    digest([{ heading: "Үнэ", body: `${GOOD_BODY} [...] мэдэгдлийг гаргав.`, slugs: ["a"] }]),
    ITEMS,
  );
  assert.ok(issues.some((i) => i.problem === "slug үлдэгдэл"), JSON.stringify(issues));
});

test("биед үлдсэн slug-ийг барина", () => {
  const issues = checkDigest(
    digest([{ heading: "Үнэ", body: `${GOOD_BODY} Дэлгэрэнгүйг /medee/openai-gpt-6-sol харна уу.`, slugs: ["a"] }]),
    ITEMS,
  );
  assert.ok(issues.some((i) => i.problem === "slug үлдэгдэл"), JSON.stringify(issues));
});

test("хоосон хэсгийг барина", () => {
  const issues = checkDigest(digest([{ heading: "Үнэ", body: "Богино.", slugs: ["a"] }]), ITEMS);
  assert.ok(issues.some((i) => i.problem === "хоосон хэсэг"), JSON.stringify(issues));
});

test("нэг мэдээ хоёр хэсэгт орвол барина", () => {
  const issues = checkDigest(
    digest([
      { heading: "Үнэ", body: GOOD_BODY, slugs: ["a"] },
      { heading: "Загвар", body: GOOD_BODY, slugs: ["a", "b"] },
    ]),
    ITEMS,
  );
  assert.ok(issues.some((i) => i.problem === "давхардсан мэдээ" && i.detail === "a"), JSON.stringify(issues));
});

test("хэсэггүй тойм нийтлэгдэхгүй", () => {
  assert.deepEqual(checkDigest(digest([]), ITEMS), [{ problem: "хэсэггүй", detail: "тоймд нэг ч хэсэг алга" }]);
});
