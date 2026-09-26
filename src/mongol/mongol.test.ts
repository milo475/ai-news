import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkLocal, dailyLocalLimit, KEYWORDS, LOCAL_MIN_SCORE, localUser, matches, mentionsSource,
  prefilter, stemMatches, STRONG_KEYWORDS, WEAK_KEYWORDS, type LocalOutput,
} from "./filter.api";
import {
  allowedByRobots, dueForFetch, extractLinks, FETCH_INTERVAL_HOURS, MAX_LINKS, parseRobots,
  USER_AGENT,
} from "../fetchers/html.api";
import { PROJECTS } from "./projects.seed";
import { localSection } from "../agent/digest.api";

// ——— Түлхүүр үгийн шүүлт ———

test("matches: кирилл үсэгт үгийн хил зөв ажиллана", () => {
  assert.equal(matches("Хиймэл оюун хөгжиж байна", "хиймэл оюун"), true);
  assert.equal(matches("ХИЙМЭЛ ОЮУН", "хиймэл оюун"), true, "том үсэг");
  // Үгийн дунд таарахгүй — «rain»-д «ai» байх ч хил нь үсэг
  assert.equal(matches("rain in spain", "ai"), false);
  assert.equal(matches("AI-ийн хөгжил", "ai"), true, "залгавар нь зураасаар салсан");
  assert.equal(matches("AI.", "ai"), true);
  assert.equal(matches("openai", "ai"), false, "үгийн дунд");
  // Хэт богино түлхүүр үг тооцогдохгүй
  assert.equal(matches("a b c", "a"), false);
});

test("stemMatches: залгавартай хэлбэрийг барина", () => {
  // «дижитал» → «дижиталжуулалтын»
  assert.equal(stemMatches("дижиталжуулалтын талаар", "дижитал"), true);
  assert.equal(stemMatches("технологийн дэвшил", "технологи"), true);
  // Үгийн ДУНД байвал таарахгүй
  assert.equal(stemMatches("хэтдижитал", "дижитал"), false);
  // Богино эсвэл латин үгэнд stem хэрэглэхгүй (хуурамч дохио)
  assert.equal(stemMatches("airport", "ai"), false);
  assert.equal(stemMatches("gptest", "gpt"), false);
});

test("prefilter: гарчиг дээр 1 үг хангалттай", () => {
  const r = prefilter("Хиймэл оюун Монголд хэрхэн хөгжиж байна");
  assert.equal(r.pass, true);
  assert.equal(r.inTitle, true);
  assert.equal(r.strong, true);
  assert.ok(r.hits.includes("хиймэл оюун"));

  // Сул үг ч гарчиг дээр бол хангалттай — гарчиг нь редакцийн дохио
  const weak = prefilter("Технологийн шинэ дэвшил");
  assert.equal(weak.pass, true);
  assert.equal(weak.inTitle, true);
  assert.equal(weak.strong, false);
});

test("prefilter: зөвхөн биед сул үг 1 таарвал ДАВАХГҮЙ", () => {
  // Бодит хуурамч дохио: УИХ-ын мэдээний биед «технологи» гэсэн үг байна
  const fake = prefilter(
    "УИХ-ын дарга С.Бямбацогт парламент дахь таван намын дарга нартай уулзав",
    "Уулзалтад эдийн засаг, технологи, боловсролын асуудлыг хэлэлцэв.",
  );
  assert.equal(fake.pass, false, "сул үг дангаараа биед таарах нь хангалтгүй");
  assert.equal(fake.inTitle, false);
  assert.deepEqual(fake.hits, ["технологи"]);

  // Хоёр сул үг бол давна
  const two = prefilter("Сайдын уулзалт", "Цахим хөгжлийн сайд өгөгдөл, технологийн талаар");
  assert.equal(two.pass, true);
  assert.ok(two.hits.length >= 2);

  // Хүчтэй үг 1 биед таарвал давна
  const strong = prefilter("Эвент тойм", "Хиймэл оюуны шийдлүүдийг танилцуулна");
  assert.equal(strong.pass, true);
  assert.equal(strong.strong, true);

  // Юу ч таараагүй
  assert.equal(prefilter("Хөл бөмбөгийн тэмцээн", "Манай баг хоёр гоол хийв").pass, false);
});

test("түлхүүр үгийн жагсаалт: хүчтэй/сул хоорондоо давхцахгүй", () => {
  const strong = new Set<string>(STRONG_KEYWORDS);
  for (const w of WEAK_KEYWORDS) assert.ok(!strong.has(w), `${w} хоёуланд байна`);
  assert.equal(KEYWORDS.length, STRONG_KEYWORDS.length + WEAK_KEYWORDS.length);
  // Бүгд жижиг үсгээр (matches нь жижиг үсгээр харьцуулна)
  for (const k of KEYWORDS) assert.equal(k, k.toLowerCase(), k);
});

// ——— Дотоод товчлолын шалгуур ———

const GOOD: LocalOutput = {
  titleMn: "Монголын банкууд хиймэл оюуныг зээлийн шинжилгээнд хэрэглэж байна",
  summaryMn: "Дотоодын хоёр банк зээлийн хүсэлтийг шалгахад машин сургалт нэвтрүүлжээ.",
  bodyMn:
    "ikon.mn-ийн мэдээлснээр Монголын хоёр томоохон банк зээлийн хүсэлтийг урьдчилан " +
    "шалгахад хиймэл оюуны шийдэл нэвтрүүлсэн байна. " +
    Array.from({ length: 130 }, () => "үг").join(" "),
  tags: ["банк", "хиймэл оюун"],
};

test("checkLocal: эх сурвалжийн нэр биед байхыг шаардана", () => {
  assert.deepEqual(checkLocal(GOOD, "ikon.mn"), []);

  const codes = (d: Partial<LocalOutput>, source = "ikon.mn") =>
    checkLocal({ ...GOOD, ...d }, source).map((p) => p.code);

  // Эх сурвалж дурдаагүй — гол зөрчил
  assert.ok(
    codes({ bodyMn: Array.from({ length: 150 }, () => "үг").join(" ") }).includes("no-source"),
  );
  assert.ok(codes({ titleMn: "х".repeat(71) }).includes("title-long"));
  assert.ok(codes({ bodyMn: "ikon.mn богино" }).includes("body-short"));
  assert.ok(
    codes({ bodyMn: `ikon.mn ${Array.from({ length: 400 }, () => "үг").join(" ")}` }).includes("body-long"),
  );
  assert.ok(codes({ titleMn: "Гарчиг 🚀" }).includes("emoji"));
  assert.deepEqual(codes({ bodyMn: "" }), ["empty"]);
});

test("mentionsSource: домэйн, нэрийн хоёр хэлбэр", () => {
  assert.equal(mentionsSource("ikon.mn-ийн мэдээлснээр", "ikon.mn"), true);
  assert.equal(mentionsSource("Ikon.MN гэж бичжээ", "ikon.mn"), true, "том жижиг үсэг");
  // Домэйны эхний хэсгээр ч тооцно
  assert.equal(mentionsSource("iKon сайтын мэдээгээр", "ikon.mn"), true);
  assert.equal(mentionsSource("МОНЦАМЭ агентлагийн мэдээ", "МОНЦАМЭ"), true);
  assert.equal(mentionsSource("Өөр сайтын мэдээ", "ikon.mn"), false);
  assert.equal(mentionsSource("текст", ""), false);
});

test("localUser: эх сурвалжийн нэр prompt-д тодоор орно", () => {
  const user = localUser({
    sourceName: "ITOIM", title: "Гарчиг", excerpt: "Лид", text: "Бүтэн текст",
  });
  assert.match(user, /ЭХ СУРВАЛЖ \(заавал дурдана\): ITOIM/);
  assert.match(user, /Гарчиг: Гарчиг/);
  assert.match(user, /Лид/);
  assert.match(user, /Бүтэн текст/);
});

test("дотоод квот ба босго", () => {
  assert.equal(LOCAL_MIN_SCORE, 6, "дэлхийн мэдээнээс доогуур");
  assert.equal(dailyLocalLimit({}), 1);
  assert.equal(dailyLocalLimit({ DAILY_LOCAL_LIMIT: "3" }), 3);
  assert.equal(dailyLocalLimit({ DAILY_LOCAL_LIMIT: "0" }), 0, "0 = автоматаар нийтлэхгүй");
  assert.equal(dailyLocalLimit({ DAILY_LOCAL_LIMIT: "тоо биш" }), 1);
  assert.equal(dailyLocalLimit({ DAILY_LOCAL_LIMIT: "-2" }), 1);
});

// ——— HTML fetcher ———

const LISTING = `<html><body>
  <article><h3><a href="/news/1">Хиймэл оюуны шинэ шийдэл Монголд</a></h3></article>
  <article><h3><a href="/news/2">Технологийн салбарын өсөлт</a></h3></article>
  <article><h3><a href="/news/1#comments">Хиймэл оюуны шинэ шийдэл Монголд</a></h3></article>
  <article><h3><a href="https://facebook.com/x">Гадны холбоос орохгүй</a></h3></article>
  <article><h3><a href="/news/3">Богино</a></h3></article>
  <article><h3><a href="/news/4"><img src="x"></a></h3></article>
  <article><h3><a href="javascript:void(0)">Скрипт холбоос орохгүй</a></h3></article>
</body></html>`;

test("extractLinks: ижил хост, давхардалгүй, гарчигтай", () => {
  const links = extractLinks(LISTING, "https://ikon.mn/list", "article a");
  assert.deepEqual(links.map((l) => l.url), [
    "https://ikon.mn/news/1",
    "https://ikon.mn/news/2",
  ]);
  assert.equal(links[0]!.title, "Хиймэл оюуны шинэ шийдэл Монголд");

  // Selector нь <a>-ийн эцгийг заасан ч ажиллана
  assert.equal(extractLinks(LISTING, "https://ikon.mn/list", "article h3").length, 2);
  // Буруу selector — хоосон, унахгүй
  assert.deepEqual(extractLinks(LISTING, "https://ikon.mn/list", "!!!буруу"), []);
  assert.deepEqual(extractLinks("", "https://ikon.mn/list", "a"), []);
  assert.ok(MAX_LINKS > 0);
  assert.match(USER_AGENT, /^AINewsBot\/1\.0 \(\+https:\/\/ai-news\.mn\)$/);
});

test("parseRobots: бидний нэрийн блок нь * -аас давуу", () => {
  const txt = `
User-agent: *
Disallow: /private
Crawl-delay: 5

User-agent: AINewsBot
Disallow: /secret
`;
  const rules = parseRobots(txt);
  assert.deepEqual(rules.disallow, ["/secret"], "зөвхөн бидний блок");
  assert.equal(rules.crawlDelay, null, "бидний блокт delay байхгүй");

  // Бидний блок байхгүй бол *-ийнх
  const star = parseRobots("User-agent: *\nDisallow: /admin\nCrawl-delay: 2");
  assert.deepEqual(star.disallow, ["/admin"]);
  assert.equal(star.crawlDelay, 2);

  // Коммент, хоосон Disallow
  const comments = parseRobots("# тайлбар\nUser-agent: *\nAllow: /\nDisallow:");
  assert.deepEqual(comments.disallow, [], "хоосон Disallow нь хориг биш");

  // Дараалсан User-agent мөрүүд нэг блок
  const multi = parseRobots("User-agent: a\nUser-agent: ainewsbot\nDisallow: /x");
  assert.deepEqual(multi.disallow, ["/x"]);

  assert.deepEqual(parseRobots("").disallow, []);
});

test("allowedByRobots: замын хориг", () => {
  const rules = { disallow: ["/private", "/tmp/*/secret"], crawlDelay: null };
  assert.equal(allowedByRobots(rules, "https://a.mn/news/1"), true);
  assert.equal(allowedByRobots(rules, "https://a.mn/private"), false);
  assert.equal(allowedByRobots(rules, "https://a.mn/private/deep"), false, "префикс");
  assert.equal(allowedByRobots(rules, "https://a.mn/tmp/x/secret"), false, "* дүрэм");
  assert.equal(allowedByRobots(rules, "https://a.mn/tmp/x/public"), true);

  // Бүх зүйл хориотой
  assert.equal(allowedByRobots({ disallow: ["/"], crawlDelay: null }, "https://a.mn/x"), false);
  // Хориггүй
  assert.equal(allowedByRobots({ disallow: [], crawlDelay: null }, "https://a.mn/x"), true);
  // Эвдэрсэн хаяг
  assert.equal(allowedByRobots({ disallow: [], crawlDelay: null }, "эвдэрсэн"), false);
});

test("dueForFetch: 24 цагт нэг удаа", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  assert.equal(FETCH_INTERVAL_HOURS, 24);
  assert.equal(dueForFetch(null, now), true, "хэзээ ч татаагүй");
  assert.equal(dueForFetch(new Date("2026-09-26T06:00:00Z"), now), false, "6 цаг");
  assert.equal(dueForFetch(new Date("2026-09-25T11:00:00Z"), now), true, "25 цаг");
  assert.equal(dueForFetch(new Date("2026-09-25T12:00:00Z"), now), true, "яг 24 цаг");
});

// ——— Төслүүд ———

test("PROJECTS: slug давхардахгүй, хаяг https, тайлбартай", () => {
  assert.ok(PROJECTS.length >= 5, `${PROJECTS.length} төсөл`);
  assert.equal(new Set(PROJECTS.map((p) => p.slug)).size, PROJECTS.length);
  assert.equal(new Set(PROJECTS.map((p) => p.website)).size, PROJECTS.length);
  for (const p of PROJECTS) {
    assert.match(p.slug, /^[a-z0-9-]+$/, p.slug);
    assert.ok(p.website.startsWith("https://"), p.website);
    assert.ok(p.description.length >= 40, `${p.name}: тайлбар хэт богино`);
    assert.ok(p.category.length > 0, p.name);
  }
});

// ——— Digest ———

test("localSection: мэдээгүй бол хэсэг огт гарахгүй", () => {
  assert.equal(localSection([]), "");
  const s = localSection([
    { slug: "a", titleMn: "Гарчиг А", summaryMn: "", relevance: 8, sourceName: "ikon.mn" },
  ]);
  assert.match(s, /^## Монголд/);
  assert.match(s, /\[Гарчиг А\]\(\/medee\/a\) — ikon\.mn/);
});
