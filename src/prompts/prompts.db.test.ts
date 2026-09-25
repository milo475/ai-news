import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);

async function fixture(tag: string) {
  const { prisma } = await import("../db");
  const user = await prisma.user.create({
    data: { email: `prompt-${tag}@example.mn`, name: "Нэмэгч", emailVerifiedAt: new Date() },
  });
  const prompt = await prisma.prompt.create({
    data: {
      slug: `test-${tag}`, title: "Тест prompt",
      body: "Чи {компанийн нэр}-ийн туслах. {сарын орлого} төгрөгийн тайлан бич.",
      description: "Тестийн зорилгоор", category: "AJIL", tools: ["ChatGPT"],
      variables: ["компанийн нэр", "сарын орлого"], source: "SITE",
      status: "PUBLISHED", publishedAt: new Date(),
    },
  });
  const cleanup = async () => {
    await prisma.prompt.deleteMany({ where: { slug: { startsWith: `test-${tag}` } } });
    await prisma.user.deleteMany({ where: { email: `prompt-${tag}@example.mn` } });
  };
  return { prisma, user, prompt, cleanup };
}

test("copy counter нэмэгдэнэ, байхгүй prompt дээр унахгүй", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `c${Date.now()}`;
  const { prisma, prompt, cleanup } = await fixture(tag);
  const { countCopy } = await import("./mutations");

  try {
    assert.equal(prompt.copies, 0);
    await countCopy(prompt.id);
    await countCopy(prompt.id);
    assert.equal((await prisma.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).copies, 2);

    await assert.doesNotReject(() => countCopy("байхгүй-id"), "тоолуур хуулалтыг зогсоохгүй");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("like toggle идемпотент, likes тоолуур бодит тоог тусгана", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `l${Date.now()}`;
  const { prisma, user, prompt, cleanup } = await fixture(tag);
  const { toggleLike } = await import("./mutations");
  const { likedPromptIds } = await import("./queries");

  const other = await prisma.user.create({ data: { email: `other-${tag}@example.mn` } });

  try {
    assert.equal(await toggleLike(user.id, prompt.id), true);
    assert.equal((await prisma.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).likes, 1);
    assert.deepEqual([...(await likedPromptIds(user.id, [prompt.id]))], [prompt.id]);

    // Хасах
    assert.equal(await toggleLike(user.id, prompt.id), false);
    assert.equal((await prisma.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).likes, 0);
    assert.equal((await likedPromptIds(user.id, [prompt.id])).size, 0);

    // Хоёр хэрэглэгч
    await toggleLike(user.id, prompt.id);
    await toggleLike(other.id, prompt.id);
    assert.equal((await prisma.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).likes, 2);

    // Хоёр таб зэрэг дарахад давхар мөр ч үүсэхгүй, тоолуур ч алдагдахгүй
    await assert.doesNotReject(() =>
      Promise.all([toggleLike(other.id, prompt.id), toggleLike(other.id, prompt.id)]),
    );
    const after = await prisma.prompt.findUniqueOrThrow({ where: { id: prompt.id } });
    assert.equal(after.likes, await prisma.promptLike.count({ where: { promptId: prompt.id } }));
    assert.ok(after.likes >= 1 && after.likes <= 2);

    // Prompt устахад like нь cascade-аар устана
    await prisma.prompt.delete({ where: { id: prompt.id } });
    assert.equal(await prisma.promptLike.count({ where: { promptId: prompt.id } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { email: `other-${tag}@example.mn` } });
    await cleanup();
    await prisma.$disconnect();
  }
});

test("өдрийн илгээх хязгаар DB-ээр тоологдоно", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `r${Date.now()}`;
  const { prisma, user, cleanup } = await fixture(tag);
  const { canSubmit, submittedToday, createUserPrompt } = await import("./mutations");
  const { DAILY_SUBMIT_LIMIT } = await import("./prompt.api");

  try {
    assert.equal(await submittedToday(user.id), 0);
    assert.equal(await canSubmit(user.id), true);

    for (let i = 0; i < DAILY_SUBMIT_LIMIT; i++) {
      await createUserPrompt(
        {
          title: `Тест ${tag} ${i}`, body: "Чи {нэр}-ийн туслах, тайлан бич.".repeat(2),
          description: "Тест", category: "AJIL", tools: [], authorUserId: user.id,
        },
        { status: "PENDING", rejectReason: null },
      );
    }
    assert.equal(await submittedToday(user.id), DAILY_SUBMIT_LIMIT);
    assert.equal(await canSubmit(user.id), false, "хязгаар дүүрлээ");

    // Өчигдөр илгээсэн нь өнөөдрийн квотыг идэхгүй
    await prisma.prompt.updateMany({
      where: { authorUserId: user.id },
      data: { createdAt: new Date(Date.now() - 3 * 86_400_000) },
    });
    assert.equal(await submittedToday(user.id), 0);
    assert.equal(await canSubmit(user.id), true);
  } finally {
    await prisma.prompt.deleteMany({ where: { authorUserId: user.id } });
    await cleanup();
    await prisma.$disconnect();
  }
});

test("createUserPrompt: хувьсагч автоматаар задарна, slug давхардахгүй", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `s${Date.now()}`;
  const { prisma, user, cleanup } = await fixture(tag);
  const { createUserPrompt } = await import("./mutations");

  try {
    const input = {
      title: `Санхүүгийн тайлан ${tag}`,
      body: "Чи {компанийн нэр}-ийн санхүүч. {улирал}-ын тайлан бич.",
      description: "Тест", category: "AJIL" as const, tools: ["ChatGPT"], authorUserId: user.id,
    };
    const a = await createUserPrompt(input, { status: "PENDING", rejectReason: null, language: "MN" });
    const row = await prisma.prompt.findUniqueOrThrow({ where: { id: a.id } });
    assert.deepEqual(row.variables, ["компанийн нэр", "улирал"]);
    assert.equal(row.status, "PENDING");
    assert.equal(row.source, "USER");
    assert.equal(row.authorUserId, user.id);

    // Ижил гарчигтай хоёр дахь нь -2 авна
    const b = await createUserPrompt(input, { status: "PENDING", rejectReason: null });
    assert.notEqual(a.slug, b.slug);
    assert.ok(b.slug.endsWith("-2"), b.slug);

    // Татгалзсан нь шалтгаантайгаа хадгалагдана
    const c = await createUserPrompt(
      { ...input, title: `Муу ${tag}` },
      { status: "REJECTED", rejectReason: "Зар сурталчилгаа — тест" },
    );
    const rejected = await prisma.prompt.findUniqueOrThrow({ where: { id: c.id } });
    assert.equal(rejected.status, "REJECTED");
    assert.match(rejected.rejectReason!, /Зар сурталчилгаа/);

    // Зохиогч устахад prompt нь үлдэнэ (SetNull), нийтлэгдсэн контент алдагдахгүй
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal((await prisma.prompt.findUniqueOrThrow({ where: { id: a.id } })).authorUserId, null);
  } finally {
    await prisma.prompt.deleteMany({ where: { slug: { contains: tag } } });
    await cleanup();
    await prisma.$disconnect();
  }
});

test("bookmark: prompt-ыг хадгална, CHECK нь 3 баганаас нэгийг шаардана", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `b${Date.now()}`;
  const { prisma, user, prompt, cleanup } = await fixture(tag);
  const { toggleBookmarkFor, isBookmarked, listPromptBookmarks, bookmarkedPromptIds, listBookmarks } =
    await import("../bookmarks/queries");

  const guide = await prisma.guide.create({
    data: { slug: `test-g-${tag}`, title: "Заавар", lead: "Тест", bodyMd: "## Алхам\nтекст", status: "PUBLISHED" },
  });

  try {
    assert.equal(await toggleBookmarkFor(user.id, { promptId: prompt.id }), true);
    assert.equal(await isBookmarked(user.id, { promptId: prompt.id }), true);
    assert.deepEqual((await listPromptBookmarks(user.id)).map((p) => p.slug), [`test-${tag}`]);
    assert.deepEqual([...(await bookmarkedPromptIds(user.id, [prompt.id]))], [prompt.id]);
    assert.deepEqual(await listBookmarks(user.id), [], "prompt нь нийтлэлийн жагсаалтад орохгүй");

    // Идемпотент
    assert.equal(await toggleBookmarkFor(user.id, { promptId: prompt.id }), false);
    assert.equal(await toggleBookmarkFor(user.id, { promptId: prompt.id }), true);
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 1);

    // CHECK: хоосон bookmark үүсэхгүй
    await assert.rejects(
      () => prisma.bookmark.create({ data: { userId: user.id } }),
      /check|constraint/i,
      "зорилгогүй bookmark",
    );
    // CHECK: хоёр зорилго зэрэг байж болохгүй
    await assert.rejects(
      () => prisma.bookmark.create({ data: { userId: user.id, promptId: prompt.id, guideId: guide.id } }),
      /check|constraint/i,
      "давхар зорилготой bookmark",
    );

    // Prompt устахад bookmark cascade
    await prisma.prompt.delete({ where: { id: prompt.id } });
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 0);
  } finally {
    await prisma.guide.deleteMany({ where: { slug: `test-g-${tag}` } });
    await cleanup();
    await prisma.$disconnect();
  }
});

test("moderatePrompt: LLM mock-оор REJECTED / PENDING", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { moderatePrompt } = await import("./moderate");

  const chat = (data: unknown) =>
    (async () => ({ data, tokens: 0, costUsd: 0 })) as never;

  const spam = await moderatePrompt(
    { title: "Хямдхан зээл", description: "", body: "Утас 9999 залгаарай. Хямдхан зээл." },
    { chat: chat({ ok: false, reason: "spam", explanation: "Зар байна.", category: "BUSAD", language: "MN" }) },
  );
  assert.equal(spam.status, "REJECTED");
  assert.match(spam.rejectReason!, /Зар сурталчилгаа/);

  const fine = await moderatePrompt(
    { title: "Тайлан", description: "", body: "Чи санхүүч. Тайлан бич." },
    { chat: chat({ ok: true, reason: "ok", explanation: "Зүгээр.", category: "AJIL", language: "MN" }) },
  );
  assert.equal(fine.status, "PENDING");
  assert.equal(fine.rejectReason, null);
  assert.equal(fine.category, "AJIL");

  // LLM унавал хэрэглэгчийг шийтгэхгүй — админд үлдээнэ
  const broken = await moderatePrompt(
    { title: "Тайлан", description: "", body: "Чи санхүүч." },
    { chat: (async () => { throw new Error("кредит дууссан"); }) as never },
  );
  assert.equal(broken.status, "PENDING");
  assert.equal(broken.rejectReason, null);
});

test("promptOfTheDay: нийтлэгдсэн prompt буцаана", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `d${Date.now()}`;
  const { prisma, prompt, cleanup } = await fixture(tag);
  const { promptOfTheDay } = await import("./queries");

  try {
    const picked = await promptOfTheDay(50);
    assert.ok(picked, "нийтлэгдсэн prompt байвал нэгийг буцаана");
    const row = await prisma.prompt.findUniqueOrThrow({ where: { id: picked!.id } });
    assert.equal(row.status, "PUBLISHED");

    // Ноорог нь сонгогдохгүй
    await prisma.prompt.update({ where: { id: prompt.id }, data: { status: "PENDING" } });
    const after = await promptOfTheDay(50);
    assert.notEqual(after?.id, prompt.id);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
