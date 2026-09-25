import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { IMAGE_SIZE, rankingCardSvg } from "./fbimage.api";

test("rankingCardSvg: топ 5, өсөлт/уналт, лого", () => {
  const svg = rankingCardSvg(
    [
      { rank: 1, name: "DeepSeek V4.1 Flash", company: "DeepSeek", rankDelta: 0 },
      { rank: 2, name: "GLM 5.3 Flash", company: "Z.ai", rankDelta: 1 },
      { rank: 3, name: "Hy4 preview", company: "Tencent", rankDelta: -2 },
      { rank: 4, name: "GPT-5.6 Luna", company: "OpenAI", rankDelta: null },
      { rank: 5, name: "Claude Fable 5.1", company: "Anthropic", rankDelta: 3 },
      { rank: 6, name: "Орохгүй", company: "X", rankDelta: 0 },
    ],
    "2026-09-23",
  );
  assert.ok(svg.includes(`width="${IMAGE_SIZE}"`) && svg.includes(`height="${IMAGE_SIZE}"`));
  assert.ok(svg.includes("AI <tspan"), "лого");
  assert.ok(svg.includes("▲ 1") && svg.includes("▼ 2") && svg.includes("шинэ"));
  assert.ok(!svg.includes("Орохгүй"), "зөвхөн эхний 5");
});

test("rankingCardSvg: sharp-аар зурагддаг (1080×1080)", async () => {
  const svg = rankingCardSvg(
    Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1, name: `Модель ${i + 1}`, company: "Компани", rankDelta: i - 2,
    })),
    "2026-09-25",
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, IMAGE_SIZE);
  assert.equal(meta.height, IMAGE_SIZE);
});
