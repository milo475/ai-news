import { test } from "node:test";
import assert from "node:assert/strict";

/** DB шаарддаг тестүүд — DATABASE_URL байхгүй бол алгасна (CI дээр сүлжээгүй) */
const hasDb = Boolean(process.env.DATABASE_URL);

test("бүртгэл → баталгаажуулалт → нэвтрэх урсгал", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { prisma } = await import("../db");
  const { createUser, markVerified, setPassword, linkSubscriber } = await import("./users");
  const { createToken, useToken } = await import("./tokens");
  const { verifyPassword } = await import("./password");

  const email = `test-${Date.now()}@example.mn`;
  const cleanup = async () => {
    await prisma.verificationToken.deleteMany({ where: { identifier: { contains: email } } });
    await prisma.subscriber.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
  };
  await cleanup();

  try {
    // 1. Бүртгэл
    const user = await createUser({ email, name: "Тест", password: "saihan-nuuts-ug" });
    assert.ok(user, "хэрэглэгч үүснэ");
    assert.equal(user!.email, email);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(fresh.emailVerifiedAt, null, "эхэндээ баталгаажаагүй");
    assert.ok(fresh.passwordHash, "нууц үг hash-лагдсан");
    assert.notEqual(fresh.passwordHash, "saihan-nuuts-ug");

    // Ижил имэйлээр дахин бүртгүүлэх боломжгүй
    assert.equal(await createUser({ email, name: "Хоёр", password: "ondoo-nuuts-ug" }), null);

    // 2. Баталгаажуулах токен — нэг удаа хэрэглэгдэнэ
    const token = await createToken("verify", email);
    assert.equal(await useToken("reset", token), null, "өөр зорилгоор ашиглагдахгүй");

    const token2 = await createToken("verify", email);
    assert.equal(await useToken("verify", token2), email);
    assert.equal(await useToken("verify", token2), null, "дахин ашиглагдахгүй");

    assert.equal(await markVerified(email), true);
    const verified = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.ok(verified.emailVerifiedAt, "баталгаажсан");
    assert.equal(await markVerified(email), false, "хоёр дахь удаа өөрчлөхгүй");

    // 3. Нэвтрэх — нууц үг таарна
    assert.equal(await verifyPassword("saihan-nuuts-ug", verified.passwordHash), true);
    assert.equal(await verifyPassword("buruu-nuuts-ug", verified.passwordHash), false);

    // 4. Нууц үг сэргээх
    const resetToken = await createToken("reset", email);
    assert.equal(await useToken("reset", resetToken), email);
    await setPassword(email, "shine-nuuts-ug");
    const changed = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(await verifyPassword("shine-nuuts-ug", changed.passwordHash), true);
    assert.equal(await verifyPassword("saihan-nuuts-ug", changed.passwordHash), false);

    // 5. Subscriber холболт — ижил имэйлтэй бүртгэл байвал userId тавина
    const sub = await prisma.subscriber.create({
      data: { email, status: "ACTIVE", unsubscribeToken: `t-${Date.now()}` },
    });
    assert.equal(sub.userId, null);
    assert.equal(await linkSubscriber(changed.id, email), true);
    const linked = await prisma.subscriber.findUniqueOrThrow({ where: { id: sub.id } });
    assert.equal(linked.userId, changed.id);

    // Аль хэдийн холбогдсоныг дахин хөндөхгүй
    assert.equal(await linkSubscriber("өөр-id", email), false);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("хугацаа дууссан токен хүчингүй", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { prisma } = await import("../db");
  const { useToken } = await import("./tokens");

  const email = `expired-${Date.now()}@example.mn`;
  const token = `expired-token-${Date.now()}`;
  await prisma.verificationToken.create({
    data: { identifier: `verify:${email}`, token, expires: new Date(Date.now() - 1000) },
  });

  try {
    assert.equal(await useToken("verify", token), null, "хугацаа дууссан");
    const left = await prisma.verificationToken.findUnique({ where: { token } });
    assert.equal(left, null, "хугацаа дууссан токен устгагдана");
  } finally {
    await prisma.verificationToken.deleteMany({ where: { token } });
    await prisma.$disconnect();
  }
});
