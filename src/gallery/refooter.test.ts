import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BROKEN_FOOTER_SINCE, planFooters, skipReasonFor, SOURCE_IMAGE_PROMPT, usedSourceImage,
  type FooterRow,
} from "./refooter.api";
import { ubDayStart } from "./refooter";
import { UB_OFFSET_MS } from "../jobs/day";

function row(over: Partial<FooterRow> = {}): FooterRow {
  return {
    id: "a1", slug: "test", fbHook: "Гарчиг", fbImagePrompt: "studio photo",
    hasHero: true, hasCard: true, ...over,
  };
}

test("эх сурвалжийн зураг хэрэглэсэн эсэхийг prompt-оос таана", () => {
  assert.equal(usedSourceImage(SOURCE_IMAGE_PROMPT), true);
  assert.equal(usedSourceImage(`  ${SOURCE_IMAGE_PROMPT}  `), true);
  assert.equal(usedSourceImage("cinematic photo of a laptop"), false);
  assert.equal(usedSourceImage(null), false);
});

test("дахин зурж болохгүй шалтгааныг нэрлэнэ", () => {
  assert.equal(skipReasonFor(row()), null);
  assert.equal(skipReasonFor(row({ hasCard: false })), "карт алга");
  assert.equal(skipReasonFor(row({ hasHero: false })), "суурь зураг алга");
  assert.equal(skipReasonFor(row({ fbHook: null })), "гарчиг алга");
  assert.equal(skipReasonFor(row({ fbHook: "   " })), "гарчиг алга");
});

test("төлөвлөгөө нь засагдахыг алгасахаас салгана", () => {
  const plan = planFooters([
    row({ slug: "a" }),
    row({ slug: "b", hasHero: false }),
    row({ slug: "c" }),
    row({ slug: "d", fbHook: null }),
  ]);
  assert.deepEqual(plan.redraw.map((x) => x.slug), ["a", "c"]);
  assert.deepEqual(plan.skipped, [
    { slug: "b", reason: "суурь зураг алга" },
    { slug: "d", reason: "гарчиг алга" },
  ]);
});

test("УБ огноо нь UTC-ээс 8 цагаар түрүүлнэ", () => {
  const d = ubDayStart("2026-09-25");
  // УБ-ийн 09-25 00:00 = UTC 09-24 16:00
  assert.equal(d.toISOString(), "2026-09-24T16:00:00.000Z");
  assert.equal(d.getTime(), Date.UTC(2026, 8, 25) - UB_OFFSET_MS);
});

test("буруу огноог тодорхой алдаагаар хэлнэ", () => {
  assert.throws(() => ubDayStart("хог"), /2026-09-25 хэлбэрээр/);
  assert.equal(BROKEN_FOOTER_SINCE, "2026-09-25");
});
