import assert from "node:assert/strict";
import { test } from "node:test";
import { etagFor, etagMatches, imageResponse } from "./image-response";

const DATA = new Uint8Array([1, 2, 3, 4, 5]);
const AT = new Date("2026-09-26T00:00:00Z");
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

test("etagFor — урт + хугацаанаас тогтвортой", () => {
  assert.equal(etagFor(5, AT), etagFor(5, AT));
  assert.notEqual(etagFor(5, AT), etagFor(6, AT));
  assert.notEqual(etagFor(5, AT), etagFor(5, new Date(AT.getTime() + 1)));
  assert.ok(etagFor(5, AT).startsWith('"'), "хос хашилтад байх ёстой");
});

test("etagMatches — таслалаар хэд хэдэн, W/ угтвар, *", () => {
  const tag = etagFor(5, AT);
  assert.equal(etagMatches(tag, tag), true);
  assert.equal(etagMatches(`W/${tag}`, tag), true);
  assert.equal(etagMatches(`"other", ${tag}`, tag), true);
  assert.equal(etagMatches("*", tag), true);
  assert.equal(etagMatches('"other"', tag), false);
  assert.equal(etagMatches(null, tag), false);
});

test("?v= байвал immutable кэш", () => {
  const res = imageResponse(req("https://ai.mn/api/fb-image/x?v=123"), {
    data: DATA, contentType: "image/jpeg", updatedAt: AT,
  });
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
});

test("?v= байхгүй бол богино max-age + stale-while-revalidate", () => {
  const res = imageResponse(req("https://ai.mn/api/fb-image/x"), {
    data: DATA, contentType: "image/jpeg", updatedAt: AT, maxAge: 600,
  });
  assert.equal(res.headers.get("Cache-Control"), "public, max-age=600, stale-while-revalidate=86400");
});

test("ETag таарвал 304, биетгүй", async () => {
  const etag = etagFor(DATA.length, AT);
  const res = imageResponse(req("https://ai.mn/api/fb-image/x", { "if-none-match": etag }), {
    data: DATA, contentType: "image/jpeg", updatedAt: AT,
  });
  assert.equal(res.status, 304);
  assert.equal(await res.text(), "");
  assert.equal(res.headers.get("ETag"), etag);
});

test("ETag таарахгүй бол 200 + биет", async () => {
  const res = imageResponse(req("https://ai.mn/api/fb-image/x", { "if-none-match": '"stale"' }), {
    data: DATA, contentType: "image/jpeg", updatedAt: AT,
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Length"), "5");
  assert.equal((await res.arrayBuffer()).byteLength, 5);
});

test("нэмэлт header дамжина, Last-Modified тавигдана", () => {
  const res = imageResponse(req("https://ai.mn/api/tool-logo/x"), {
    data: DATA,
    contentType: "image/svg+xml",
    updatedAt: AT,
    extra: { "Content-Security-Policy": "default-src 'none'" },
  });
  assert.equal(res.headers.get("Content-Security-Policy"), "default-src 'none'");
  assert.equal(res.headers.get("Last-Modified"), AT.toUTCString());
  assert.equal(res.headers.get("Content-Type"), "image/svg+xml");
});
