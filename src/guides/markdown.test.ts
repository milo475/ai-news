import { test } from "node:test";
import assert from "node:assert/strict";
import { headingId, howToSteps, promptBlocks, readMinutes, tocFromMarkdown } from "./markdown.api";
import { checkGuide, sanitizeDraft, toMarkdown, type GuideDraft } from "./write.api";

const MD = [
  "## 1. Бүртгүүлэх",
  "chat.openai.com руу орж утасны дугаараараа бүртгүүлнэ.",
  "",
  "```prompt",
  "Чи миний туслах. Дараах текстийг албан ёсны хэлбэрт оруулж өгөөч:",
  "<текстээ энд тавина>",
  "```",
  "",
  "## 2. Эхний асуултаа бичих",
  "Асуултаа тодорхой бич. Жишээ нь «ХХК-ийн санхүүгийн тайлан» гэж бич.",
  "",
  "## Түгээмэл алдаа",
  "- Хэт ерөнхий асуулт тавих — юу хүсэж байгаагаа тодорхой бич.",
].join("\n");

test("tocFromMarkdown: h2-уудаас агуулга, давхардлыг дугаарлана", () => {
  const toc = tocFromMarkdown(MD);
  assert.deepEqual(toc.map((t) => t.text), ["1. Бүртгүүлэх", "2. Эхний асуултаа бичих", "Түгээмэл алдаа"]);
  assert.ok(toc.every((t) => t.id.length > 0));
  assert.equal(new Set(toc.map((t) => t.id)).size, 3, "id давхардахгүй");

  // Ижил гарчиг хоёр удаа — хоёр дахь нь -2
  const dup = tocFromMarkdown("## Алхам\ntext\n\n## Алхам\ntext");
  assert.deepEqual(dup.map((t) => t.id), [headingId("Алхам"), `${headingId("Алхам")}-2`]);

  // ``` дотор байгаа ## нь гарчиг биш
  const fenced = tocFromMarkdown("## Жинхэнэ\n\n```prompt\n## Хуурамч\n```\n");
  assert.deepEqual(fenced.map((t) => t.text), ["Жинхэнэ"]);

  // h1, h3 нь TOC-д орохгүй
  assert.deepEqual(tocFromMarkdown("# Дээд\n### Доод").length, 0);
});

test("promptBlocks: ```prompt блокууд л гарна", () => {
  const blocks = promptBlocks(MD);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0]!, /^Чи миний туслах/);
  assert.match(blocks[0]!, /<текстээ энд тавина>$/);

  // Өөр хэлний блок орохгүй
  assert.deepEqual(promptBlocks("```js\nconsole.log(1)\n```"), []);
  // Хоосон блок орохгүй
  assert.deepEqual(promptBlocks("```prompt\n\n```"), []);
  // Олон блок
  assert.equal(promptBlocks("```prompt\nнэг үг нэмэх\n```\n\n```prompt\nхоёр дахь\n```").length, 2);
});

test("howToSteps: JSON-LD-д алхам бүрийн нэр, текст", () => {
  const steps = howToSteps(MD);
  assert.equal(steps.length, 3);
  assert.equal(steps[0]!.text, "1. Бүртгүүлэх");
  assert.match(steps[0]!.body, /chat\.openai\.com/);
  assert.ok(!steps[0]!.body.includes("Чи миний туслах"), "prompt блок тайлбарт орохгүй");
  assert.match(steps[2]!.body, /Хэт ерөнхий асуулт/);
  assert.ok(!/[*_`#>]/.test(steps[2]!.body), "markdown тэмдэг цэвэрлэгдэнэ");
  assert.deepEqual(howToSteps("гарчиггүй текст"), []);
});

test("readMinutes: prompt блок уншлагын хугацаанд орохгүй", () => {
  const words = Array.from({ length: 360 }, () => "үг").join(" ");
  assert.equal(readMinutes(words), 2);
  assert.equal(readMinutes("богино"), 1, "доод хязгаар 1 мин");
  assert.equal(
    readMinutes(`${words}\n\n\`\`\`prompt\n${words}\n\`\`\``),
    2,
    "код блок тооцоонд орохгүй",
  );
});

const DRAFT: GuideDraft = {
  title: "ChatGPT-г монголоор ашиглах",
  lead: "Энэ зааварт ChatGPT-г монгол хэлээр ашиглах үндсэн алхмуудыг үзнэ. Бүртгэлээс эхлээд эхний хариултаа авах хүртэл.",
  steps: [
    { heading: "Бүртгүүлэх", body: "Утасны дугаараа оруулж бүртгүүлнэ.", prompt: "" },
    { heading: "Асуултаа бичих", body: "Тодорхой бич.", prompt: "Чи миний туслах редактор. Дараах текстийг албан ёсны хэлбэрт оруулж, хоёр өөр хувилбар санал болгож өгөөч." },
    { heading: "Хариултаа шалгах", body: "Тоо, огноог нь баталгаажуул.", prompt: "" },
    { heading: "Дахин асуух", body: "Дутууг нь нэмүүл.", prompt: "" },
    { heading: "Хадгалах", body: "Ашигтай хариултыг тэмдэглэ.", prompt: "" },
  ],
  mistakes: ["Хэт ерөнхий асуух — тодорхой бич.", "Тоог шалгахгүй итгэх.", "Хувийн мэдээлэл оруулах."],
  faq: [
    { q: "ChatGPT үнэгүй юу?", a: "Үндсэн хувилбар нь үнэгүй." },
    { q: "Монголоор ойлгодог уу?", a: "Тийм, гэхдээ англиар илүү нарийн." },
    { q: "Утсан дээр ажилладаг уу?", a: "Тийм, апп бий." },
  ],
  tools: ["ChatGPT"],
  audience: ["оюутан"],
};

test("checkGuide: бүтэн заавар шалгуур давна", () => {
  assert.deepEqual(checkGuide(DRAFT), []);
});

test("checkGuide: дутуу, урт, emoji-тэй зааврыг барина", () => {
  const codes = (d: Partial<GuideDraft>) => checkGuide({ ...DRAFT, ...d }).map((p) => p.code);

  assert.ok(codes({ title: "" }).includes("title-empty"));
  assert.ok(codes({ title: "х".repeat(61) }).includes("title-long"));
  assert.ok(codes({ lead: "богино" }).includes("lead-short"));
  assert.ok(codes({ steps: DRAFT.steps.slice(0, 3) }).includes("few-steps"));
  assert.ok(codes({ faq: DRAFT.faq.slice(0, 2) }).includes("few-faq"));
  assert.ok(codes({ tools: [] }).includes("no-tools"));
  assert.ok(codes({ audience: ["танихгүй"] }).includes("bad-audience"));
  assert.ok(codes({ title: "ChatGPT ашиглах 🚀" }).includes("emoji"));

  // Хэт урт алхам
  const long = { ...DRAFT.steps[0]!, body: Array.from({ length: 130 }, () => "үг").join(" ") };
  assert.ok(codes({ steps: [long, ...DRAFT.steps.slice(1)] }).includes("step-long"));

  // Хэт богино prompt
  const shortPrompt = { ...DRAFT.steps[0]!, prompt: "Тусалаач" };
  assert.ok(codes({ steps: [shortPrompt, ...DRAFT.steps.slice(1)] }).includes("short-prompt"));

  // Өөрийгөө дурдах
  assert.ok(
    codes({ lead: "Энэ зааврыг хиймэл оюун бичсэн болно. Уншаарай, сонирхолтой байх болно." })
      .includes("self-reference"),
  );
});

test("checkGuide: хэрэгслийн нэрийг хориглохгүй (мэдээний дүрэм энд хамаарахгүй)", () => {
  const withNames = {
    ...DRAFT,
    lead: "ChatGPT, Gemini, Claude гурвын аль нь монголоор сайн бичдэгийг харьцуулна. Canva-гийн зураг үүсгэх хэсгийг ч үзнэ.",
    tools: ["ChatGPT", "Gemini", "Claude", "Canva"],
  };
  assert.deepEqual(checkGuide(withNames), [], "загварын нэр зөрчил биш");
});

test("sanitizeDraft: emoji арилгана, prompt-ийн мөр таслалт хэвээр", () => {
  const dirty: GuideDraft = {
    ...DRAFT,
    title: "ChatGPT 🚀 ашиглах",
    steps: [{ heading: "Эхлэх 🎯", body: "Товчийг  дар.", prompt: "Эхний мөр\nХоёр дахь мөр 🚀" }, ...DRAFT.steps.slice(1)],
    audience: ["оюутан", "танихгүй"],
  };
  const clean = sanitizeDraft(dirty);
  assert.equal(clean.title, "ChatGPT ашиглах");
  assert.equal(clean.steps[0]!.heading, "Эхлэх");
  assert.equal(clean.steps[0]!.body, "Товчийг дар.", "давхар зай арилна");
  assert.equal(clean.steps[0]!.prompt, "Эхний мөр\nХоёр дахь мөр", "мөр таслалт хэвээр");
  assert.deepEqual(clean.audience, ["оюутан"], "танихгүй уншигч хасагдана");
});

test("toMarkdown: алхам дугаарлагдаж, prompt блок болно", () => {
  const md = toMarkdown(DRAFT);
  const toc = tocFromMarkdown(md);
  assert.equal(toc.length, DRAFT.steps.length + 1, "алхмууд + Түгээмэл алдаа");
  assert.equal(toc[0]!.text, "1. Бүртгүүлэх");
  assert.equal(toc.at(-1)!.text, "Түгээмэл алдаа");

  const prompts = promptBlocks(md);
  assert.equal(prompts.length, 1);
  assert.match(prompts[0]!, /Чи миний туслах/);

  // Гарчигт өөрөө дугаар орсон байсан ч давхар дугаарлахгүй
  const numbered = toMarkdown({ ...DRAFT, steps: [{ ...DRAFT.steps[0]!, heading: "1) Бүртгүүлэх" }, ...DRAFT.steps.slice(1)] });
  assert.match(numbered, /^## 1\. Бүртгүүлэх$/m);
});
