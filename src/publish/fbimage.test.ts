import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  buildImagePrompt, creditText, DEFAULT_IMAGE_DAILY_LIMIT, DEFAULT_IMAGE_MODEL, esc,
  imageDailyLimit, imageModel, IMAGE_PROMPT_PREFIX, IMAGE_SIZE, rankingCardSvg, useSourceImage,
} from "./fbimage.api";
import { generateAiImage, squareJpeg } from "./fbimage";

test("imageModel / imageDailyLimit / useSourceImage: env, анхдагч утга", () => {
  assert.equal(imageModel({}), DEFAULT_IMAGE_MODEL);
  assert.equal(imageModel({ IMAGE_MODEL: "openai/gpt-5-image" }), "openai/gpt-5-image");
  assert.equal(imageModel({ IMAGE_MODEL: "  " }), DEFAULT_IMAGE_MODEL);

  assert.equal(imageDailyLimit({}), DEFAULT_IMAGE_DAILY_LIMIT);
  assert.equal(imageDailyLimit({ FB_IMAGE_DAILY_LIMIT: "2" }), 2);
  assert.equal(imageDailyLimit({ FB_IMAGE_DAILY_LIMIT: "0" }), 0);        // зураг унтраалттай
  assert.equal(imageDailyLimit({ FB_IMAGE_DAILY_LIMIT: "тав" }), DEFAULT_IMAGE_DAILY_LIMIT);

  assert.equal(useSourceImage({}), false);                                 // анхдагч: AI зураг
  assert.equal(useSourceImage({ FB_USE_SOURCE_IMAGE: "true" }), true);
  assert.equal(useSourceImage({ FB_USE_SOURCE_IMAGE: "false" }), false);
});

test("buildImagePrompt: текст, лого, watermark хориглох нөхцөл үргэлж орно", () => {
  const prompt = buildImagePrompt("  a small shop owner checking orders on a tablet  ");
  assert.ok(prompt.startsWith(IMAGE_PROMPT_PREFIX));
  for (const rule of ["no text", "no logos", "no watermark", "1:1"]) assert.ok(prompt.includes(rule), rule);
  assert.ok(prompt.endsWith("a small shop owner checking orders on a tablet"));
});

test("creditText / esc", () => {
  assert.equal(creditText("The Verge AI"), "Зураг: The Verge AI");
  assert.equal(esc('A & B <c> "d"'), "A &amp; B &lt;c&gt; &quot;d&quot;");
});

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

test("squareJpeg: ямар ч хэмжээг 1080×1080 JPEG болгоно", async () => {
  const wide = await sharp({
    create: { width: 1600, height: 400, channels: 3, background: { r: 30, g: 40, b: 60 } },
  }).png().toBuffer();

  const square = await squareJpeg(wide);
  const meta = await sharp(square).metadata();
  assert.equal(meta.width, IMAGE_SIZE);
  assert.equal(meta.height, IMAGE_SIZE);
  assert.equal(meta.format, "jpeg");
});

test("generateAiImage: үндсэн модель унавал нөөц моделиор (LLM mock)", async () => {
  const png = await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: 200, g: 200, b: 200 } },
  }).png().toBuffer();

  const tried: string[] = [];
  const image = async ({ model }: { model: string; prompt: string }) => {
    tried.push(model);
    if (tried.length === 1) throw new Error("OpenRouter image: зураг ирсэнгүй");
    return { buffer: png, mime: "image/png", tokens: 1290, costUsd: 0.034 };
  };
  const chat = async () => ({ data: { scene: "a quiet office desk seen from above" }, tokens: 50 });

  const r = await generateAiImage(
    {
      id: "a1", titleMn: "Гарчиг", summaryMn: "Хураангуй", category: "NEWS",
      sourceImageUrl: null, source: { name: "TechCrunch AI" },
    },
    { chat: chat as never, image: image as never },
  );

  assert.equal(tried.length, 2, "нэг удаа нөөц моделиор дахин оролдоно");
  assert.notEqual(tried[0], tried[1]);
  assert.equal(r.kind, "ai");
  assert.equal(r.costUsd, 0.034);
  assert.ok(r.prompt?.startsWith(IMAGE_PROMPT_PREFIX));
  assert.equal((await sharp(r.buffer).metadata()).width, IMAGE_SIZE);
});

test("generateAiImage: нөөц ч унавал алдаа дамжина (дуудагч нь link post руу буцна)", async () => {
  const chat = async () => ({ data: { scene: "an office" }, tokens: 10 });
  const image = async () => { throw new Error("OpenRouter image 429: rate limit"); };

  await assert.rejects(
    generateAiImage(
      {
        id: "a1", titleMn: "Гарчиг", summaryMn: "Хураангуй", category: "RISK",
        sourceImageUrl: null, source: { name: "AI Incident Database" },
      },
      { chat: chat as never, image: image as never },
    ),
    /rate limit/,
  );
});
