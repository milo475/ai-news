import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  buildPhotoPrompt, CARD_H, CARD_W, checkHook, CTA_FB, CTA_IG, fitHeadline, FONT_SIZES, MAX_HOOK_CHARS,
  MAX_LINES, overlaySvg, PAD, PHOTO_PROMPT_NEGATIVE, pickHook, wrapLines,
} from "./card.api";
import { heroJpeg, renderCard } from "./card";

const GOOD = "Австралийн төрийн системд AI агент 3 сарын турш илрээгүй байжээ.";

test("checkHook: тоотой, нэг өгүүлбэр, emoji/хашилтгүй байх", () => {
  assert.deepEqual(checkHook(GOOD), []);

  const codes = (h: string) => checkHook(h).map((p) => p.code);
  assert.ok(codes("").includes("empty"));
  assert.ok(codes("Хиймэл оюун хөгжиж байна.").includes("no-number"), "тоо байхгүй");
  assert.ok(codes(`${"у".repeat(MAX_HOOK_CHARS + 5)} 40 хувь`).includes("too-long"));
  assert.ok(codes("40 хувь нь ингэжээ 🚀").includes("emoji"));
  assert.ok(codes('«40 хувь» нь ингэжээ').includes("quotes"));
  assert.ok(codes("40 хувь нь ингэжээ. Дараа нь тэгжээ.").includes("multi-sentence"));
  assert.ok(codes("ЭНЭ БОЛ 40 ХУВИЙН ӨӨРЧЛӨЛТ").includes("shouting"));

  // Товчлол ганцаараа бол хашгирсан гэж үзэхгүй
  assert.ok(!codes("NASA 40 сая долларын гэрээ байгуулжээ.").includes("shouting"));
});

test("pickHook: шалгуур давсан хамгийн богиныг сонгоно", () => {
  const picked = pickHook([
    "Австралийн төрийн системд хиймэл оюуны агент 3 сарын турш илрээгүй хэвээр байжээ гэнэ.",
    GOOD,
    "Хиймэл оюун хөгжиж байна.", // тоогүй — хасагдана
  ]);
  assert.equal(picked, GOOD);

  assert.equal(pickHook(["Тоогүй өгүүлбэр.", "Бас нэг тоогүй."]), null);
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
});

test("renderCard: 1080×1350 JPEG, суурь зургаас өөр (overlay зурагдсан)", async () => {
  const flat = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: { r: 120, g: 120, b: 120 } },
  }).png().toBuffer();

  const hero = await heroJpeg(flat);
  const heroMeta = await sharp(hero).metadata();
  assert.equal(heroMeta.width, CARD_W);
  assert.equal(heroMeta.height, CARD_H);

  const card = await renderCard(hero, GOOD, CTA_FB);
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
