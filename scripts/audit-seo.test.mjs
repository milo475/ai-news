import assert from "node:assert/strict";
import { test } from "node:test";
import { NOINDEX_OK, patternToRegex, resolve, SKIP } from "./audit-seo.lib.mjs";

const skipped = (p) => SKIP.some((re) => re.test(p));

test("SKIP — API, админ, статик файлуудыг шалгахгүй", () => {
  for (const p of ["/api/og/[slug]", "/admin", "/admin/zaavar", "/_not-found",
                   "/icon.svg", "/sitemap.xml", "/robots.txt", "/manifest.webmanifest",
                   "/barimt/[slug]/embed"]) {
    assert.equal(skipped(p), true, p);
  }
});

test("SKIP — олон нийтийн хуудсуудыг шалгана", () => {
  for (const p of ["/", "/medee", "/medee/[slug]", "/zaavar/[slug]", "/harits/[pair]",
                   "/model/[...slug]", "/nuutslal"]) {
    assert.equal(skipped(p), false, p);
  }
});

test("patternToRegex — динамик сегментүүд", () => {
  assert.ok(patternToRegex("/medee/[slug]").test("/medee/gpt-5-garlaa"));
  assert.ok(!patternToRegex("/medee/[slug]").test("/medee/a/b"));
  assert.ok(!patternToRegex("/medee/[slug]").test("/medee"));

  // catch-all нь ташуу зураас агуулж болно
  assert.ok(patternToRegex("/model/[...slug]").test("/model/openai/gpt-5"));
  assert.ok(patternToRegex("/model/[...slug]").test("/model/claude"));

  assert.ok(patternToRegex("/barimt").test("/barimt"));
  assert.ok(!patternToRegex("/barimt").test("/barimt/x"));
});

test("resolve — sitemap-аас жинхэнэ жишээ сонгоно", () => {
  const paths = ["/", "/medee", "/medee/mongol-ai", "/zaavar/prompt-bichih", "/model/openai/gpt-5"];
  assert.equal(resolve("/medee", paths), "/medee");
  assert.equal(resolve("/medee/[slug]", paths), "/medee/mongol-ai");
  assert.equal(resolve("/model/[...slug]", paths), "/model/openai/gpt-5");
  assert.equal(resolve("/prompt/[slug]", paths), null, "жишээ байхгүй бол алгасна");
});

test("NOINDEX_OK — нэвтрэлт, хувийн хуудсууд", () => {
  const noindex = (p) => NOINDEX_OK.some((re) => re.test(p));
  assert.equal(noindex("/nevtreh"), true);
  assert.equal(noindex("/profile/sonirhol"), true);
  assert.equal(noindex("/hailt"), true);
  assert.equal(noindex("/prompt/nemeh"), true);
  assert.equal(noindex("/medee"), false);
});
