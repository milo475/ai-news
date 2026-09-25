import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  buildPhotoPrompt, CARD_H, CARD_W, checkHook, creditText, CTA_FB, CTA_IG, DEFAULT_IMAGE_DAILY_LIMIT,
  DEFAULT_IMAGE_MODEL, EVERYDAY_ONLY, fitHeadline, FONT_SIZES, hasImpactNumber, hookScore,
  imageDailyLimit, imageModel, isGenericScene, isLabScene, MAX_HOOK_CHARS, MAX_LINES, overlaySvg,
  PAD, PHOTO_PROMPT_NEGATIVE, PHOTO_PROMPT_PREFIX, pickHook, RECENT_SCENES, recentScenesBlock,
  SCENE_SYSTEM, sceneTooSimilar, stripDates, useSourceImage, wrapLines, type ScoredHook,
} from "./card.api";
import { heroJpeg, renderCard } from "./card";

const GOOD = "Гэрийн энгийн хөргөгч хүртэл системийн алдаанаас болж унтардаг болжээ.";
const GOOD_NUM = "Нэг ажилтан гарахад орлох зардал нь жилийн цалингаас 2 дахин их байдаг.";

const scored = (text: string, s = 8, r = 8, c = 8): ScoredHook => ({
  text, surprise: s, relevance: r, clarity: c,
});

test("stripDates: он, сар, өдрийн хэлбэрүүдийг хасна", () => {
  assert.equal(stripDates("2026 оны 9-р сарын 21-нд гарчээ"), "гарчээ");
  assert.equal(stripDates("Gemini 4 загвар 2026 онд гарна"), "Gemini 4 загвар гарна");
  assert.equal(stripDates("40 хувиар буурчээ"), "40 хувиар буурчээ", "энгийн тоог хөндөхгүй");
});

test("hasImpactNumber: огноо тоонд тооцогдохгүй, харьцуулалт зөвшөөрнө", () => {
  assert.equal(hasImpactNumber("Загварыг 2026 оны 9-р сарын 21-нд гаргажээ"), false, "зөвхөн огноо");
  assert.equal(hasImpactNumber("Зардал 2 дахин их байдаг"), true);
  assert.equal(hasImpactNumber("Ашиглалт 40 хувиар өсчээ"), true);
  assert.equal(hasImpactNumber("Сард 200 ам.доллар болно"), true);

  // Тоогүй ч харьцуулалттай бол зүгээр
  assert.equal(hasImpactNumber(GOOD), true, "«хүртэл»");
  assert.equal(hasImpactNumber("Жижиг дэлгүүр ч гэсэн ийм хэрэгсэл ашигладаг болжээ"), true);
  assert.equal(hasImpactNumber("Технологи хурдацтай хөгжиж байна"), false);
});

test("checkHook: огноо, хуурай хэллэг, тоогүй байдлыг барина", () => {
  assert.deepEqual(checkHook(GOOD), []);
  assert.deepEqual(checkHook(GOOD_NUM), []);

  const codes = (h: string) => checkHook(h).map((p) => p.code);
  assert.ok(codes("").includes("empty"));
  assert.ok(codes("Технологи хурдацтай хөгжиж байна.").includes("no-number"));
  assert.ok(codes("Google шинэ загвараа 2026 онд гаргана.").includes("date"));
  assert.ok(codes("Google шинэ загвараа танилцууллаа.").includes("press-release"));
  assert.ok(codes("Samsung 40 хувийн хямдрал зарлажээ.").includes("press-release"));
  assert.ok(codes(`${"у".repeat(MAX_HOOK_CHARS + 5)} 40 хувь`).includes("too-long"));
  assert.ok(codes("40 хувь нь ингэжээ 🚀").includes("emoji"));
  assert.ok(codes("«40 хувь» нь ингэжээ").includes("quotes"));
  assert.ok(codes("40 хувь нь ингэжээ. Дараа нь тэгжээ.").includes("multi-sentence"));
  assert.ok(codes("ЭНЭ БОЛ 40 ХУВИЙН ӨӨРЧЛӨЛТ").includes("shouting"));
  assert.ok(!codes("NASA 40 сая долларын гэрээтэй болжээ.").includes("shouting"));
});

test("pickHook: хамгийн өндөр оноотойг, тэнцвэл богиныг", () => {
  const best = scored("Хиймэл оюун 5 хүн тутмын 1-ийн цагийг хэмнэж байна.", 9, 9, 9);
  const picked = pickHook([scored(GOOD_NUM, 6, 6, 6), best, scored(GOOD, 5, 5, 5)]);
  assert.equal(picked?.text, best.text);
  assert.equal(hookScore(best), 27);

  // Оноо тэнцвэл богино нь
  const shortOne = scored("Зардал 2 дахин өсчээ.", 8, 8, 8);
  const tie = pickHook([scored(GOOD_NUM, 8, 8, 8), shortOne]);
  assert.equal(tie?.text, shortOne.text);

  // Шалгуур давсангүй — огноотой, хуурай, тоогүй
  assert.equal(
    pickHook([
      scored("Google загвараа 2026 онд гаргана.", 10, 10, 10),
      scored("Компани шинэ хэрэгслээ танилцууллаа.", 10, 10, 10),
      scored("Технологи хөгжиж байна.", 10, 10, 10),
    ]),
    null,
  );
  assert.equal(pickHook([]), null);
});

test("wrapLines / fitHeadline: 4 мөрөөс хэтэрвэл фонт багасна", () => {
  const short = fitHeadline("40 хувь буурчээ.");
  assert.equal(short?.fontSize, FONT_SIZES[0], "богино текст хамгийн том фонтоор");
  assert.equal(short?.lines.length, 1);

  // Мөр бүр PAD-ын дотор багтана
  for (const line of wrapLines(GOOD, 64)) {
    assert.ok(line.length * 64 * 0.53 <= CARD_W - PAD * 2, `урт мөр: ${line}`);
  }

  // Урт headline — фонт багасна
  const long = fitHeadline(
    "Австралийн Засгийн газрын Medicare системд хиймэл оюуны агент зөвшөөрөлгүй нэвтэрсэн нь 3 сарын дараа илэрчээ.",
  );
  assert.ok(long, "48px дээр багтах ёстой");
  assert.ok(long!.lines.length <= MAX_LINES);
  assert.ok(long!.fontSize < FONT_SIZES[0]!, `фонт багассан байх: ${long!.fontSize}`);

  // Хэт урт бол null — дуудагч нь дахин бичүүлнэ
  assert.equal(fitHeadline("маш урт үг ".repeat(40)), null);
});

test("overlaySvg: gradient, wordmark, headline, CTA бүгд байна", () => {
  const svg = overlaySvg({ lines: ["Эхний мөр", "Хоёр дахь мөр"], fontSize: 64, cta: CTA_IG });

  assert.ok(svg.includes(`width="${CARD_W}"`) && svg.includes(`height="${CARD_H}"`));
  assert.ok(svg.includes('id="shade"'), "доод gradient");
  assert.ok(svg.includes('id="top"'), "дээд сүүдэр");
  assert.ok(svg.includes(">AI News<"), "wordmark");
  assert.ok(svg.includes(">Эхний мөр<") && svg.includes(">Хоёр дахь мөр<"));
  assert.ok(svg.includes(`>${CTA_IG}<`));
  assert.ok(svg.includes("Roboto"), "фонт");

  // FB дээр өөр CTA
  assert.ok(overlaySvg({ lines: ["x"], fontSize: 48, cta: CTA_FB }).includes(`>${CTA_FB}<`));

  // Мөрүүд дээрээсээ доошоо, CTA-гаас дээш байрлана
  const ys = [...svg.matchAll(/<text x="\d+" y="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(ys.length >= 4);
  assert.ok(Math.max(...ys) === CARD_H - PAD, "CTA хамгийн доор");
});

test("buildPhotoPrompt: кино кадрын стиль + хориглох жагсаалт", () => {
  const prompt = buildPhotoPrompt("  a night shift nurse checking a monitor  ");
  for (const rule of ["documentary photograph", "35mm film look", "slight grain", "natural lighting"]) {
    assert.ok(prompt.includes(rule), rule);
  }
  for (const banned of ["no text", "no logos", "no watermark", "no 3D render", "no neon", "no CGI"]) {
    assert.ok(prompt.includes(banned), banned);
  }
  assert.ok(prompt.includes("a night shift nurse checking a monitor"));
  assert.ok(prompt.endsWith(`${PHOTO_PROMPT_NEGATIVE}.`));

  // 4:5 картын компози — гол объект дээд 2/3-д, доод 1/3 хоосон
  assert.ok(PHOTO_PROMPT_PREFIX.includes("upper two-thirds"));
  assert.ok(PHOTO_PROMPT_PREFIX.includes("lower third empty"));
});

test("renderCard: 1080×1350 JPEG, суурь зургаас өөр (overlay зурагдсан)", async () => {
  const flat = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: { r: 120, g: 120, b: 120 } },
  }).png().toBuffer();

  const hero = await heroJpeg(flat);
  const heroMeta = await sharp(hero).metadata();
  assert.equal(heroMeta.width, CARD_W);
  assert.equal(heroMeta.height, CARD_H);

  const card = await renderCard(hero, GOOD, { cta: CTA_FB });
  const meta = await sharp(card).metadata();
  assert.equal(meta.width, CARD_W);
  assert.equal(meta.height, CARD_H);
  assert.equal(meta.format, "jpeg");

  // sharp-ийн stats() нь pipeline биш эх зураг дээр ажилладаг тул тайрсныг нь буфер болгоно
  const region = async (top: number) =>
    sharp(await sharp(card).extract({ left: 0, top, width: CARD_W, height: 150 }).toBuffer()).stats();

  const middle = await region(500);
  const bottom = await region(1150);
  assert.ok(bottom.channels[0]!.mean < middle.channels[0]!.mean - 30, "доод gradient харанхуй");

  // Цагаан текст — доод хэсэгт хамгийн цайвар цэг байна
  assert.ok(bottom.channels[0]!.max > 230, "цагаан үсэг");

  // Дээд сүүдэр — wordmark уншигдахаар бага зэрэг харанхуй
  const top = await region(60);
  assert.ok(top.channels[0]!.mean < middle.channels[0]!.mean, "дээд сүүдэр");
});

// ---------- Зургийн дүрслэл, тохиргоо ----------

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
    // Тодорхой объект гол нь байвал «office» гэсэн үг байсан ч зүгээр
    "A locked filing cabinet in a government office, papers visible through a slightly open drawer.",
  ]) {
    assert.equal(isGenericScene(concrete), false, concrete);
  }
});

test("isLabScene: FACT/HOWTO/PROJECT-д лаборатори хориотой, RISK/NEWS-д зөвшөөрнө", () => {
  assert.deepEqual(EVERYDAY_ONLY, ["FACT", "HOWTO", "PROJECT"]);

  const labScenes = [
    "A researcher's hand adjusting a dial on a physics instrument panel, with a printed diagram below.",
    "A silicon wafer held with tweezers in a cleanroom, overhead view.",
    "A scientist in a white coat beside a microscope in a bright laboratory.",
    "A technician checking an oscilloscope on a test bench.",
  ];
  for (const scene of labScenes) {
    for (const c of EVERYDAY_ONLY) assert.equal(isLabScene(scene, c), true, `${c}: ${scene}`);
    // Мэргэжлийн орчин зөвшөөрөгддөг ангиллууд
    for (const c of ["RISK", "NEWS", "BUSINESS"] as const) {
      assert.equal(isLabScene(scene, c), false, `${c}: ${scene}`);
    }
  }

  // Өдөр тутмын дүрслэл бүх ангилалд зүгээр
  const everyday = [
    "A phone on a wooden kitchen table with a hand reaching for it, morning light.",
    "A shop owner checking orders on a laptop behind the counter.",
    "A commuter looking at a phone on a bus, window reflections.",
  ];
  for (const scene of everyday) {
    for (const c of [...EVERYDAY_ONLY, "NEWS"] as const) assert.equal(isLabScene(scene, c), false, scene);
  }
});

test("SCENE_SYSTEM: ангиллын дүрэм prompt дотор бичигдсэн", () => {
  assert.ok(SCENE_SYSTEM.includes("FACT, HOWTO, PROJECT"));
  assert.ok(SCENE_SYSTEM.includes("FORBIDDEN"));
  for (const word of ["laboratory", "cleanroom", "microscope"]) {
    assert.ok(SCENE_SYSTEM.includes(word), word);
  }
  assert.ok(SCENE_SYSTEM.includes("RISK, NEWS, BUSINESS"), "мэргэжлийн орчин зөвшөөрөх ангиллууд");
});

test("sceneTooSimilar: сүүлийн постуудтай давхардсан дүрслэлийг барина", () => {
  const recent = [
    `${PHOTO_PROMPT_PREFIX}. A studio microphone with a waveform on the screen behind it, shallow depth of field.`,
    `${PHOTO_PROMPT_PREFIX}. A lone watchtower with a camera mast in the desert at dawn, wide shot.`,
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

  // Урт тогтмол угтвар давхцлыг шингэлэх ёсгүй — зөвхөн дүрслэлээ харьцуулна
  assert.equal(
    sceneTooSimilar(
      buildPhotoPrompt("A studio microphone beside a waveform on a screen, soft light."),
      recent,
    ),
    true,
  );
});

test("recentScenesBlock: prompt-ийн тогтмол хэсгийг хасаж, 10-аар хязгаарлана", () => {
  assert.equal(recentScenesBlock([]), "");
  assert.equal(RECENT_SCENES, 10);

  const many = Array.from({ length: 15 }, (_, i) => buildPhotoPrompt(`scene number ${i}`));
  const block = recentScenesBlock(many);
  assert.ok(block.startsWith("Recent scenes"));
  assert.ok(!block.includes(PHOTO_PROMPT_PREFIX), "тогтмол хэсэг давтагдахгүй");
  assert.ok(!block.includes(PHOTO_PROMPT_NEGATIVE), "хориглох жагсаалт ч давтагдахгүй");
  assert.equal(block.split("\n").length - 1, RECENT_SCENES);
  assert.ok(block.includes("- scene number 0") && !block.includes("- scene number 10"));
});

test("overlaySvg: эх сурвалжийн зураг хэрэглэвэл credit доод баруун буланд", () => {
  assert.equal(creditText("The Verge AI"), "Зураг: The Verge AI");

  const withCredit = overlaySvg({
    lines: ["Мөр"], fontSize: 64, cta: CTA_FB, credit: creditText("The Verge AI"),
  });
  assert.ok(withCredit.includes(">Зураг: The Verge AI<"));
  assert.ok(withCredit.includes('text-anchor="end"'), "баруун талд");

  // Credit өгөөгүй бол огт гарахгүй
  assert.ok(!overlaySvg({ lines: ["Мөр"], fontSize: 64, cta: CTA_FB }).includes("Зураг:"));
});
