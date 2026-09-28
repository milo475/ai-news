/**
 * FB текстийн fidelity шүүгч — зөрчилтэй хувилбарыг постлохгүй.
 *
 * 2026-09-27: эх мэдээ «түр зогсоов» байтал FB/IG текст «сургалт болон үнэлгээгээ
 * БҮРЭН зогсоолоо» гэж гарсан. Одоо хоёр хувилбар хоёулаа тэнцэхгүй бол постын
 * биеийг нийтлэлийн өөрийн өгүүлбэрээс бүрдүүлнэ (зохиох зүйл байхгүй).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);
const skip = !hasDb && "DATABASE_URL алга";

const SUMMARY = "OpenAI шинэ загварынхаа сургалтыг түр зогсоов. Шалгалт дуусмагц үргэлжлүүлнэ.";
const BODY =
  "OpenAI шинэ загварынхаа сургалтыг түр зогсоов. Компани аюулгүй байдлын шалгалт дуусмагц " +
  "хэдэн долоо хоногийн дараа үргэлжлүүлнэ. Энэ нь салбарын хэвийн практик бөгөөд өмнө нь " +
  "бусад лаборатори мөн ижил алхам хийж байсан удаатай юм.";

async function fixture(tag: string) {
  const { prisma } = await import("../db");
  const source = await prisma.source.upsert({
    where: { url: `https://fbc-${tag}.example.mn` },
    update: {},
    create: { name: `Тест ${tag}`, url: `https://fbc-${tag}.example.mn`, isActive: false },
  });
  const article = await prisma.article.create({
    data: {
      slug: `fbc-${tag}`, sourceId: source.id, sourceUrl: `https://fbc-${tag}.example.mn/1`,
      sourceTitle: "OpenAI pauses training", sourceHash: `${tag}-1`, status: "DRAFT",
      category: "NEWS", titleMn: "OpenAI сургалтаа түр зогсоов", summaryMn: SUMMARY, bodyMn: BODY,
    },
  });
  const cleanup = async () => {
    await prisma.article.deleteMany({ where: { sourceId: source.id } });
    await prisma.source.deleteMany({ where: { id: source.id } });
  };
  return { prisma, article, cleanup };
}

/** checkBody-д тэнцэхийн тулд бие нь 250–400 тэмдэгт байх ёстой */
const WHY =
  "Энэ нь салбарын хөгжилд шууд нөлөөлөх учраас чухал бөгөөд томоохон лабораториуд " +
  "хоорондоо ямар хурдаар өрсөлдөж байгааг харуулна. Монголын хэрэглэгчдэд ч шинэ " +
  "хувилбар хэзээ ирэх нь эндээс шалтгаална.";

function variant(context: string) {
  return { context, why: WHY, question: "Та ийм шийдвэрийг зөв гэж үзэж байна уу?" };
}

/**
 * System prompt-аар нь ялгана: нэг дуудагч хоёр өөр prompt ашиглаж байгаа тул
 * дуудлагын дугаараар ялгавал нэмэлт оролдлого бүрт мок тэнцвэрээ алддаг.
 */
function mockChat(contexts: string[], verdicts: { faithful: boolean; issues: string[] }[]) {
  let judged = 0;
  let copies = 0;
  const chat = (async (opts: { system: string }) => {
    if (/баримт шалгагч/.test(opts.system)) {
      const v = verdicts[judged] ?? { faithful: true, issues: [] };
      judged += 1;
      return { data: v, tokens: 40, costUsd: 0.00004 };
    }
    copies += 1;
    return {
      data: { variants: contexts.map(variant), hashtags: ["#ai", "#технологи"] },
      tokens: 100, costUsd: 0.0002,
    };
  }) as never;
  return { chat, judged: () => judged, copies: () => copies };
}

test("зөрчилтэй хувилбарыг алгасаж, үнэнч хувилбарыг сонгоно", { skip }, async () => {
  const tag = `a${Date.now()}`;
  const { article, cleanup } = await fixture(tag);
  const { generateFbCopy } = await import("./fbcopy");

  try {
    const m = mockChat(
      [
        // 1 дэх: «түр»-ийг хаясан — механик шалгалт барина, LLM хүртэл ч хүрэхгүй
        "OpenAI сургалт болон үнэлгээгээ бүрэн зогсоолоо.",
        // 2 дахь: hedge-ээ хадгалсан
        "OpenAI шинэ загварынхаа сургалтыг түр зогсоож, аюулгүй байдлын шалгалт хийж байна.",
      ],
      [{ faithful: true, issues: [] }],
    );
    const r = await generateFbCopy(article.id, { chat: m.chat, rand: () => 0.1, dryRun: true });

    assert.ok(r.text.includes("түр зогсоож"), "hedge-тэй хувилбар сонгогдох ёстой");
    assert.ok(!r.text.includes("бүрэн зогсоолоо"), "зөрчилтэй хувилбар постлогдох ёсгүй");
    assert.ok(r.problems.some((p) => /хувилбар 1 хүлээж авсангүй/.test(p)), r.problems.join("; "));
  } finally {
    await cleanup();
  }
});

test("хоёр хувилбар хоёулаа тэнцэхгүй бол нийтлэлийн өөрийн өгүүлбэрээр бичнэ", { skip }, async () => {
  const tag = `b${Date.now()}`;
  const { article, cleanup } = await fixture(tag);
  const { generateFbCopy } = await import("./fbcopy");

  try {
    const m = mockChat(
      [
        "OpenAI сургалтаа бүрэн зогсоолоо.",
        "OpenAI загвараа бүрмөсөн хаалаа.",
      ],
      [],
    );
    const r = await generateFbCopy(article.id, { chat: m.chat, rand: () => 0.1, dryRun: true });

    // Нөөц бие нь хураангуйгаас шууд авагдана
    assert.ok(r.text.includes("түр зогсоов"), r.text);
    assert.ok(!r.text.includes("бүрэн зогсоолоо"));
    assert.ok(!r.text.includes("бүрмөсөн хаалаа"));
    // Хоёр хувилбар тус бүр тэмдэглэгдэнэ
    assert.equal(r.problems.filter((p) => /хүлээж авсангүй/.test(p)).length, 2);
  } finally {
    await cleanup();
  }
});
