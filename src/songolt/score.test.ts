import { test } from "node:test";
import assert from "node:assert/strict";
import {
  budgetFits, CODE_LENGTH, decodeAnswers, DEVICE_PLATFORMS, encodeAnswers, MAX_TASKS, MONGOLIAN,
  POPULAR_THRESHOLD, recommend, reasonFor, scoreTool, STEPS, TASKS, TASK_CATEGORIES, vendorForTool,
  WEIGHTS, WHOS, type Answers, type ScorableTool,
} from "./score.api";

const A: Answers = {
  tasks: ["bichih", "orchuulga"],
  who: "oyutan",
  budget: "unegui",
  mongolian: "ih",
  device: "utas",
};

const tool = (over: Partial<ScorableTool> = {}): ScorableTool => ({
  id: "t1", slug: "x", name: "X", tagline: "Тайлбар",
  categories: ["BICHIH"], pricing: "FREEMIUM", priceFrom: null,
  mongolianSupport: "PARTIAL", platforms: ["web"], upvotes: 0, clicks: 0, mnScore: null,
  ...over,
});

// ——— Кодчилол ———

test("encodeAnswers / decodeAnswers: тойрог бүтэн", () => {
  const code = encodeAnswers(A);
  assert.equal(code.length, CODE_LENGTH);
  assert.deepEqual(decodeAnswers(code), A);

  // Ижил хариулт → ижил код (хуваалцахад чухал)
  assert.equal(encodeAnswers(A), code);
  // Өөр хариулт → өөр код
  assert.notEqual(encodeAnswers({ ...A, who: "bagsh" }), code);
  assert.notEqual(encodeAnswers({ ...A, mongolian: "baga" }), code);
});

test("decodeAnswers: бүх хослол буцаж задарна", () => {
  for (const who of WHOS) {
    for (const m of MONGOLIAN) {
      const a: Answers = { tasks: ["code", "zurag", "yarilzah"], who, budget: "hamaagui", mongolian: m, device: "hoyul" };
      assert.deepEqual(decodeAnswers(encodeAnswers(a)), a, `${who}/${m}`);
    }
  }
  // Даалгавар бүр тус тусдаа
  for (const t of TASKS) {
    const a: Answers = { ...A, tasks: [t] };
    assert.deepEqual(decodeAnswers(encodeAnswers(a)), a, t);
  }
});

test("decodeAnswers: эвдэрсэн, зохиосон кодыг барина", () => {
  assert.equal(decodeAnswers(""), null);
  assert.equal(decodeAnswers("abc"), null, "богино");
  assert.equal(decodeAnswers("abcdefgh"), null, "урт");
  assert.equal(decodeAnswers("ab!de"), null, "цагаан толгойд байхгүй тэмдэгт");

  // Санамсаргүй 5 тэмдэгт бараг бүгд шалгах нийлбэрт унана
  let valid = 0;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  for (let i = 0; i < 500; i++) {
    let s = "";
    for (let j = 0; j < CODE_LENGTH; j++) s += alphabet[(i * 37 + j * 13) % 64];
    if (decodeAnswers(s)) valid++;
  }
  assert.ok(valid < 30, `500 санамсаргүй кодоос ${valid} нь давсан — шалгах нийлбэр сул`);

  // Нэг тэмдэгт өөрчлөхөд хүчингүй болно
  const code = encodeAnswers(A);
  const broken = `${code.slice(0, 4)}${code[4] === "A" ? "B" : "A"}`;
  assert.equal(decodeAnswers(broken), null);
});

test("encodeAnswers: 3-аас илүү даалгавар кодод багтахгүй", () => {
  const many: Answers = { ...A, tasks: [...TASKS] };
  const back = decodeAnswers(encodeAnswers(many))!;
  assert.equal(back.tasks.length, MAX_TASKS, "дээд тал нь 3");
  assert.equal(STEPS, 5);
});

// ——— Оноо ———

test("scoreTool: ангилал, монгол хэл, төсөв, платформ, бенчмарк, алдартай", () => {
  // Бүх шалгуур таарсан
  const perfect = scoreTool(
    tool({
      categories: ["BICHIH", "ORCHUULGA"], pricing: "FREE", mongolianSupport: "GOOD",
      platforms: ["ios", "web"], upvotes: 10, mnScore: 10,
    }),
    A,
  );
  assert.equal(perfect.category, WEIGHTS.category * 2, "хоёр ангилал таарсан");
  assert.equal(perfect.mongolian, WEIGHTS.mongolianGood * 2, "монгол их → хоёр дахин");
  assert.equal(perfect.budget, WEIGHTS.budget);
  assert.equal(perfect.platform, WEIGHTS.platform);
  assert.equal(perfect.benchmark, WEIGHTS.benchmark, "10/10 → бүтэн жин");
  assert.equal(perfect.popular, WEIGHTS.popular);
  assert.equal(perfect.total, 6 + 4 + 2 + 1 + 2 + 1);

  // Ангилал таараагүй
  assert.equal(scoreTool(tool({ categories: ["CODE"] }), A).category, 0);

  // Монгол бага хэрэглэнэ → жин хоёр дахин болохгүй
  const less = scoreTool(tool({ mongolianSupport: "GOOD" }), { ...A, mongolian: "baga" });
  assert.equal(less.mongolian, WEIGHTS.mongolianGood);
  assert.equal(scoreTool(tool({ mongolianSupport: "NONE" }), A).mongolian, 0);

  // Бенчмарк байхгүй нь шийтгэл биш — зүгээр 0 нэмэгдэнэ
  assert.equal(scoreTool(tool({ mnScore: null }), A).benchmark, 0);
  assert.equal(scoreTool(tool({ mnScore: 5 }), A).benchmark, 1);

  // Платформ таараагүй (утас сонгосон, зөвхөн desktop)
  assert.equal(scoreTool(tool({ platforms: ["desktop"] }), A).platform, 0);
  assert.equal(POPULAR_THRESHOLD, 5);
  assert.equal(scoreTool(tool({ upvotes: 2, clicks: 2 }), A).popular, 0);
  assert.equal(scoreTool(tool({ upvotes: 2, clicks: 3 }), A).popular, WEIGHTS.popular);
});

test("budgetFits: үнэгүй, $10, хамаагүй", () => {
  assert.equal(budgetFits(tool({ pricing: "FREE" }), "unegui"), true);
  assert.equal(budgetFits(tool({ pricing: "FREEMIUM" }), "unegui"), true);
  assert.equal(budgetFits(tool({ pricing: "PAID", priceFrom: 5 }), "unegui"), false);

  assert.equal(budgetFits(tool({ pricing: "PAID", priceFrom: 8 }), "arvan"), true);
  assert.equal(budgetFits(tool({ pricing: "PAID", priceFrom: 20 }), "arvan"), false);
  assert.equal(budgetFits(tool({ pricing: "PAID", priceFrom: null }), "arvan"), false, "үнэ мэдэгдэхгүй");

  // «Хамаагүй» бол бүгд тохирно
  assert.equal(budgetFits(tool({ pricing: "PAID", priceFrom: 200 }), "hamaagui"), true);
});

test("recommend: оюутан + үнэгүй + монгол их → үнэгүй, MN дэмжлэгтэй нь эхэнд", () => {
  const tools: ScorableTool[] = [
    tool({ id: "paid", slug: "paid", name: "Төлбөртэй", pricing: "PAID", priceFrom: 30, mongolianSupport: "GOOD", platforms: ["ios"] }),
    tool({ id: "free-mn", slug: "free-mn", name: "Үнэгүй MN", pricing: "FREE", mongolianSupport: "GOOD", platforms: ["ios", "web"] }),
    tool({ id: "free-en", slug: "free-en", name: "Үнэгүй EN", pricing: "FREE", mongolianSupport: "NONE", platforms: ["ios"] }),
    tool({ id: "other", slug: "other", name: "Өөр ангилал", categories: ["CODE"], pricing: "FREE" }),
  ];

  const r = recommend(tools, A);
  assert.equal(r.length, 3);
  assert.equal(r[0]!.tool.slug, "free-mn", "үнэгүй + монголоор сайн нь тэргүүлнэ");
  assert.ok(r[0]!.score.total > r[1]!.score.total);
  // Ангилал таараагүй нь огт орохгүй
  assert.ok(!r.some((x) => x.tool.slug === "other"), "ангилал таараагүй нь орохгүй");

  // Шалтгаан нь хоосон биш, 2 өгүүлбэр
  for (const x of r) {
    assert.ok(x.reason.length > 30, x.tool.slug);
    assert.ok(x.reason.includes(x.tool.name));
  }
});

test("recommend: ангилал огт таараагүй үед хоосон буцаахгүй", () => {
  const tools = [tool({ slug: "a", categories: ["AUDIO"] }), tool({ slug: "b", categories: ["VIDEO"] })];
  const r = recommend(tools, A);
  assert.equal(r.length, 2, "шүүлтгүй эрэмбээр гүйцээнэ");
  assert.deepEqual(recommend([], A), []);
});

test("recommend: тэнцвэл нэрээр эрэмбэлж тогтвортой", () => {
  const same = (slug: string, name: string) => tool({ id: slug, slug, name });
  const r1 = recommend([same("b", "Бета"), same("a", "Альфа")], A);
  const r2 = recommend([same("a", "Альфа"), same("b", "Бета")], A);
  assert.deepEqual(r1.map((x) => x.tool.slug), r2.map((x) => x.tool.slug), "дараалал хамаарахгүй");
});

test("reasonFor: зөвхөн баталгаатай өгөгдөл дурдана", () => {
  const t = tool({ name: "ChatGPT", pricing: "FREEMIUM", mongolianSupport: "GOOD", platforms: ["ios"], mnScore: 7.9 });
  const reason = reasonFor(t, A, scoreTool(t, A));
  assert.match(reason, /Оюутан/);
  assert.match(reason, /ChatGPT/);
  assert.match(reason, /бичих, орчуулах/);
  assert.match(reason, /үнэгүй хувилбартай/);
  assert.match(reason, /7\.9\/10/);

  // Бенчмаркгүй хэрэгсэлд оноо дурдагдахгүй
  const noScore = tool({ mnScore: null, mongolianSupport: "NONE", pricing: "PAID", priceFrom: null, platforms: ["desktop"] });
  const r2 = reasonFor(noScore, A, scoreTool(noScore, A));
  assert.ok(!r2.includes("/10"));
  assert.ok(r2.includes("Тайлбар"), "мэдээлэл байхгүй бол tagline-ыг хэлнэ");
});

test("даалгавар → ангилал, төхөөрөмж → платформ бүрэн зураглагдсан", () => {
  for (const t of TASKS) {
    assert.ok(TASK_CATEGORIES[t].length > 0, t);
  }
  assert.deepEqual(DEVICE_PLATFORMS.utas, ["ios", "android"]);
  assert.ok(DEVICE_PLATFORMS.hoyul.length > DEVICE_PLATFORMS.comp.length);
});

test("vendorForTool: мэдэгдэх хэрэгслийг л холбоно", () => {
  assert.equal(vendorForTool("chatgpt"), "openai");
  assert.equal(vendorForTool("claude"), "anthropic");
  assert.equal(vendorForTool("canva"), null, "модель нь тодорхойгүй хэрэгсэлд холбоо тавихгүй");
});
