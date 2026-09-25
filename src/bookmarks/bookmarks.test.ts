import { test } from "node:test";
import assert from "node:assert/strict";

/** DB шаарддаг тестүүд — DATABASE_URL байхгүй бол алгасна (CI дээр сүлжээгүй) */
const hasDb = Boolean(process.env.DATABASE_URL);

/** Тестийн эх сурвалж + 2 нийтлэл + 1 хэрэглэгч үүсгэнэ */
async function fixture(tag: string) {
  const { prisma } = await import("../db");
  const source = await prisma.source.upsert({
    where: { url: `https://test-${tag}.example.mn` },
    update: {},
    create: {
      name: `Тест ${tag}`, url: `https://test-${tag}.example.mn`,
      feedUrl: `https://test-${tag}.example.mn/rss`, isActive: false,
    },
  });
  const make = (n: number, category: "NEWS" | "RISK") =>
    prisma.article.create({
      data: {
        slug: `test-${tag}-${n}`, sourceId: source.id, sourceUrl: `https://test-${tag}.example.mn/${n}`,
        sourceTitle: `Test ${n}`, sourceHash: `${tag}-${n}`, status: "PUBLISHED", category,
        titleMn: `Тест нийтлэл ${n}`, summaryMn: "Хураангуй", publishedAt: new Date(),
      },
    });
  const [a1, a2] = await Promise.all([make(1, "NEWS"), make(2, "RISK")]);
  const user = await prisma.user.create({ data: { email: `bm-${tag}@example.mn`, name: "Хадгалагч" } });

  const cleanup = async () => {
    await prisma.user.deleteMany({ where: { email: `bm-${tag}@example.mn` } });
    await prisma.article.deleteMany({ where: { sourceId: source.id } });
    await prisma.source.deleteMany({ where: { id: source.id } });
  };
  return { prisma, user, a1: a1!, a2: a2!, cleanup };
}

test("bookmark toggle идемпотент, unique зөрчил дээр унахгүй", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `t${Date.now()}`;
  const { prisma, user, a1, a2, cleanup } = await fixture(tag);
  const { toggleBookmarkFor, isBookmarked, isUniqueViolation, listBookmarks, bookmarkCategories, bookmarkedIds } =
    await import("./queries");

  try {
    assert.equal(await isBookmarked(user.id, { articleId: a1.id }), false);

    // Хадгалах → хасах → хадгалах
    assert.equal(await toggleBookmarkFor(user.id, { articleId: a1.id }), true);
    assert.equal(await isBookmarked(user.id, { articleId: a1.id }), true);
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 1);

    assert.equal(await toggleBookmarkFor(user.id, { articleId: a1.id }), false);
    assert.equal(await isBookmarked(user.id, { articleId: a1.id }), false);

    assert.equal(await toggleBookmarkFor(user.id, { articleId: a1.id }), true);

    // Unique зөрчил: DB давхар мөр үүсгэхийг хориглоно, toggle нь уг алдааг таньж залгина
    await assert.rejects(
      () => prisma.bookmark.create({ data: { userId: user.id, articleId: a1.id } }),
      (e: unknown) => isUniqueViolation(e),
      "давхар мөр үүсэхгүй",
    );
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id, articleId: a1.id } }), 1);
    assert.equal(isUniqueViolation(new Error("сүлжээний алдаа")), false, "өөр алдааг залгихгүй");

    // Хоёр таб зэрэг хасахад deleteMany тул «олдсонгүй» алдаа гарахгүй
    assert.equal(await toggleBookmarkFor(user.id, { articleId: a2.id }), true);
    await assert.doesNotReject(() =>
      Promise.all([toggleBookmarkFor(user.id, { articleId: a2.id }), toggleBookmarkFor(user.id, { articleId: a2.id })]),
    );

    // Жагсаалт + ангиллын тоо
    await prisma.bookmark.deleteMany({ where: { userId: user.id, articleId: a2.id } });
    assert.equal(await toggleBookmarkFor(user.id, { articleId: a2.id }), true);
    const list = await listBookmarks(user.id);
    assert.equal(list.length, 2);
    assert.equal(list[0]!.id, a2.id, "сүүлд хадгалсан нь эхэнд");

    const risk = await listBookmarks(user.id, "RISK");
    assert.deepEqual(risk.map((r) => r.id), [a2.id], "ангиллаар шүүгдэнэ");

    const groups = await bookmarkCategories(user.id);
    assert.deepEqual(
      [...groups].sort((x, y) => x.category.localeCompare(y.category)),
      [{ category: "NEWS", count: 1 }, { category: "RISK", count: 1 }],
    );

    const ids = await bookmarkedIds(user.id, [a1.id, a2.id, "байхгүй"]);
    assert.deepEqual([...ids].sort(), [a1.id, a2.id].sort());
    assert.equal((await bookmarkedIds(user.id, [])).size, 0);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("сонирхол хадгалагдана, дахин хадгалахад дарж бичнэ", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `p${Date.now()}`;
  const { prisma, user, cleanup } = await fixture(tag);
  const { getPreference, newsForInterests, DEFAULT_PREFERENCE } = await import("./preferences");

  try {
    assert.deepEqual(await getPreference(user.id), DEFAULT_PREFERENCE, "тохируулаагүй бол анхдагч");

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, categories: ["NEWS", "RISK"], usecases: ["zurag"], digestEmail: false },
      update: {},
    });
    let pref = await getPreference(user.id);
    assert.deepEqual(pref.categories, ["NEWS", "RISK"]);
    assert.deepEqual(pref.usecases, ["zurag"]);
    assert.equal(pref.digestEmail, false);

    // Дахин хадгалахад хуучин утга дарагдана (нэмэгдэхгүй)
    await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, categories: [], usecases: [], digestEmail: true },
      update: { categories: ["FACT"], usecases: [], digestEmail: true },
    });
    pref = await getPreference(user.id);
    assert.deepEqual(pref.categories, ["FACT"]);
    assert.deepEqual(pref.usecases, []);
    assert.equal(pref.digestEmail, true);

    // Сонирхлын мэдээ — сонгосон ангиллаас л ирнэ
    assert.deepEqual(await newsForInterests([], 4), [], "ангилал сонгоогүй бол хоосон");
    const risk = await newsForInterests(["RISK"], 4);
    assert.ok(risk.length > 0, "RISK ангилалд мэдээ олдоно");
    assert.ok(risk.some((n) => n.slug === `test-${tag}-2`), "тестийн RISK нийтлэл орсон");
    assert.equal((await newsForInterests(["RISK"], 1)).length, 1, "limit баримталагдана");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("бүртгэл устгахад bookmark, preference cascade-аар устана", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `c${Date.now()}`;
  const { prisma, user, a1, cleanup } = await fixture(tag);
  const { toggleBookmarkFor } = await import("./queries");

  try {
    await toggleBookmarkFor(user.id, { articleId: a1.id });
    await prisma.userPreference.create({ data: { userId: user.id, categories: ["NEWS"] } });
    await prisma.subscriber.create({
      data: { email: user.email, userId: user.id, status: "ACTIVE", unsubscribeToken: `u-${tag}` },
    });

    await prisma.subscriber.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 0, "bookmark устсан");
    assert.equal(await prisma.userPreference.count({ where: { userId: user.id } }), 0, "preference устсан");
    assert.equal(await prisma.subscriber.count({ where: { email: user.email } }), 0, "имэйлийн бүртгэл устсан");

    // Нийтлэл өөрөө үлдэнэ
    assert.ok(await prisma.article.findUnique({ where: { id: a1.id } }), "нийтлэл хэвээр");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("долоо хоногийн имэйл Subscriber-тэй синк болно", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `d${Date.now()}`;
  const { prisma, user, cleanup } = await fixture(tag);
  const { syncDigestEmail } = await import("./digest-sync");

  try {
    // Асаах — бүртгэл байхгүй бол шууд ACTIVE-аар үүснэ
    await syncDigestEmail(user.id, user.email, true);
    const created = await prisma.subscriber.findUniqueOrThrow({ where: { email: user.email } });
    assert.equal(created.status, "ACTIVE");
    assert.equal(created.userId, user.id);
    assert.ok(created.confirmedAt, "профайлаас асаасан тул баталгаажсан");
    assert.ok(created.unsubscribeToken, "гарах токентой");

    // Унтраах — устгахгүй, түүхийг үлдээнэ
    await syncDigestEmail(user.id, user.email, false);
    const off = await prisma.subscriber.findUniqueOrThrow({ where: { email: user.email } });
    assert.equal(off.status, "UNSUBSCRIBED");
    assert.equal(off.id, created.id, "мөр устгагдаагүй");

    // Дахин асаах — анхны баталгаажсан огноо хэвээр
    await syncDigestEmail(user.id, user.email, true);
    const back = await prisma.subscriber.findUniqueOrThrow({ where: { email: user.email } });
    assert.equal(back.status, "ACTIVE");
    assert.deepEqual(back.confirmedAt, created.confirmedAt, "анхны баталгаажилт хадгалагдана");

    // Нэвтрээгүй үед захиалсан хаягийг бүртгэлтэй холбоно
    await prisma.subscriber.update({ where: { email: user.email }, data: { userId: null, status: "PENDING" } });
    await syncDigestEmail(user.id, user.email, true);
    const linked = await prisma.subscriber.findUniqueOrThrow({ where: { email: user.email } });
    assert.equal(linked.userId, user.id);
    assert.equal(linked.status, "ACTIVE");

    // Бүртгэлгүй хаягийг унтраахад юу ч үүсгэхгүй
    await syncDigestEmail(user.id, `yok-${tag}@example.mn`, false);
    assert.equal(await prisma.subscriber.count({ where: { email: `yok-${tag}@example.mn` } }), 0);
  } finally {
    await prisma.subscriber.deleteMany({ where: { email: user.email } });
    await cleanup();
    await prisma.$disconnect();
  }
});
