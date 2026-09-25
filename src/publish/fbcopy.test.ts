import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assemblePost, bodyOf, checkBody, domainOf, FOLLOW_LINE, MAX_BODY_CHARS, MIN_BODY_CHARS,
  sanitizeVariant, showSource, SOURCE_PREFIX, type CopyVariant,
} from "./fbcopy.api";

const LINK = "https://ainews.mn/medee/test-nijtlel";

const variant = (over: Partial<CopyVariant> = {}): CopyVariant => ({
  context:
    "Австралийн Засгийн газрын Medicare системд хиймэл оюуны агент зөвшөөрөлгүй нэвтэрсэн явдлыг гурван сарын дараа олон нийтэд мэдэгдсэн байна.",
  why:
    "Ийм саатал нь иргэдийн эмзэг мэдээлэл хэр удаан хамгаалалтгүй байснаа мэдэх боломжийг хаадаг. " +
    "Монголд ч төрийн системд гадны хэрэгсэл нэвтрүүлэхдээ хэн, хэзээ мэдэгдэх журмыг урьдчилан тогтоох нь чухал болохыг харуулж байна.",
  ...over,
});

test("assemblePost: биет / холбоос / дагах уриалга гэсэн 3 хэсэг", () => {
  const post = assemblePost({ variant: variant(), link: LINK });
  const blocks = post.split("\n\n");

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0], bodyOf(variant()));
  assert.equal(blocks[1], `Дэлгэрэнгүй: ${LINK}`);
  assert.equal(blocks[2], FOLLOW_LINE);
  assert.ok(!post.includes("#"), "FB постод hashtag байхгүй");
});

test("assemblePost: FB_SHOW_SOURCE үед эх сурвалжийн домэйн нэмэгдэнэ", () => {
  const post = assemblePost({ variant: variant(), link: LINK, sourceDomain: "theverge.com" });
  const blocks = post.split("\n\n");

  assert.equal(blocks.length, 4);
  assert.equal(blocks[2], `${SOURCE_PREFIX}theverge.com`);
  assert.equal(blocks[3], FOLLOW_LINE);
});

test("showSource / domainOf", () => {
  assert.equal(showSource({}), false, "анхдагчаар эх сурвалж бичихгүй");
  assert.equal(showSource({ FB_SHOW_SOURCE: "true" }), true);
  assert.equal(showSource({ FB_SHOW_SOURCE: "false" }), false);

  assert.equal(domainOf("https://www.theverge.com/2026/9/24/ai"), "theverge.com");
  assert.equal(domainOf("https://futurism.com/x"), "futurism.com");
  assert.equal(domainOf("буруу хаяг"), "");
});

test("checkBody: 250–400 тэмдэгтийн хүрээ", () => {
  assert.deepEqual(checkBody(bodyOf(variant()), ["TechCrunch"]), []);

  const codes = (body: string, forbidden: string[] = []) => checkBody(body, forbidden).map((p) => p.code);
  assert.ok(codes("Богино текст.").includes("too-short"));
  assert.ok(codes("у".repeat(MAX_BODY_CHARS + 10)).includes("too-long"));

  const body = bodyOf(variant());
  assert.ok(body.length >= MIN_BODY_CHARS && body.length <= MAX_BODY_CHARS, `${body.length} тэмдэгт`);
});

test("checkBody: emoji, хашилт, хашгирах, холбоос, AI илчлэлт, эх сурвалжийн нэр", () => {
  const codes = (extra: string, forbidden: string[] = []) =>
    checkBody(bodyOf(variant({ context: `${extra} ${variant().context}` })), forbidden).map((p) => p.code);

  assert.ok(codes("Гайхалтай 🚀").includes("emoji"));
  assert.ok(codes('Энэ бол "хашилттай" текст.').includes("quotes"));
  assert.ok(codes("ЭНЭ БОЛ ХАШГИРСАН ЭХЛЭЛ.").includes("shouting"));
  assert.ok(codes("Дэлгэрэнгүйг https://a.mn/b дээрээс.").includes("has-link"));
  assert.ok(codes("Энэ нийтлэлийг ChatGPT-ээр бэлтгэсэн.").includes("ai-author"));
  assert.ok(codes("TechCrunch-ийн мэдээлснээр.", ["TechCrunch"]).includes("source-name"));

  // Товчлол ганцаараа бол хашгирсан гэж үзэхгүй, моделийн нэр дурдах нь зүгээр
  assert.ok(!codes("NASA шинэ хиймэл дагуул хөөргөлөө.").includes("shouting"));
  assert.ok(!codes("Шинэ Gemini модель гарчээ.").includes("ai-author"));
});

test("sanitizeVariant: emoji, хашилт, холбоосыг хасна", () => {
  const dirty = variant({
    context: "«Тавтай морил» 🚀 https://a.mn/b дээр",
    why: "Сайн 😀 байна   уу.",
  });
  const clean = sanitizeVariant(dirty);

  assert.ok(!/[🚀😀«»]/u.test(`${clean.context}${clean.why}`));
  assert.ok(!clean.context.includes("http"));
  assert.equal(clean.why, "Сайн байна уу.");
});
