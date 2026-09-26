import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);

test("статистик: эхэлсэн/дууссан тоологдож, дуусгалт бодогдоно", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { prisma } = await import("../db");
  const { countStart, countFinish, quizStats } = await import("./queries");
  const { ubDateLabel } = await import("../jobs/day");

  const today = ubDateLabel(new Date());
  const before = await prisma.quizDaily.findUnique({ where: { day: today } });
  const code = `T${Date.now()}`.slice(0, 5);

  try {
    await countStart();
    await countStart();
    await countFinish(code, ["chatgpt", "claude", "gemini"]);

    const after = await prisma.quizDaily.findUniqueOrThrow({ where: { day: today } });
    assert.equal(after.starts, (before?.starts ?? 0) + 2);
    assert.equal(after.finishes, (before?.finishes ?? 0) + 1);

    const row = await prisma.quizResult.findFirstOrThrow({ where: { code } });
    assert.deepEqual(row.toolSlugs, ["chatgpt", "claude", "gemini"]);

    const stats = await quizStats(30);
    assert.ok(stats.starts >= 2);
    assert.ok(stats.finishes >= 1);
    assert.ok(stats.completion > 0 && stats.completion <= 100);
    // Зөвхөн #1 байрт орсныг тоолно
    assert.ok(stats.topTools.some((t) => t.slug === "chatgpt"), "эхний байрынх тоологдоно");
    assert.ok(!stats.topTools.some((t) => t.slug === "claude"), "2-р байрынх тоологдохгүй");

    // Байхгүй хэрэгсэл дээр ч унахгүй
    await assert.doesNotReject(() => countFinish(code, ["байхгүй-tool"]));
  } finally {
    await prisma.quizResult.deleteMany({ where: { code } });
    if (before) {
      await prisma.quizDaily.update({ where: { day: today }, data: before });
    } else {
      await prisma.quizDaily.deleteMany({ where: { day: today } });
    }
    await prisma.$disconnect();
  }
});

test("resultFor: код → 3 санал, заавар/prompt холбогдоно", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { prisma } = await import("../db");
  const { resultFor, scorableTools, bestScoreByVendor } = await import("./queries");
  const { decodeAnswers, encodeAnswers } = await import("./score.api");

  try {
    const code = encodeAnswers({
      tasks: ["bichih", "orchuulga"], who: "oyutan", budget: "unegui", mongolian: "ih", device: "utas",
    });
    const answers = decodeAnswers(code)!;
    const result = await resultFor(answers);

    assert.equal(result.length, 3, "гурван санал");
    assert.ok(result[0]!.rec.score.total >= result[1]!.rec.score.total, "оноогоор эрэмбэлэгдсэн");
    for (const r of result) {
      assert.ok(r.rec.tool.slug.length > 0);
      assert.ok(r.rec.reason.includes(r.rec.tool.name));
      // Заавар/prompt нь байвал л холбогдоно — байхгүй бол null
      if (r.guide) assert.ok(r.guide.slug.length > 0);
      if (r.prompt) assert.ok(r.prompt.slug.length > 0);
    }

    // Ижил код → ижил үр дүн (хуваалцахад чухал)
    const again = await resultFor(decodeAnswers(code)!);
    assert.deepEqual(
      again.map((r) => r.rec.tool.slug),
      result.map((r) => r.rec.tool.slug),
    );

    // Онооны өгөгдөл бүрдсэн эсэх
    const tools = await scorableTools();
    assert.ok(tools.length > 0);
    assert.ok(tools.every((t) => typeof t.clicks === "number"));
    // Бенчмаркийн зураглал — дүн байхгүй ч унахгүй
    assert.ok((await bestScoreByVendor()) instanceof Map);
  } finally {
    await prisma.$disconnect();
  }
});
