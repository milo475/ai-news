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
