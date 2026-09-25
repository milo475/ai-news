import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clamp, faqJsonLd, guideUrl, howToJsonLd, isoDuration, MAX_META_DESCRIPTION, MAX_META_TITLE,
  sitemapEntries, STATIC_PATHS, type GuideSeoInput,
} from "./seo.api";
import { siteUrl } from "../lib/site";

const SITE = "https://ai-news.mn";

const GUIDE: GuideSeoInput = {
  slug: "chatgpt-mongoloor",
  title: "ChatGPT-г монголоор ашиглах",
  lead: "ChatGPT-г монгол хэлээр ашиглах үндсэн алхмууд. Бүртгэлээс эхлээд эхний хариулт хүртэл.",
  bodyMd: [
    "## 1. Бүртгүүлэх",
    "chat.openai.com руу орж бүртгүүлнэ.",
    "",
    "```prompt",
    "Чи миний туслах.",
    "```",
    "",
    "## 2. Асуух",
    "Асуултаа тодорхой бич.",
  ].join("\n"),
  readMinutes: 7,
  faq: [{ q: "Үнэгүй юу?", a: "Үндсэн хувилбар үнэгүй." }],
  publishedAt: new Date("2026-09-20T00:00:00Z"),
  updatedAt: new Date("2026-09-25T00:00:00Z"),
  hasHero: true,
};

test("clamp: үгийн дунд таслахгүй, урт нь хязгаарт багтана", () => {
  assert.equal(clamp("Богино гарчиг", MAX_META_TITLE), "Богино гарчиг");
  const long = clamp("х".repeat(200), MAX_META_DESCRIPTION);
  assert.ok(long.length <= MAX_META_DESCRIPTION);
  assert.ok(long.endsWith("…"));

  const words = clamp("нэг хоёр гурав дөрөв тав зургаа долоо найм ес арав", 30);
  assert.ok(words.length <= 30);
  assert.ok(!words.includes("  "));
  assert.ok(!/\s…$/.test(words), "тасалсан зайн ард цэг таслахгүй");

  assert.equal(clamp("  олон   зайтай  ", 50), "олон зайтай", "зай цэгцэрнэ");
});

test("isoDuration / guideUrl", () => {
  assert.equal(isoDuration(7), "PT7M");
  assert.equal(isoDuration(0), "PT1M", "доод хязгаар");
  assert.equal(guideUrl("https://ai-news.mn/", "test"), "https://ai-news.mn/zaavar/test");
});

test("howToJsonLd: алхмууд h2-оос, зураг ба огноотой", () => {
  const ld = howToJsonLd(GUIDE, SITE) as Record<string, unknown>;
  assert.equal(ld["@context"], "https://schema.org");
  assert.equal(ld["@type"], "HowTo");
  assert.equal(ld.name, GUIDE.title);
  assert.equal(ld.totalTime, "PT7M");
  assert.equal(ld.inLanguage, "mn");
  assert.equal(ld.image, `${SITE}/api/guide-image/${GUIDE.slug}`);
  assert.equal(ld.datePublished, "2026-09-20T00:00:00.000Z");
  assert.equal(ld.dateModified, "2026-09-25T00:00:00.000Z");

  const steps = ld.step as Record<string, unknown>[];
  assert.equal(steps.length, 2);
  assert.equal(steps[0]!["@type"], "HowToStep");
  assert.equal(steps[0]!.position, 1);
  assert.equal(steps[0]!.name, "1. Бүртгүүлэх");
  assert.match(String(steps[0]!.text), /chat\.openai\.com/);
  assert.match(String(steps[0]!.url), /^https:\/\/ai-news\.mn\/zaavar\/chatgpt-mongoloor#/);
  assert.equal(steps[1]!.position, 2);

  // Зураггүй заавар — image талбар огт байхгүй
  assert.ok(!("image" in howToJsonLd({ ...GUIDE, hasHero: false }, SITE)));
  // JSON болгоход унахгүй
  assert.ok(JSON.parse(JSON.stringify(ld)));
});

test("faqJsonLd: FAQPage бүтэц, хоосон бол null", () => {
  assert.equal(faqJsonLd([]), null);
  const ld = faqJsonLd(GUIDE.faq) as Record<string, unknown>;
  assert.equal(ld["@type"], "FAQPage");
  const items = ld.mainEntity as Record<string, unknown>[];
  assert.equal(items.length, 1);
  assert.equal(items[0]!["@type"], "Question");
  assert.equal(items[0]!.name, "Үнэгүй юу?");
  assert.deepEqual(items[0]!.acceptedAnswer, { "@type": "Answer", text: "Үндсэн хувилбар үнэгүй." });
});

test("sitemapEntries: мэдээ, заавар, модель, хэрэглээ бүгд орно", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  const entries = sitemapEntries({
    siteUrl: `${SITE}/`,
    articles: [{ slug: "medee-1", publishedAt: now, updatedAt: now }],
    guides: [{ slug: "zaavar-1", updatedAt: now }],
    models: [{ slug: "openai/gpt-6", updatedAt: now }],
    useCases: [{ slug: "zurag", updatedAt: now }],
  });
  const urls = entries.map((e) => e.url);

  for (const path of STATIC_PATHS) assert.ok(urls.includes(`${SITE}${path || "/"}`), `статик ${path || "/"}`);
  assert.ok(urls.includes(`${SITE}/medee/medee-1`), "мэдээ");
  assert.ok(urls.includes(`${SITE}/zaavar/zaavar-1`), "заавар");
  assert.ok(urls.includes(`${SITE}/model/openai/gpt-6`), "модель (slug дотор / байна)");
  assert.ok(urls.includes(`${SITE}/hereglee/zurag`), "хэрэглээ");

  assert.equal(new Set(urls).size, urls.length, "давхардсан хаяг байхгүй");
  assert.ok(urls.every((u) => u.startsWith("https://") && !u.includes("//zaavar")), "бүтэн хаяг, давхар зураасгүй");

  // Заавар нь мэдээнээс өндөр priority — мөнхийн контент
  const guide = entries.find((e) => e.url.includes("/zaavar/"))!;
  const article = entries.find((e) => e.url.includes("/medee/"))!;
  assert.ok(guide.priority > article.priority);
  assert.equal(guide.lastModified, now);
});

test("siteUrl: сүүлийн зураас арилна, тохируулаагүй бол localhost", () => {
  assert.equal(siteUrl({ SITE_URL: "https://ai-news.mn/" }), "https://ai-news.mn");
  assert.equal(siteUrl({ SITE_URL: "  https://ai-news.mn  " }), "https://ai-news.mn");
  assert.equal(siteUrl({}), "http://localhost:3000");
});
