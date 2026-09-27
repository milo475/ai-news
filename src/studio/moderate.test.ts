/**
 * Студийн модерацын шийдвэр — LLM-гүй.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  decideStudio, hardBlock, STUDIO_REJECT_LABEL, type StudioModerationOutput,
} from "../prompts/moderate.api";

test("зөвшөөрсөн хүсэлт", () => {
  const v = decideStudio({ ok: true, reason: "ok", explanation: "" });
  assert.equal(v.ok, true);
  assert.equal(v.message, null);
});

test("deepfake татгалзал — эелдэг мессеж", () => {
  const out: StudioModerationOutput = {
    ok: false, reason: "deepfake",
    explanation: "Нэрлэсэн улс төрчийн видео хийх боломжгүй.",
  };
  const v = decideStudio(out);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "deepfake");
  assert.ok(v.message!.startsWith(STUDIO_REJECT_LABEL.deepfake));
  assert.match(v.message!, /улс төрчийн/);
});

test("бүх татгалзлын шалтгаанд монгол тайлбар бий", () => {
  for (const reason of ["deepfake", "minor", "sexual", "violence", "political", "illegal", "hate"] as const) {
    const v = decideStudio({ ok: false, reason, explanation: "" });
    assert.equal(v.ok, false);
    assert.equal(v.message, STUDIO_REJECT_LABEL[reason]);
  }
});

test("танихгүй шалтгаан ирвэл зөвшөөрнө — хэрэглэгчийг дэмий бүү хорь", () => {
  const v = decideStudio({ ok: false, reason: "хачин" as never, explanation: "" });
  assert.equal(v.ok, true);
});

test("LLM унавал зөвшөөрнө — механик шүүлт хэвээр хамгаална", () => {
  assert.equal(decideStudio(null).ok, true);
});

test("механик шүүлт илт тохиолдлыг LLM-гүйгээр барина", () => {
  assert.equal(hardBlock("нүцгэн зураг хийе"), "sexual");
  assert.equal(hardBlock("хуурамч гэрчилгээ хэрэгтэй"), "illegal");
  assert.equal(hardBlock("шинэ жилийн мэндчилгээ видео"), null);
  // Энгийн үгийг буруу барихгүй
  assert.equal(hardBlock("секцийн зураг"), null);
  assert.equal(hardBlock("сексто"), null);
});
