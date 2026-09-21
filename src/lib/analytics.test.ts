import { test } from "node:test";
import assert from "node:assert/strict";
import { analytics, track, umamiConfig } from "./analytics";
import { Umami } from "../components/Umami";

test("analytics: window.umami байхгүй үед no-op (алдаа шидэхгүй)", () => {
  // Сервер тал — window огт байхгүй
  assert.equal(typeof globalThis.window, "undefined");
  assert.doesNotThrow(() => track("search", { query: "gemini", resultCount: 3 }));
  assert.doesNotThrow(() => analytics.newsletterSubscribe());
  assert.doesNotThrow(() => analytics.modelView("anthropic/claude-opus-5"));
  assert.equal(track("ranking_tab", { tab: "quality" }), undefined);

  // Хөтөч дээр байгаа ч tracker ачаалаагүй — дахин оролдоод чимээгүй болно
  const timers: unknown[] = [];
  (globalThis as { window?: unknown }).window = {
    setTimeout: (fn: () => void) => timers.push(fn),
  };
  try {
    assert.doesNotThrow(() => track("share_facebook", { slug: "tойм" }));
    assert.equal(timers.length, 1, "дахин оролдохоор товлогдоогүй");
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("Umami: env дутуу бол script рендэрлэхгүй", () => {
  assert.equal(umamiConfig({}), null);
  assert.equal(umamiConfig({ NEXT_PUBLIC_UMAMI_URL: "https://u.example.com" }), null);
  assert.equal(umamiConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: "abc" }), null);
  assert.equal(umamiConfig({ NEXT_PUBLIC_UMAMI_URL: "  ", NEXT_PUBLIC_UMAMI_WEBSITE_ID: "abc" }), null);

  // Хоёул байвал tracker-ийн хаягийг угсарна (сүүлийн ташуу зураас илүүцгүй)
  assert.deepEqual(umamiConfig({ NEXT_PUBLIC_UMAMI_URL: "https://u.example.com/", NEXT_PUBLIC_UMAMI_WEBSITE_ID: "abc" }), {
    src: "https://u.example.com/script.js",
    websiteId: "abc",
  });

  // Бүрэлдэхүүн нь env-гүйд яг null буцаана — layout-д юу ч нэмэгдэхгүй
  const saved = [process.env.NEXT_PUBLIC_UMAMI_URL, process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID];
  delete process.env.NEXT_PUBLIC_UMAMI_URL;
  delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  try {
    assert.equal(Umami(), null);
  } finally {
    if (saved[0] !== undefined) process.env.NEXT_PUBLIC_UMAMI_URL = saved[0];
    if (saved[1] !== undefined) process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = saved[1];
  }
});
