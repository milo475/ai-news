import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, stripHtml, titleHash } from "./rss.api";

test("normalizeUrl: tracking, fragment, trailing slash, hostname", () => {
  assert.equal(
    normalizeUrl("https://TechCrunch.com/2026/09/19/openai/?utm_source=rss&utm_medium=feed#comments"),
    "https://techcrunch.com/2026/09/19/openai",
  );
  assert.equal(normalizeUrl("https://x.com/a?fbclid=abc&ref=hn"), "https://x.com/a");
  assert.equal(normalizeUrl("https://x.com/a?id=7&utm_campaign=z"), "https://x.com/a?id=7");
  assert.equal(normalizeUrl("https://x.com/"), "https://x.com");
  assert.equal(normalizeUrl("https://x.com/a///"), "https://x.com/a");
  assert.equal(normalizeUrl("  https://x.com:8080/a?b=1  "), "https://x.com:8080/a?b=1");
  assert.equal(normalizeUrl("огт хаяг биш"), "огт хаяг биш");
});

test("titleHash: зөвхөн үсэг-тоогоор адилтгана", () => {
  assert.equal(titleHash("OpenAI launches GPT-6!"), titleHash("  openai   launches gpt 6  "));
  assert.notEqual(titleHash("OpenAI launches GPT-6"), titleHash("OpenAI launches GPT-7"));
  assert.equal(titleHash("Шинэ модель"), titleHash("шинэ, модель!"));
  assert.match(titleHash("a"), /^[0-9a-f]{40}$/);
});

test("stripHtml: тэг, entity, зай, таслалт", () => {
  assert.equal(stripHtml("<p>Сайн <b>байна</b> уу?</p>"), "Сайн байна уу?");
  assert.equal(stripHtml("<script>evil()</script><p>текст</p>"), "текст");
  assert.equal(stripHtml("AT&amp;T &lt;b&gt;зузаан&lt;/b&gt; &#39;х&#39; &nbsp;&#x2014;"), "AT&T зузаан 'х' —");
  assert.equal(stripHtml("  олон\n\nмөр\tзай  "), "олон мөр зай");
  assert.equal(stripHtml("&unknown; &#999999999;"), "&unknown; &#999999999;");

  const long = stripHtml("a".repeat(3000));
  assert.equal(long.length, 2000);
  assert.ok(long.endsWith("…"));
  assert.equal(stripHtml("abcdef", 4), "abc…");
  assert.equal(stripHtml("abc", 4), "abc");
});
