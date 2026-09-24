import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  buildImagePrompt, creditText, DEFAULT_IMAGE_DAILY_LIMIT, DEFAULT_IMAGE_MODEL, esc,
  imageDailyLimit, imageModel, IMAGE_PROMPT_PREFIX, IMAGE_SIZE, isGenericScene, rankingCardSvg,
  RECENT_SCENES, recentScenesBlock, sceneTooSimilar, useSourceImage,
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

test("isGenericScene: оффис, компьютерийн ард хүн гэх мэт ерөнхий дүрслэлийг барина", () => {
  for (const generic of [
    "A modern office with people at computers, wide shot.",
    "A developer at two monitors reviewing code, shallow depth of field.",
    "Hands typing on a keyboard in soft morning light.",
    "A team in a meeting room discussing a plan.",
    "Rows of server racks in a data centre.",
    "A glowing digital brain over an abstract background.",
  ]) {
    assert.equal(isGenericScene(generic), true, generic);
  }

  for (const concrete of [
    "A studio microphone with a waveform on the screen behind it, shallow depth of field.",
    "A lone watchtower with a camera mast in the desert at dawn, wide shot.",
    "A silicon wafer held with tweezers in a cleanroom, overhead view.",
    "A small wheeled delivery robot waiting at a pedestrian crossing.",
  ]) {
    assert.equal(isGenericScene(concrete), false, concrete);
  }
});

test("sceneTooSimilar: сүүлийн постуудтай давхардсан дүрслэлийг барина", () => {
  const recent = [
    `${IMAGE_PROMPT_PREFIX}: A studio microphone with a waveform on the screen behind it, shallow depth of field.`,
    `${IMAGE_PROMPT_PREFIX}: A lone watchtower with a camera mast in the desert at dawn, wide shot.`,
  ];
  assert.equal(
    sceneTooSimilar("A studio microphone beside a waveform on a screen, soft light.", recent),
    true,
  );
  assert.equal(
    sceneTooSimilar("A silicon wafer held with tweezers in a cleanroom, overhead view.", recent),
    false,
  );
  assert.equal(sceneTooSimilar("anything at all", []), false);
});

test("recentScenesBlock: prompt-ийн тогтмол хэсгийг хасаж, 10-аар хязгаарлана", () => {
  assert.equal(recentScenesBlock([]), "");
  assert.equal(RECENT_SCENES, 10);

  const many = Array.from({ length: 15 }, (_, i) => `${IMAGE_PROMPT_PREFIX}: scene number ${i}`);
  const block = recentScenesBlock(many);
  assert.ok(block.startsWith("Recent scenes"));
  assert.ok(!block.includes(IMAGE_PROMPT_PREFIX), "тогтмол хэсэг давтагдахгүй");
  assert.equal(block.split("\n").length - 1, RECENT_SCENES);
  assert.ok(block.includes("- scene number 0") && !block.includes("- scene number 10"));
});

test("generateAiImage: ерөнхий дүрслэл гарвал нэг удаа дахин гаргуулна (LLM mock)", async () => {
  const png = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 10, g: 10, b: 10 } },
  }).png().toBuffer();

  const scenes = [
    "A modern office with people at computers.",
    "A studio microphone with a waveform on the screen behind it, shallow depth of field.",
  ];
  const asked: string[] = [];
  const chat = async ({ user }: { user: string }) => {
    asked.push(user);
    return { data: { subject: "microphone", scene: scenes[asked.length - 1]! }, tokens: 40 };
  };
  const image = async () => ({ buffer: png, mime: "image/png", tokens: 1, costUsd: 0.03 });

  const r = await generateAiImage(
    {
      id: "a1", titleMn: "Шинэ хоолойн загвар", summaryMn: "Текстийг яриа болгоно", category: "PROJECT",
      sourceImageUrl: null, source: { name: "The Verge AI" },
    },
    { chat: chat as never, image: image as never, recentPrompts: [] },
  );

  assert.equal(asked.length, 2, "ерөнхий дүрслэлийг дахин гаргуулна");
  assert.ok(asked[1]!.includes("too generic"), "юу болсныг нь хэлж өгнө");
  assert.ok(r.prompt?.includes("studio microphone"), "хоёр дахь дүрслэл prompt-д орсон");
});

test("generateAiImage: сүүлийн постуудын дүрслэлийг prompt-д харуулна (LLM mock)", async () => {
  const png = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 10, g: 10, b: 10 } },
  }).png().toBuffer();

  const asked: string[] = [];
  const chat = async ({ user }: { user: string }) => {
    asked.push(user);
    return { data: { subject: "wafer", scene: "A silicon wafer held with tweezers in a cleanroom." }, tokens: 40 };
  };
  const image = async () => ({ buffer: png, mime: "image/png", tokens: 1, costUsd: 0.03 });

  await generateAiImage(
    {
      id: "a1", titleMn: "Чип", summaryMn: "Үйлдвэр", category: "NEWS",
      sourceImageUrl: null, source: { name: "Wired AI" },
    },
    {
      chat: chat as never, image: image as never,
      recentPrompts: [`${IMAGE_PROMPT_PREFIX}: A lone watchtower with a camera mast in the desert.`],
    },
  );

  assert.equal(asked.length, 1, "дүрслэл сайн бол дахин гаргуулахгүй");
  assert.ok(asked[0]!.includes("Recent scenes"));
  assert.ok(asked[0]!.includes("watchtower"));
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
