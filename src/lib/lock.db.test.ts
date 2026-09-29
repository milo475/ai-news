/**
 * Ажлын түгжээ — зэрэг ажиллахаас хамгаална.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);
const skip = !hasDb && "DATABASE_URL алга";

test("хоёр процесс зэрэг оролдоход зөвхөн НЭГ нь авна", { skip }, async () => {
  const { tryLock, lockHolder } = await import("./lock");
  const { prisma } = await import("../db");
  const name = `тест:зэрэг:${Date.now()}`;

  try {
    // Бодит нөхцөл: `npm run bench` ба cron зэрэг эхэлнэ
    const [a, b] = await Promise.all([tryLock(name), tryLock(name)]);
    const got = [a, b].filter(Boolean);
    assert.equal(got.length, 1, "хоёулаа түгжээ авсан байна");

    const holder = await lockHolder(name);
    assert.equal(holder?.lockedBy, got[0]!.owner);

    // Гурав дахь оролдлого ч чадахгүй
    assert.equal(await tryLock(name), null);

    await got[0]!.release();
    const after = await tryLock(name);
    assert.ok(after, "суллагдсаны дараа авагдах ёстой");
    await after!.release();
    assert.equal(await lockHolder(name), null, "суллахад мөр устана");
  } finally {
    await prisma.jobLock.deleteMany({ where: { name } });
    await prisma.$disconnect();
  }
});

test("цохилт нь хуучирсан түгжээг булаана (процесс унасан)", { skip }, async () => {
  const { tryLock, lockHolder, LOCK_TTL_MIN } = await import("./lock");
  const { prisma } = await import("../db");
  const name = `тест:хуучин:${Date.now()}`;

  try {
    const first = await tryLock(name);
    assert.ok(first);

    // Процесс унасан мэт — цохилт TTL-ээс хол хоцорлоо
    await prisma.jobLock.update({
      where: { name },
      data: { heartbeatAt: new Date(Date.now() - (LOCK_TTL_MIN + 5) * 60_000) },
    });

    const second = await tryLock(name);
    assert.ok(second, "хуучирсан түгжээ булаагдах ёстой");
    assert.notEqual(second!.owner, first!.owner);
    assert.equal((await lockHolder(name))?.lockedBy, second!.owner);

    // Хуучин эзэмшигч суллахад ШИНЭ эзэмшигчийн түгжээг хөндөхгүй
    await first!.release();
    assert.equal((await lockHolder(name))?.lockedBy, second!.owner, "булаагдсаныг устгасан байна");

    await second!.release();
  } finally {
    await prisma.jobLock.deleteMany({ where: { name } });
    await prisma.$disconnect();
  }
});

test("шинэхэн түгжээг булаахгүй", { skip }, async () => {
  const { tryLock, LOCK_TTL_MIN } = await import("./lock");
  const { prisma } = await import("../db");
  const name = `тест:шинэ:${Date.now()}`;

  try {
    const first = await tryLock(name);
    // TTL-ээс ДОТОР — булаагдах ёсгүй
    await prisma.jobLock.update({
      where: { name },
      data: { heartbeatAt: new Date(Date.now() - (LOCK_TTL_MIN - 5) * 60_000) },
    });
    assert.equal(await tryLock(name), null);
    await first!.release();
  } finally {
    await prisma.jobLock.deleteMany({ where: { name } });
    await prisma.$disconnect();
  }
});

test("хэсэг дуусмагц дараагийн процесс ШУУД авна", { skip }, async () => {
  const { tryLock } = await import("./lock");
  const { prisma } = await import("../db");
  const name = `тест:суллах:${Date.now()}`;

  try {
    // 00:00-ийн хэсэг
    const first = await tryLock(name);
    assert.ok(first);
    // 00:20-д дуусаад суллана
    await first!.release();

    // 00:30-ын cron — TTL (25 мин) хараахан болоогүй ч ШУУД авах ёстой
    const second = await tryLock(name);
    assert.ok(second, "суллагдсан түгжээг дараагийн процесс шууд авах ёстой");
    await second!.release();
  } finally {
    await prisma.jobLock.deleteMany({ where: { name } });
    await prisma.$disconnect();
  }
});

test("булаагдсаныг цохилт мэдэрнэ — хуучин процесс зогсоно", { skip }, async () => {
  const { tryLock, LOCK_TTL_MIN } = await import("./lock");
  const { prisma } = await import("../db");
  const name = `тест:булаах:${Date.now()}`;

  try {
    // Цохилтыг хурдан болгоно (тестэд 30мс)
    const first = await tryLock(name, LOCK_TTL_MIN, 30);
    assert.ok(first);
    assert.equal(first!.lost(), false);

    // TTL хуучраад өөр процесс булаана
    await prisma.jobLock.update({
      where: { name },
      data: { heartbeatAt: new Date(Date.now() - (LOCK_TTL_MIN + 5) * 60_000) },
    });
    const thief = await tryLock(name);
    assert.ok(thief, "хуучирсан түгжээ булаагдах ёстой");

    // Хуучин процессын цохилт 0 мөр шинэчилнэ → алдагдсаныг мэдэрнэ
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(first!.lost(), true, "булаагдсаныг мэдрээгүй байна");

    // Хуучин эзэмшигч суллахад ШИНЭ эзэмшигчийнхийг хөндөхгүй
    await first!.release();
    const holder = await prisma.jobLock.findUnique({ where: { name } });
    assert.equal(holder?.lockedBy, thief!.owner);
    await thief!.release();
  } finally {
    await prisma.jobLock.deleteMany({ where: { name } });
    await prisma.$disconnect();
  }
});

test("суллалт, цохилт нь throw хийхгүй", { skip }, async () => {
  const { tryLock } = await import("./lock");
  const { prisma } = await import("../db");
  const name = `тест:алдаа:${Date.now()}`;

  try {
    const lock = await tryLock(name);
    assert.ok(lock);
    // Мөрийг гараар устгана — суллалт «олдсонгүй» болно
    await prisma.jobLock.deleteMany({ where: { name } });
    await assert.doesNotReject(() => lock!.release());
    // Давхар суллалт ч унахгүй
    await assert.doesNotReject(() => lock!.release());
  } finally {
    await prisma.jobLock.deleteMany({ where: { name } });
    await prisma.$disconnect();
  }
});
