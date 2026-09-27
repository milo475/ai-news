/**
 * Студийн DB давхарга — квотын тоолол, session-ийн замнал.
 * Production DB-д бүү ажиллуул: тест өөрийн бичсэнээ л устгадаг.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);
const skip = !hasDb && "DATABASE_URL алга";

async function mod() {
  return import("./db");
}

test("квот нь subject бүрээр тоологдож, хамгийн их тоогоор хязгаарлана", { skip }, async () => {
  const { prisma } = await import("../db");
  const { bumpCount, usedToday, addSpend, spentToday, today } = await mod();
  const tag = `t${Date.now()}`;
  const anonA = `${tag}-a`;
  const anonB = `${tag}-b`;
  const ip = `${tag}-ip`;

  try {
    // Ижил IP-ээс хоёр өөр хөтөч — cookie цэвэрлэж хязгаар тойрох гэж оролдсон нь
    await bumpCount({ anonId: anonA, ip });
    await bumpCount({ anonId: anonB, ip });

    assert.equal(await usedToday({ anonId: anonA, ip }), 2, "IP-ийн тоо 2 болсон");
    assert.equal(await usedToday({ anonId: anonB, ip }), 2);
    // Өөр IP-д хамааралгүй
    assert.equal(await usedToday({ anonId: `${tag}-c`, ip: `${tag}-ip2` }), 0);

    const before = await spentToday();
    await addSpend({ anonId: anonA, ip, costUsd: 0.0123 });
    // ip: мөрөөр тоолдог тул нэг л удаа нэмэгдэнэ
    assert.ok(Math.abs((await spentToday()) - before - 0.0123) < 1e-6);

    // Зардал тэг бол бичихгүй
    const rows = await prisma.studioUsage.count({ where: { day: today(), subject: `ip:${ip}` } });
    assert.equal(rows, 1);
  } finally {
    await prisma.studioUsage.deleteMany({ where: { subject: { contains: tag } } });
  }
});

test("session — үүсгэх, бөглөх, үнэлэх, «миний промптууд»-д гарах", { skip }, async () => {
  const { prisma } = await import("../db");
  const { createSession, patchSession, setFeedback, mySessions, asJson, getSession } = await mod();
  const tag = `s${Date.now()}`;
  const user = await prisma.user.create({
    data: { email: `studio-${tag}@example.mn`, name: "Студи", emailVerifiedAt: new Date() },
  });

  try {
    const id = await createSession({
      userId: user.id, anonId: `${tag}-anon`, request: "гутлын зар зураг",
      format: "IMAGE", tools: ["gemini", "canva"], placement: "fb-post",
    });

    // Гаргалт бичээгүй бол «миний промптууд»-д гарахгүй — хагас ажил харуулахгүй
    assert.equal((await mySessions(user.id)).length, 0);

    await patchSession(id, {
      brief: asJson({ goal: "зар" }),
      outputs: asJson({ tools: [{ tool: "gemini", prompt: "a shoe" }] }),
      costUsd: 0.0042,
    });

    const rows = await mySessions(user.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.request, "гутлын зар зураг");
    assert.deepEqual(rows[0]!.tools, ["gemini", "canva"]);

    await setFeedback(id, true);
    assert.equal((await getSession(id))!.feedback, true);
    assert.equal(Number((await getSession(id))!.costUsd), 0.0042);
  } finally {
    await prisma.studioSession.deleteMany({ where: { anonId: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { email: `studio-${tag}@example.mn` } });
  }
});

test("татгалзсан хүсэлт бүртгэгдэж, статистикт тоологдоно", { skip }, async () => {
  const { prisma } = await import("../db");
  const { recordRejected } = await mod();
  const { studioStats } = await import("./stats");
  const tag = `r${Date.now()}`;

  try {
    const before = (await studioStats()).rejected;
    await recordRejected({
      anonId: `${tag}-anon`, request: "нэрлэсэн хүний deepfake", format: "VIDEO", reason: "deepfake",
    });
    assert.equal((await studioStats()).rejected, before + 1);
  } finally {
    await prisma.studioSession.deleteMany({ where: { anonId: { startsWith: tag } } });
  }
});
