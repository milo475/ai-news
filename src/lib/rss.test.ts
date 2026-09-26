import assert from "node:assert/strict";
import { test } from "node:test";
import { DOMParser } from "linkedom";
import { escapeXml, feedHeaders, rfc822, rssXml, stripControl } from "./rss.api";

const NOW = new Date("2026-09-26T10:00:00Z");

const base = {
  title: "AI News",
  description: "Тайлбар",
  link: "https://ai.mn/",
  selfUrl: "https://ai.mn/feed.xml",
  now: NOW,
};

test("rfc822 — RSS-ийн шаардлагын формат", () => {
  assert.equal(rfc822(new Date("2026-09-26T07:05:09Z")), "Sat, 26 Sep 2026 07:05:09 GMT");
  assert.equal(rfc822(new Date("2026-01-01T00:00:00Z")), "Thu, 01 Jan 2026 00:00:00 GMT");
});

test("escapeXml — таван тэмдэгт", () => {
  assert.equal(escapeXml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
});

test("stripControl — XML-д хориотой тэмдэгтийг хасна", () => {
  assert.equal(stripControl("a\u0000b\u001Fc\nd"), "abc\nd");
});

test("rssXml — хүчинтэй XML, шаардлагатай тэгүүдтэй", () => {
  const xml = rssXml({
    ...base,
    items: [
      {
        title: "Гарчиг",
        link: "https://ai.mn/medee/a",
        description: "Хураангуй",
        pubDate: new Date("2026-09-25T09:00:00Z"),
        categories: ["Мэдээ", "AI"],
        imageUrl: "https://ai.mn/api/og/a",
      },
    ],
  });

  // XML болгон задарч байвал сайн бүтэцтэй (HTML горим нь <link>-ийг өөрөөр үздэг)
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  assert.equal(doc.querySelector("rss")?.getAttribute("version"), "2.0");
  assert.equal(doc.querySelectorAll("item").length, 1);
  assert.equal(doc.querySelector("item > title")?.textContent, "Гарчиг");
  assert.equal(doc.querySelector("item > link")?.textContent, "https://ai.mn/medee/a");
  assert.equal(doc.querySelectorAll("item > category").length, 2);
  assert.ok(xml.includes('<enclosure url="https://ai.mn/api/og/a"'));
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('rel="self"'));
  assert.equal(doc.querySelector("channel > language")?.textContent, "mn");
});

test("rssXml — lastBuildDate нь хамгийн сүүлийн нийтлэлийн огноо", () => {
  const xml = rssXml({
    ...base,
    items: [
      { title: "a", link: "https://ai.mn/a", description: "", pubDate: new Date("2026-09-20T00:00:00Z") },
      { title: "b", link: "https://ai.mn/b", description: "", pubDate: new Date("2026-09-24T00:00:00Z") },
    ],
  });
  assert.ok(xml.includes("<lastBuildDate>Thu, 24 Sep 2026 00:00:00 GMT</lastBuildDate>"));
});

test("rssXml — огноогүй бол now, нийтлэлгүй ч хүчинтэй", () => {
  const xml = rssXml({ ...base, items: [] });
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  assert.equal(doc.querySelectorAll("item").length, 0);
  assert.ok(xml.includes("<lastBuildDate>Sat, 26 Sep 2026 10:00:00 GMT</lastBuildDate>"));
});

test("rssXml — HTML тарилт хийгдэхгүй", () => {
  const xml = rssXml({
    ...base,
    items: [
      {
        title: `</title><script>alert(1)</script>`,
        link: "https://ai.mn/x?a=1&b=2",
        description: "5 < 10 & 10 > 5",
        pubDate: NOW,
      },
    ],
  });
  assert.ok(!xml.includes("<script>"));
  assert.ok(xml.includes("&amp;b=2"));
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  assert.equal(doc.querySelector("item > description")?.textContent, "5 < 10 & 10 > 5");
});

test("guid — link-тэй ижил бол isPermaLink=true", () => {
  const xml = rssXml({
    ...base,
    items: [{ title: "a", link: "https://ai.mn/a", description: "", guid: "tag:ai.mn,2026:a" }],
  });
  assert.ok(xml.includes('<guid isPermaLink="false">tag:ai.mn,2026:a</guid>'));
});

test("feedHeaders — зөв content type", () => {
  assert.equal(feedHeaders()["Content-Type"], "application/rss+xml; charset=utf-8");
  assert.ok(feedHeaders()["Cache-Control"]?.includes("s-maxage"));
});
