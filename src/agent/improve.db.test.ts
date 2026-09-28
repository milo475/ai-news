/**
 * improve алхам гарчгийг өөрчлөх бүрд fidelity шүүгч ажилладаг эсэх.
 *
 * 2026-09-27: эх мэдээ «OpenAI ТҮР зогсоов» байтал improve нь «…зогсоолоо» болгож,
 * slug хүртэл «-tur-» -гүйгээр үүссэн. Шүүгч хүлээж аваагүй бол ХУУЧИН гарчиг үлдэнэ.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);
const skip = !hasDb && "DATABASE_URL алга";

const TITLE = "OpenAI шинэ загварынхаа сургалтыг түр зогсоов";
const BODY =
  "OpenAI шинэ загварынхаа сургалтыг түр зогсоов. Компани аюулгүй байдлын шалгалт дуусмагц " +
  "хэдэн долоо хоногийн дараа үргэлжлүүлнэ. Энэ нь салбарын хэвийн практик юм. Загварын " +
  "чадвар, хурдны үзүүлэлт өмнөх хувилбартай ойролцоо гэсэн тоо гарсан байна.";

/** Хураангуйд ишлэлийн үйл үг ОРУУЛАХГҮЙ — энэ тест зөвхөн hedge дүрмийг шалгана */
const SUMMARY = "OpenAI шинэ загварынхаа сургалтыг түр зогсоов. Шалгалт дуусмагц үргэлжлүүлнэ.";

async function fixture(tag: string) {
  const { prisma } = await import("../db");
  const source = await prisma.source.upsert({
    where: { url: `https://imp-${tag}.example.mn` },
    update: {},
    create: { name: `Тест ${tag}`, url: `https://imp-${tag}.example.mn`, isActive: false },
  });
  const article = await prisma.article.create({
    data: {
      slug: `imp-${tag}`, sourceId: source.id, sourceUrl: `https://imp-${tag}.example.mn/1`,
      sourceTitle: "OpenAI pauses training", sourceHash: `${tag}-1`, status: "DRAFT",
      category: "NEWS", titleMn: TITLE, summaryMn: SUMMARY, bodyMn: BODY,
    },
  });
  const cleanup = async () => {
    await prisma.article.deleteMany({ where: { sourceId: source.id } });
    await prisma.source.deleteMany({ where: { id: source.id } });
  };
  return { prisma, article, cleanup };
}

/** Заасан гарчгийг буцаах improve, дараа нь шүүгчийн хариу өгөх мок */
function mockChat(newTitle: string, verdict?: { faithful: boolean; issues: string[] } | "throw") {
  let call = 0;
  return (async () => {
    call += 1;
    if (call === 1) {
      return {
        data: {
          titleMn: newTitle, summaryMn: SUMMARY, bodyMn: BODY,
          changed: ["гарчиг богиносгов"],
        },
        tokens: 100, costUsd: 0.0001,
      };
    }
    if (verdict === "throw") throw new Error("шүүгч унав");
    return { data: verdict ?? { faithful: true, issues: [] }, tokens: 50, costUsd: 0.00005 };
  }) as never;
}

test("«түр»-ийг хассан гарчгийг механик шалгалт барина", { skip }, async () => {
  const tag = `h${Date.now()}`;
  const { prisma, article, cleanup } = await fixture(tag);
  const { improveText } = await import("./improve");

  try {
    // Шүүгч рүү хүрэхгүй — dropsHedge нь LLM-гүйгээр барина
    const r = await improveText(article.id, { chat: mockChat("OpenAI сургалтыг зогсоолоо") });
    const after = await prisma.article.findUniqueOrThrow({ where: { id: article.id } });

    assert.equal(after.titleMn, TITLE, "хуучин гарчиг үлдэх ёстой");
    assert.ok(after.improvedAt, "дахин оролдохгүйн тулд improvedAt тавигдана");
    // Биет, хураангуйн засвар нь хэвээр хэрэгжинэ
    assert.equal(after.bodyMn, BODY);
    assert.ok(!r.changed.some((c) => /гарчиг/iu.test(c)), "гарчиг өөрчлөгдсөн гэж мэдээлэхгүй");
  } finally {
    await cleanup();
  }
});

test("шүүгч унавал гарчгийг хүлээж авахгүй (fail-closed)", { skip }, async () => {
  const tag = `f${Date.now()}`;
  const { prisma, article, cleanup } = await fixture(tag);
  const { improveText } = await import("./improve");

  try {
    // Механик шалгалтад баригдахгүй боловч шүүгч унасан гарчиг
    await improveText(article.id, {
      chat: mockChat("OpenAI загварынхаа сургалтад завсарлага авав", "throw"),
    });
    const after = await prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.titleMn, TITLE, "шалгагдаагүй гарчиг хүлээн авагдах ёсгүй");
  } finally {
    await cleanup();
  }
});

test("шүүгч зөвшөөрвөл шинэ гарчиг хэрэгжинэ", { skip }, async () => {
  const tag = `o${Date.now()}`;
  const { prisma, article, cleanup } = await fixture(tag);
  const { improveText } = await import("./improve");
  const better = "OpenAI шинэ загварын сургалтаа түр зогсоолоо";

  try {
    await improveText(article.id, { chat: mockChat(better, { faithful: true, issues: [] }) });
    const after = await prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    assert.equal(after.titleMn, better);
  } finally {
    await cleanup();
  }
});
