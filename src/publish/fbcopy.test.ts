import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assemblePost, bodyOf, checkBody, checkQuestion, cleanQuestion, cleanTags, domainOf,
  ensureLinkInComment, fallbackVariant, firstSentences, FOLLOW_LINE,
  LINK_IN_COMMENT_LINE, linkComment, MAX_BODY_CHARS, MAX_QUESTION_CHARS, MIN_BODY_CHARS,
  sanitizeVariant, showSource, SOURCE_PREFIX, withoutLinkNotice, type CopyVariant,
} from "./fbcopy.api";

const LINK = "https://ainews.mn/medee/test-nijtlel";

const variant = (over: Partial<CopyVariant> = {}): CopyVariant => ({
  context:
    "Австралийн Засгийн газрын Medicare системд хиймэл оюуны агент зөвшөөрөлгүй нэвтэрсэн явдлыг гурван сарын дараа олон нийтэд мэдэгдсэн байна.",
  why:
    "Ийм саатал нь иргэдийн эмзэг мэдээлэл хэр удаан хамгаалалтгүй байснаа мэдэх боломжийг хаадаг. " +
    "Монголд ч төрийн системд гадны хэрэгсэл нэвтрүүлэхдээ хэн, хэзээ мэдэгдэх журмыг урьдчилан тогтоох нь чухал болохыг харуулж байна.",
  question: "Та төрийн онлайн үйлчилгээнд хувийн мэдээллээ өгөхөөс эмээдэг үү?",
  ...over,
});

test("assemblePost: биет / асуулт / холбоосын мөр / дагах уриалга", () => {
  const post = assemblePost({ variant: variant() });
  const blocks = post.split("\n\n");

  assert.equal(blocks.length, 4);
  assert.equal(blocks[0], bodyOf(variant()));
  assert.equal(blocks[1], variant().question);
  assert.equal(blocks[2], LINK_IN_COMMENT_LINE);
  assert.equal(blocks[3], FOLLOW_LINE);
  assert.ok(!post.includes("#"), "FB постод hashtag байхгүй");
  assert.ok(!/https?:\/\//.test(post), "постын биед ГАДААД ХОЛБООС байж болохгүй");
});

test("assemblePost: асуулт нь буруу бол алгасагдана, пост эвдрэхгүй", () => {
  const post = assemblePost({ variant: variant({ question: "Та юу гэж бодож байна?" }) });
  const blocks = post.split("\n\n");
  assert.equal(blocks.length, 3, "хэт ерөнхий асуулт орох ёсгүй");
  assert.equal(blocks[1], LINK_IN_COMMENT_LINE);
});

test("linkComment: холбоос эхний коммент болж явна", () => {
  assert.equal(linkComment(LINK), `Дэлгэрэнгүй: ${LINK}`);
});

test("withoutLinkNotice: link preview постод «коммент дээр» мөр хэрэггүй", () => {
  const post = assemblePost({ variant: variant() });
  const fallback = withoutLinkNotice(post);
  assert.ok(!fallback.includes(LINK_IN_COMMENT_LINE));
  assert.equal(fallback.split("\n\n").length, 3);
});

test("cleanQuestion: асуултын шалгуур", () => {
  assert.equal(cleanQuestion("Та ажилдаа AI ашигладаг уу?"), "Та ажилдаа AI ашигладаг уу?");
  assert.equal(cleanQuestion("  Танай хүүхэд   ийм апп хэрэглэдэг үү?  "), "Танай хүүхэд ийм апп хэрэглэдэг үү?");
  assert.equal(cleanQuestion("Асуултын тэмдэггүй"), null);
  assert.equal(cleanQuestion(""), null);
  assert.equal(cleanQuestion("Та юу гэж бодож байна?"), null, "хэт ерөнхий");
  assert.equal(cleanQuestion(`${"х".repeat(MAX_QUESTION_CHARS)}?`), null, "хэт урт");
  assert.equal(cleanQuestion("Та AI ашигладаг уу? 🙂"), "Та AI ашигладаг уу?", "emoji хасагдана");
});

test("cleanTags: # нэг удаа, давхардалгүй, дээд тал нь 4", () => {
  assert.deepEqual(cleanTags(["#хиймэлоюун", "chatgpt", "#ChatGPT", "технологи", "#ai", "#нэмэлт"]),
    ["#хиймэлоюун", "#chatgpt", "#технологи", "#ai"]);
  assert.deepEqual(cleanTags(["#", "!!!", ""]), []);
  assert.deepEqual(cleanTags(["#нэг", "#хоёр"], 1), ["#нэг"]);
});

test("assemblePost: FB_SHOW_SOURCE үед эх сурвалжийн домэйн нэмэгдэнэ", () => {
  const post = assemblePost({ variant: variant(), sourceDomain: "theverge.com" });
  const blocks = post.split("\n\n");

  assert.equal(blocks.length, 5);
  assert.equal(blocks[3], `${SOURCE_PREFIX}theverge.com`);
  assert.equal(blocks[4], FOLLOW_LINE);
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

test("ensureLinkInComment: хуучин текстийн холбоосыг хасаж, мөрийг нэмнэ", () => {
  const old = [
    "Биетийн текст.",
    `Дэлгэрэнгүй: ${LINK}`,
    FOLLOW_LINE,
  ].join("\n\n");

  const fixed = ensureLinkInComment(old);
  assert.deepEqual(fixed.split("\n\n"), ["Биетийн текст.", LINK_IN_COMMENT_LINE, FOLLOW_LINE]);
  assert.ok(!/https?:\/\//.test(fixed));
});

test("ensureLinkInComment: шинэ текстийг хөндөхгүй (идемпотент)", () => {
  const post = assemblePost({ variant: variant() });
  assert.equal(ensureLinkInComment(post), post);
  assert.equal(ensureLinkInComment(ensureLinkInComment(post)), post);
});

test("ensureLinkInComment: дагах уриалга байхгүй бол төгсгөлд нэмнэ", () => {
  const fixed = ensureLinkInComment(`Биет.\n\nДэлгэрэнгүй: ${LINK}`);
  assert.deepEqual(fixed.split("\n\n"), ["Биет.", LINK_IN_COMMENT_LINE]);
});

// ---------- Уншигчийн асуулт яагаад гарахгүй байна вэ ----------

test("асуулт хаягдсан шалтгааныг нэрлэнэ", () => {
  assert.deepEqual(checkQuestion(""), { question: null, reason: "LLM асуулт өгөөгүй" });
  assert.deepEqual(checkQuestion("   "), { question: null, reason: "LLM асуулт өгөөгүй" });
  assert.deepEqual(checkQuestion("Танайд ийм систем бий юу"), {
    question: null, reason: "асуултын тэмдэггүй",
  });
  assert.deepEqual(checkQuestion("Та юу гэж бодож байна?"), { question: null, reason: "хэт ерөнхий" });
  assert.equal(checkQuestion("а".repeat(MAX_QUESTION_CHARS + 1) + "?").reason, "хэт урт");
});

test("зөв асуулт шалтгаангүй өнгөрнө", () => {
  const ok = checkQuestion("Танай багт ийм зүйл тохиолдож байсан уу?");
  assert.equal(ok.reason, null);
  assert.equal(ok.question, "Танай багт ийм зүйл тохиолдож байсан уу?");
  // cleanQuestion нь checkQuestion-ийн хураангуй хэвээр
  assert.equal(cleanQuestion("Танай багт ийм зүйл тохиолдож байсан уу?"), ok.question);
});

// ---------- Fidelity унасан үеийн нөөц бие ----------

test("нийтлэлийн эхний өгүүлбэрүүдийг цэвэрхэн таслана", () => {
  assert.equal(firstSentences(null), "");
  assert.equal(firstSentences("Богино текст."), "Богино текст.");

  const long = "Эхний өгүүлбэр байна. " + "Хоёр дахь өгүүлбэр нэлээд урт байна. ".repeat(20);
  const cut = firstSentences(long, 120);
  assert.ok(cut.length <= 121, `урт нь ${cut.length}`);
  assert.ok(cut.endsWith(".") || cut.endsWith("…"));
  // Үг дундуур таслаагүй
  assert.ok(!/\s\S{1,2}…$/u.test(cut));
});

test("нөөц бие нь нийтлэлээс шууд авагдана — зохиосон зүйлгүй", () => {
  const v = fallbackVariant({
    summaryMn: "OpenAI шинэ загварынхаа сургалтыг түр зогсоов. Шалгалт дуусмагц үргэлжлүүлнэ.",
    bodyMn: null,
  });
  assert.ok(v);
  assert.match(v!.context, /түр зогсоов/);
  // Асуулт зохиохгүй
  assert.equal(v!.question, "");
  assert.equal(v!.why, "");
});

test("нийтлэл хэт богино бол нөөц бие үүсгэхгүй", () => {
  assert.equal(fallbackVariant({ summaryMn: "Богино.", bodyMn: null }), null);
  assert.equal(fallbackVariant({ summaryMn: null, bodyMn: null }), null);
});
