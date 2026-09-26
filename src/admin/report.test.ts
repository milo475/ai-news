import assert from "node:assert/strict";
import { test } from "node:test";
import { delta, renderReport } from "./report.api";

test("delta — хувиар, шинэ, тэг", () => {
  assert.equal(delta(10, 5), "+100%");
  assert.equal(delta(5, 10), "-50%");
  assert.equal(delta(5, 5), "0%");
  assert.equal(delta(3, 0), "шинэ");
  assert.equal(delta(0, 0), "—");
});

const input = {
  weekLabel: "9/20–9/26",
  sections: [
    {
      heading: "Контент",
      rows: [
        { label: "Нийтэлсэн", value: "12", delta: "+20%" },
        { label: "Унасан", value: "2", alert: true },
      ],
    },
  ],
  warnings: ["Ажиллалт унасан"],
  adminUrl: "https://ai.mn/admin",
};

test("renderReport — гарчиг, хэсэг, анхааруулга", () => {
  const r = renderReport(input);
  assert.equal(r.subject, "AI News · долоо хоногийн тайлан 9/20–9/26");
  assert.ok(r.html.includes("Нийтэлсэн"));
  assert.ok(r.html.includes("+20%"));
  assert.ok(r.html.includes("Ажиллалт унасан"));
  assert.ok(r.html.includes("https://ai.mn/admin"));
  assert.ok(r.html.startsWith("<!doctype html>"));
});

test("renderReport — анхааруулга байхгүй бол блок гарахгүй", () => {
  const r = renderReport({ ...input, warnings: [] });
  assert.ok(!r.html.includes("Анхаарах"));
});

test("renderReport — текст хувилбар нь бүх мөрийг агуулна", () => {
  const r = renderReport(input);
  assert.ok(r.text.includes("КОНТЕНТ"));
  assert.ok(r.text.includes("Нийтэлсэн: 12 (+20%)"));
  assert.ok(r.text.includes("Админ: https://ai.mn/admin"));
});

test("renderReport — HTML тарилтаас хамгаална", () => {
  const r = renderReport({
    ...input,
    warnings: ['<script>alert("x")</script>'],
  });
  assert.ok(!r.html.includes("<script>alert"));
  assert.ok(r.html.includes("&lt;script&gt;"));
});
