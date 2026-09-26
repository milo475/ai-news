import assert from "node:assert/strict";
import { test } from "node:test";
import {
  absUrl, DEFAULT_SITE_URL, isOldHost, oldHosts, sameAs, siteHost, siteUrl, socialLinks, userAgent,
} from "./site";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test("siteUrl — env байхгүй бол локал хаяг", () => {
  assert.equal(siteUrl(env({})), DEFAULT_SITE_URL);
});

test("siteUrl — төгсгөлийн ташуу зураасыг хасна", () => {
  assert.equal(siteUrl(env({ SITE_URL: "https://ai.mn/" })), "https://ai.mn");
  assert.equal(siteUrl(env({ SITE_URL: "https://ai.mn///" })), "https://ai.mn");
  assert.equal(siteUrl(env({ SITE_URL: "  https://ai.mn  " })), "https://ai.mn");
});

test("absUrl — давхар зураасгүй, бүтэн хаягийг хөндөхгүй", () => {
  const e = env({ SITE_URL: "https://ai.mn" });
  assert.equal(absUrl("/medee", e), "https://ai.mn/medee");
  assert.equal(absUrl("medee", e), "https://ai.mn/medee");
  assert.equal(absUrl("/", e), "https://ai.mn/");
  assert.equal(absUrl("https://other.com/x", e), "https://other.com/x");
});

test("siteHost — www-г хасна, буруу хаягт хоосон", () => {
  assert.equal(siteHost(env({ SITE_URL: "https://www.ai.mn" })), "ai.mn");
  assert.equal(siteHost(env({ SITE_URL: "https://ai.mn:3000" })), "ai.mn:3000");
  assert.equal(siteHost(env({ SITE_URL: "хаяг биш" })), "");
});

test("userAgent — холбоос агуулна", () => {
  assert.equal(userAgent(env({ SITE_URL: "https://ai.mn" })), "AINewsBot/1.0 (+https://ai.mn)");
});

test("oldHosts — таслалаар, протокол/зам/том үсгийг цэвэрлэнэ", () => {
  assert.deepEqual(oldHosts(env({ OLD_HOSTS: "" })), []);
  assert.deepEqual(
    oldHosts(env({ OLD_HOSTS: "https://Old.Up.Railway.App/, , second.mn/зам" })),
    ["old.up.railway.app", "second.mn"],
  );
});

test("isOldHost — порт үл харгалзана, шинэ хаягт false", () => {
  const e = env({ OLD_HOSTS: "old.up.railway.app,second.mn" });
  assert.equal(isOldHost("old.up.railway.app", e), true);
  assert.equal(isOldHost("OLD.up.railway.app:443", e), true);
  assert.equal(isOldHost("ai.mn", e), false);
  assert.equal(isOldHost(null, e), false);
  assert.equal(isOldHost("", e), false);
});

test("isOldHost — OLD_HOSTS хоосон бол хэзээ ч true биш", () => {
  assert.equal(isOldHost("хамаагүй.mn", env({})), false);
});

test("socialLinks — env дутуу бол null, sameAs хоосон", () => {
  assert.deepEqual(socialLinks(env({})), { facebook: null, instagram: null });
  assert.deepEqual(sameAs(env({})), []);
});

test("socialLinks — @ тэмдгийг хасна", () => {
  const e = env({ FB_PAGE_ID: "123", IG_USERNAME: "@ainews" });
  assert.deepEqual(socialLinks(e), {
    facebook: "https://www.facebook.com/123",
    instagram: "https://www.instagram.com/ainews",
  });
  assert.equal(sameAs(e).length, 2);
});
