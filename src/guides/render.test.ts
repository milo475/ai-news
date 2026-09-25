import { test } from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuideBody } from "../components/GuideBody";
import { headingId } from "./markdown.api";

// tsconfig нь Next-ийн шаарддаг "jsx": "preserve" тул tsx нь JSX-ийг хуучин
// React.createElement хэлбэрээр хөрвүүлдэг. Build дээр Next өөрөө автомат runtime
// ашигладаг учир зөвхөн тестэд React-ийг глобалаар өгнө.
(globalThis as { React?: typeof React }).React = React;

const MD = [
  "## Бүртгүүлэх",
  "chat.openai.com руу орно.",
  "",
  "```prompt",
  "Чи миний туслах. Дараах текстийг засаад өгөөч.",
  "```",
  "",
  "## Асуух",
  "Тодорхой асуу. `inline` код ч бий.",
  "",
  "```js",
  "console.log(1)",
  "```",
].join("\n");

test("GuideBody: ```prompt блок «Хуулах» товчтой PromptBox болно", () => {
  const html = renderToStaticMarkup(createElement(GuideBody, { md: MD, slug: "test-zaavar" }));

  assert.match(html, /Хуулах/, "хуулах товч гарна");
  assert.match(html, /Чи миний туслах\. Дараах текстийг засаад өгөөч\./, "prompt-ийн текст гарна");
  assert.match(html, />Prompt</, "prompt гэсэн шошго");

  // Өөр хэлний блок нь энгийн <pre>, Хуулах товчгүй
  assert.match(html, /console\.log\(1\)/);
  assert.equal(html.match(/Хуулах/g)?.length, 1, "зөвхөн prompt блокт товч");

  // Inline код нь PromptBox болохгүй
  assert.match(html, /<code[^>]*>inline<\/code>/);
});

test("GuideBody: h2 бүр TOC-той таарах id авна", () => {
  const html = renderToStaticMarkup(createElement(GuideBody, { md: MD }));
  assert.match(html, new RegExp(`<h2 id="${headingId("Бүртгүүлэх")}"`));
  assert.match(html, new RegExp(`<h2 id="${headingId("Асуух")}"`));
});

test("GuideBody: ижил гарчиг давхардвал id -2 болж ялгарна", () => {
  const html = renderToStaticMarkup(createElement(GuideBody, { md: "## Алхам\nнэг\n\n## Алхам\nхоёр" }));
  const base = headingId("Алхам");
  assert.match(html, new RegExp(`<h2 id="${base}"`));
  assert.match(html, new RegExp(`<h2 id="${base}-2"`));
});
