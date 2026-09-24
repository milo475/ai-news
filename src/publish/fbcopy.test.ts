import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assemblePost, checkPost, HOOK_TYPES, MAX_HOOK_CHARS, MAX_POST_CHARS, MIN_POST_CHARS,
  normalizeHashtags, pickHookTypes, sanitizeVariant, type CopyVariant,
} from "./fbcopy.api";

const LINK = "https://ainews.mn/medee/test-nijtlel";

const variant = (over: Partial<CopyVariant> = {}): CopyVariant => ({
  hookType: "number",
  hook: "Хуулийн фирмүүдийн 40 хувь нь ажлынхаа хэсгийг машинд даалгаж эхэлжээ.",
  body:
    "Шинэ шийдэл нь байгууллагын нууц мэдээллийг гадагш гаргалгүй ажиллах боломж олгож байна. " +
    "Энэ нь өмнө нь үнэтэй мэргэжилтэн шаарддаг байсан ажлыг хямдруулж, жижиг фирмүүдэд ч хүртээмжтэй болгоно. " +
    "Монголын хуулийн байгууллагууд ч ойрын жилүүдэд ижил зам руу орох төлөвтэй.",
  hashtags: ["#хууль", "#AI"],
  ...over,
});

test("assemblePost: hook, биет, «Дэлгэрэнгүй:» холбоос, hashtag гэсэн 4 хэсэг", () => {
  const post = assemblePost(variant(), LINK);
  const blocks = post.split("\n\n");
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0], variant().hook);
  assert.equal(blocks[2], `Дэлгэрэнгүй: ${LINK}`);
  assert.equal(blocks[3], "#AI #ХиймэлОюун #хууль");
  assert.ok(post.length >= MIN_POST_CHARS && post.length <= MAX_POST_CHARS, `урт ${post.length}`);
});

test("checkPost: зөв пост зөрчилгүй", () => {
  assert.deepEqual(checkPost(assemblePost(variant(), LINK), variant().hook, ["TechCrunch"]), []);
});

test("checkPost: emoji, урт hook, хашилт, хашгирах — бүгдийг барина", () => {
  const codes = (v: CopyVariant, forbidden: string[] = []) =>
    checkPost(assemblePost(v, LINK), v.hook, forbidden).map((p) => p.code);

  assert.ok(codes(variant({ hook: "Гайхалтай мэдээ 🚀" })).includes("emoji"));
  assert.ok(codes(variant({ body: `Энэ бол "хашилттай" текст. ${variant().body}` })).includes("quotes"));

  const longHook = "Х".repeat(MAX_HOOK_CHARS + 10);
  assert.ok(codes(variant({ hook: longHook })).includes("hook-long"));

  assert.ok(codes(variant({ hook: "ЭНЭ БОЛ ХАШГИРСАН ГАРЧИГ" })).includes("shouting"));
  // Товчлол ганцаараа бол хашгирсан гэж үзэхгүй
  assert.ok(!codes(variant({ hook: "NASA шинэ хиймэл дагуулаа хөөргөлөө." })).includes("shouting"));
});

test("checkPost: AI бичсэн гэдгээ дурдсан, эх сурвалжийн нэр — regex-ээр барина", () => {
  const withAi = variant({ body: `Энэ нийтлэлийг ChatGPT-ээр бэлтгэсэн болно. ${variant().body}` });
  assert.ok(checkPost(assemblePost(withAi, LINK), withAi.hook).some((p) => p.code === "ai-author"));

  const withAi2 = variant({ body: `Хиймэл оюун бичсэн тул алдаа гарч болно. ${variant().body}` });
  assert.ok(checkPost(assemblePost(withAi2, LINK), withAi2.hook).some((p) => p.code === "ai-author"));

  const withSource = variant({ body: `TechCrunch-ийн мэдээлснээр ийм болжээ. ${variant().body}` });
  assert.ok(
    checkPost(assemblePost(withSource, LINK), withSource.hook, ["TechCrunch AI", "TechCrunch"])
      .some((p) => p.code === "source-name"),
  );

  // Моделийн нэр дурдах нь зүгээр — зөвхөн "AI бичсэн" гэсэн илчлэлт хоригтой
  const modelName = variant({ body: `Шинэ Gemini модель гарчээ. ${variant().body}` });
  assert.deepEqual(
    checkPost(assemblePost(modelName, LINK), modelName.hook).map((p) => p.code),
    [],
  );
});

test("sanitizeVariant: emoji, хашилтыг хасаж, урт hook-ийг таслана", () => {
  const dirty = variant({ hook: `«Тавтай морил» 🚀 ${"үг ".repeat(40)}`, body: "Сайн 😀 байна уу." });
  const clean = sanitizeVariant(dirty);
  assert.ok(clean.hook.length <= MAX_HOOK_CHARS);
  assert.ok(!/[🚀😀«»]/u.test(`${clean.hook}${clean.body}`));
  assert.equal(clean.body, "Сайн байна уу.");
});

test("normalizeHashtags: #AI #ХиймэлОюун үргэлж эхэлнэ, нийт 3", () => {
  assert.deepEqual(normalizeHashtags(["#хууль", "#технологи"]), ["#AI", "#ХиймэлОюун", "#хууль"]);
  assert.deepEqual(normalizeHashtags([]), ["#AI", "#ХиймэлОюун"]);
  assert.deepEqual(normalizeHashtags(["#ai"]), ["#AI", "#ХиймэлОюун"]);   // давхардал орохгүй
});

test("pickHookTypes: хамгийн цөөн хэрэглэсэн 2 загварыг ээлжлүүлнэ", () => {
  const [a, b] = pickHookTypes({ number: 5, contrast: 4, question: 3, local: 1, forecast: 0 }, () => 0.5);
  assert.deepEqual([a, b], ["forecast", "local"]);

  // Бүгд тэнцүү бол бүх загвар сонгогдох боломжтой
  const picked = new Set<string>();
  for (let i = 0; i < 50; i++) for (const t of pickHookTypes({}, Math.random)) picked.add(t);
  assert.equal(picked.size, HOOK_TYPES.length);
});
