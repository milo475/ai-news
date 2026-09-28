import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_IMAGE_TYPES, applyRevision, checkImage, IMAGE_REJECT_MESSAGE, MAX_IMAGE_BYTES,
  MAX_REVISIONS, reviseUser, revisionsLeft,
} from "./revise.api";
import type { StudioBrief } from "./prompts.api";
import type { ToolOutput } from "./output.api";

const BRIEF: StudioBrief = {
  goal: "зар", audience: "залуус", message: "хямдрал", tone: "дулаан", subject: "гутал",
  setting: "студи", style: "гэрэл зураг", placement: "Facebook", length: "1 зураг",
  brand: "ногоон", avoid: "кирилл текст",
};

test("нэг сессэд 3 засвар", () => {
  assert.equal(MAX_REVISIONS, 3);
  assert.equal(revisionsLeft(0), 3);
  assert.equal(revisionsLeft(3), 0);
  assert.equal(revisionsLeft(99), 0, "сөрөг болохгүй");
});

test("зургийн хязгаар", () => {
  assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024);
  assert.equal(checkImage({ size: 1000, type: "image/png" }), null);
  assert.equal(checkImage({ size: 1000, type: "image/jpeg" }), null);
  assert.equal(checkImage({ size: 1000, type: "image/webp" }), null);
  assert.equal(checkImage({ size: MAX_IMAGE_BYTES + 1, type: "image/png" }), "хэт том");
  assert.equal(checkImage({ size: 1000, type: "image/gif" }), "буруу төрөл");
  assert.equal(checkImage({ size: 0, type: "image/png" }), "хоосон");
  assert.equal(checkImage(null), "хоосон");
});

test("татгалзлын мессеж бүрд монгол тайлбар", () => {
  for (const r of ["хэт том", "буруу төрөл", "хоосон"] as const) {
    assert.ok(IMAGE_REJECT_MESSAGE[r].length > 5, r);
  }
  assert.deepEqual([...ALLOWED_IMAGE_TYPES], ["image/jpeg", "image/png", "image/webp"]);
});

test("зураг хавсаргасан эсэхийг prompt-д хэлнэ", () => {
  const withImg = reviseUser({
    brief: BRIEF, tool: "Gemini", previousPrompt: "a shoe", note: "хэт харанхуй", hasImage: true,
  });
  assert.match(withImg, /Гарсан зургийг хавсаргав/);
  assert.match(withImg, /хэт харанхуй/);
  assert.match(withImg, /a shoe/);

  const without = reviseUser({
    brief: BRIEF, tool: "Gemini", previousPrompt: "a shoe", note: "хэт харанхуй", hasImage: false,
  });
  assert.match(without, /Зураг хавсаргаагүй/);
});

test("засвар нь зөвхөн промптыг солино", () => {
  const before: ToolOutput = {
    tool: "gemini", prompt: "a dark shoe", params: [{ name: "ar", value: "4:5", why: "FB" }],
    parts: [], steps: ["Gemini нээ"],
  };
  const after = applyRevision(before, {
    diagnosis: "хэт харанхуй", prompt: "a well-lit shoe, bright studio lighting",
    changes: ["гэрэлтүүлэг нэмэв"], tip: "цайвар дэвсгэр",
  });
  assert.equal(after.prompt, "a well-lit shoe, bright studio lighting");
  assert.deepEqual(after.steps, before.steps, "алхмууд хэвээр");
  assert.deepEqual(after.params, before.params);
});

test("хоосон промпт ирвэл хуучныг хадгална", () => {
  const before: ToolOutput = { tool: "gemini", prompt: "a shoe", params: [], parts: [], steps: [] };
  const after = applyRevision(before, { diagnosis: "", prompt: "   ", changes: [], tip: "" });
  assert.equal(after.prompt, "a shoe");
});
