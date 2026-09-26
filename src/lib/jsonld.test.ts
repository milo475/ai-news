import assert from "node:assert/strict";
import { test } from "node:test";
import {
  breadcrumbJsonLd, collectionJsonLd, newsArticleJsonLd, organizationJsonLd, orgId, siteId,
  websiteJsonLd,
} from "./jsonld.api";

const SITE = "https://ai.mn";

test("Organization — @id, лого, sameAs", () => {
  const o = organizationJsonLd({ siteUrl: SITE, sameAs: ["https://facebook.com/x"], email: "a@b.mn" });
  assert.equal(o["@type"], "Organization");
  assert.equal(o["@id"], `${SITE}/#organization`);
  assert.equal(o.name, "AI News");
  assert.deepEqual(o.sameAs, ["https://facebook.com/x"]);
  assert.equal(o.email, "a@b.mn");
});

test("Organization — sameAs хоосон бол талбар огт гарахгүй", () => {
  const o = organizationJsonLd({ siteUrl: SITE });
  assert.ok(!("sameAs" in o));
  assert.ok(!("email" in o));
});

test("WebSite — SearchAction нь /hailt?q= руу заана", () => {
  const w = websiteJsonLd(SITE) as Record<string, any>;
  assert.equal(w["@id"], siteId(SITE));
  assert.equal(w.publisher["@id"], orgId(SITE));
  assert.equal(w.potentialAction.target.urlTemplate, `${SITE}/hailt?q={search_term_string}`);
  assert.equal(w.potentialAction["query-input"], "required name=search_term_string");
  assert.equal(w.inLanguage, "mn-MN");
});

test("BreadcrumbList — Нүүрийг автоматаар нэмнэ, эрэмбэ 1-ээс", () => {
  const b = breadcrumbJsonLd(SITE, [
    { name: "Заавар", path: "/zaavar" },
    { name: "ChatGPT хэрхэн ашиглах вэ" },
  ]) as Record<string, any>;

  assert.equal(b.itemListElement.length, 3);
  assert.equal(b.itemListElement[0].name, "Нүүр");
  assert.equal(b.itemListElement[0].item, `${SITE}/`);
  assert.equal(b.itemListElement[0].position, 1);
  assert.equal(b.itemListElement[1].item, `${SITE}/zaavar`);
  assert.equal(b.itemListElement[2].position, 3);
  assert.ok(!("item" in b.itemListElement[2]), "сүүлийнх нь одоогийн хуудас — холбоосгүй");
});

test("NewsArticle — зохиогч ба нийтлэгч нь байгууллага", () => {
  const n = newsArticleJsonLd({
    siteUrl: SITE,
    slug: "test",
    title: "Гарчиг",
    description: "Тайлбар",
    publishedAt: new Date("2026-09-26T00:00:00Z"),
    imageUrl: `${SITE}/api/og/test`,
    sourceName: "TechCrunch",
    sourceUrl: "https://techcrunch.com/x",
    tags: ["AI", "OpenAI"],
  }) as Record<string, any>;

  assert.equal(n["@type"], "NewsArticle");
  assert.equal(n.url, `${SITE}/medee/test`);
  assert.equal(n.author["@id"], orgId(SITE));
  assert.equal(n.publisher["@id"], orgId(SITE));
  assert.equal(n.datePublished, "2026-09-26T00:00:00.000Z");
  assert.equal(n.citation.name, "TechCrunch");
  assert.equal(n.keywords, "AI, OpenAI");
  assert.equal(n.image.width, 1200);
});

test("NewsArticle — headline 110 тэмдэгтээр таслагдана (Google-ийн хязгаар)", () => {
  const n = newsArticleJsonLd({
    siteUrl: SITE, slug: "a", title: "х".repeat(200), description: "d",
  }) as Record<string, any>;
  assert.equal(n.headline.length, 110);
});

test("NewsArticle — заагаагүй талбарууд огт гарахгүй", () => {
  const n = newsArticleJsonLd({ siteUrl: SITE, slug: "a", title: "T", description: "D" });
  for (const k of ["datePublished", "dateModified", "image", "citation", "keywords"]) {
    assert.ok(!(k in n), k);
  }
});

test("CollectionPage — WebSite-тай холбогдоно", () => {
  const c = collectionJsonLd({
    siteUrl: SITE, path: "/zaavar", name: "Заавар", description: "Гарын авлага",
  }) as Record<string, any>;
  assert.equal(c.isPartOf["@id"], siteId(SITE));
  assert.equal(c.url, `${SITE}/zaavar`);
});

test("бүх схем JSON болж задарна", () => {
  const all = [
    organizationJsonLd({ siteUrl: SITE }),
    websiteJsonLd(SITE),
    breadcrumbJsonLd(SITE, [{ name: "X" }]),
    newsArticleJsonLd({ siteUrl: SITE, slug: "a", title: "T", description: "D" }),
  ];
  const json = JSON.stringify(all);
  assert.deepEqual(JSON.parse(json).length, 4);
  for (const one of all) assert.equal(one["@context"], "https://schema.org");
});
