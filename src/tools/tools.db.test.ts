import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);

async function fixture(tag: string) {
  const { prisma } = await import("../db");
  const mk = (
    n: number,
    over: Partial<{
      categories: ("CHAT" | "CODE" | "ZURAG")[];
      pricing: "FREE" | "FREEMIUM" | "PAID" | "TRIAL";
      mongolianSupport: "GOOD" | "PARTIAL" | "NONE";
      platforms: string[];
      upvotes: number;
      rating: number;
      reviewCount: number;
    }> = {},
  ) =>
    prisma.tool.create({
      data: {
        slug: `test-${tag}-${n}`, name: `Тест ${tag} ${n}`, topic: `topic-${tag}-${n}`,
        tagline: `Тестийн хэрэгсэл ${n}`, descriptionMd: "Тайлбар.",
        website: `https://test-${tag}-${n}.example.mn`,
        categories: over.categories ?? ["CHAT"],
        pricing: over.pricing ?? "FREEMIUM",
        mongolianSupport: over.mongolianSupport ?? "PARTIAL",
        platforms: over.platforms ?? ["web"],
        upvotes: over.upvotes ?? 0,
        rating: over.rating ?? 0,
        reviewCount: over.reviewCount ?? 0,
        status: "PUBLISHED", source: "SITE", publishedAt: new Date(),
      },
    });

  const user = await prisma.user.create({
    data: { email: `tool-${tag}@example.mn`, name: "Шүүмжлэгч", emailVerifiedAt: new Date() },
  });

  const cleanup = async () => {
    await prisma.tool.deleteMany({ where: { slug: { startsWith: `test-${tag}` } } });
    await prisma.user.deleteMany({ where: { email: { contains: `tool-${tag}` } } });
  };
  return { prisma, user, mk, cleanup };
}

test("товшилт өдрөөр нэгтгэгдэнэ", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `c${Date.now()}`;
  const { prisma, mk, cleanup } = await fixture(tag);
  const { countClick } = await import("./mutations");
  const { clicksByTool } = await import("./queries");

  const t = await mk(1);
  try {
    await countClick(t.id);
    await countClick(t.id);
    const rows = await prisma.toolClick.findMany({ where: { toolId: t.id } });
    assert.equal(rows.length, 1, "нэг өдөрт нэг мөр");
    assert.equal(rows[0]!.count, 2);

    // Өөр өдөр — тусдаа мөр
    await countClick(t.id, new Date(Date.now() + 2 * 86_400_000));
    assert.equal(await prisma.toolClick.count({ where: { toolId: t.id } }), 2);

    // 30 хоногийн нийлбэр
    assert.equal((await clicksByTool([t.id])).get(t.id), 3);

    // Хэт хуучин товшилт нийлбэрт орохгүй
    await prisma.toolClick.create({
      data: { toolId: t.id, day: "2020-01-01", count: 999 },
    });
    assert.equal((await clicksByTool([t.id])).get(t.id), 3, "30 хоногоос хуучин нь орохгүй");

    // Байхгүй хэрэгсэл дээр унахгүй
    await assert.doesNotReject(() => countClick("байхгүй-id"));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("upvote идемпотент, upvotes тоолуур бодит тоог тусгана", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `u${Date.now()}`;
  const { prisma, user, mk, cleanup } = await fixture(tag);
  const { toggleUpvote, upvotedToolIds } = await import("./mutations");

  const t = await mk(1);
  const other = await prisma.user.create({ data: { email: `tool-${tag}-2@example.mn` } });

  try {
    assert.equal(await toggleUpvote(user.id, t.id), true);
    assert.equal((await prisma.tool.findUniqueOrThrow({ where: { id: t.id } })).upvotes, 1);
    assert.deepEqual([...(await upvotedToolIds(user.id, [t.id]))], [t.id]);

    assert.equal(await toggleUpvote(user.id, t.id), false);
    assert.equal((await prisma.tool.findUniqueOrThrow({ where: { id: t.id } })).upvotes, 0);

    await toggleUpvote(user.id, t.id);
    await toggleUpvote(other.id, t.id);
    assert.equal((await prisma.tool.findUniqueOrThrow({ where: { id: t.id } })).upvotes, 2);

    // Зэрэг дарахад давхар мөр ч үүсэхгүй, тоолуур ч алдагдахгүй
    await assert.doesNotReject(() =>
      Promise.all([toggleUpvote(other.id, t.id), toggleUpvote(other.id, t.id)]),
    );
    const after = await prisma.tool.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(after.upvotes, await prisma.toolUpvote.count({ where: { toolId: t.id } }));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("шүүмж: нэг хэрэглэгч нэг шүүмж, дүн дахин бодогдоно", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `r${Date.now()}`;
  const { prisma, user, mk, cleanup } = await fixture(tag);
  const { upsertReview, deleteReview, syncRating } = await import("./mutations");

  const t = await mk(1);
  const other = await prisma.user.create({ data: { email: `tool-${tag}-2@example.mn` } });

  try {
    await upsertReview({ toolId: t.id, userId: user.id, stars: 5, text: "Сайн", status: "PUBLISHED", rejectReason: null });
    let row = await prisma.tool.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(row.rating, 5);
    assert.equal(row.reviewCount, 1);

    // Дахин бичвэл шинэчлэгдэнэ — давхар шүүмж үүсэхгүй
    await upsertReview({ toolId: t.id, userId: user.id, stars: 3, text: "Дунд", status: "PUBLISHED", rejectReason: null });
    assert.equal(await prisma.toolReview.count({ where: { toolId: t.id } }), 1);
    row = await prisma.tool.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(row.rating, 3);
    assert.equal(row.reviewCount, 1);

    // DB-ийн unique — гараар давхар мөр үүсэхгүй
    await assert.rejects(
      () => prisma.toolReview.create({ data: { toolId: t.id, userId: user.id, stars: 4 } }),
      /unique|constraint/i,
    );

    // PENDING шүүмж дүнд орохгүй
    await upsertReview({ toolId: t.id, userId: other.id, stars: 1, text: "Спам", status: "PENDING", rejectReason: "Спам" });
    row = await prisma.tool.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(row.rating, 3, "хянагдаж байгаа шүүмж дүнд орохгүй");
    assert.equal(row.reviewCount, 1);

    // Батласны дараа дүнд орно
    await prisma.toolReview.updateMany({ where: { toolId: t.id, userId: other.id }, data: { status: "PUBLISHED" } });
    await syncRating(t.id);
    row = await prisma.tool.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(row.rating, 2, "(3+1)/2");
    assert.equal(row.reviewCount, 2);

    // Устгахад дүн дахин бодогдоно
    await deleteReview(other.id, t.id);
    row = await prisma.tool.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(row.rating, 3);
    assert.equal(row.reviewCount, 1);

    // Бүгдийг устгахад 0
    await deleteReview(user.id, t.id);
    row = await prisma.tool.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(row.rating, 0);
    assert.equal(row.reviewCount, 0);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("шүүлт ба эрэмбэ: ангилал, үнэ, MN, платформ, алдартай/шинэ/үнэлгээ", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `f${Date.now()}`;
  const { prisma, mk, cleanup } = await fixture(tag);
  const { listTools, toolFacets } = await import("./queries");
  const { countClick } = await import("./mutations");

  // 1: CHAT, FREE, GOOD, upvote 1, товшилт 20 → алдартай оноо 3+20=23
  // 2: CODE, PAID, NONE, upvote 7, товшилт 0  → алдартай оноо 21
  // 3: ZURAG, FREEMIUM, PARTIAL, үнэлгээ 5
  const t1 = await mk(1, { categories: ["CHAT"], pricing: "FREE", mongolianSupport: "GOOD", upvotes: 1, platforms: ["web", "ios"] });
  const t2 = await mk(2, { categories: ["CODE"], pricing: "PAID", mongolianSupport: "NONE", upvotes: 7 });
  const t3 = await mk(3, { categories: ["ZURAG"], pricing: "FREEMIUM", rating: 5, reviewCount: 2 });
  const mine = new Set([t1.id, t2.id, t3.id]);
  const only = (rows: { id: string }[]) => rows.filter((r) => mine.has(r.id)).map((r) => r.id);

  try {
    for (let i = 0; i < 20; i++) await countClick(t1.id);

    assert.deepEqual(only(await listTools({ category: "CODE" })), [t2.id]);
    assert.deepEqual(only(await listTools({ pricing: "FREE" })), [t1.id]);
    assert.deepEqual(only(await listTools({ mongolianSupport: "GOOD" })), [t1.id]);
    assert.deepEqual(only(await listTools({ platform: "ios" })), [t1.id]);
    assert.deepEqual(only(await listTools({ category: "CHAT", pricing: "PAID" })), [], "хоёр шүүлт хамт");

    // Алдартай — товшилт нь upvote-той нийлж t1-ийг дээгүүр гаргана
    const popular = only(await listTools({ sort: "aldartai" }));
    assert.equal(popular[0], t1.id, "23 > 21");
    assert.equal(popular[1], t2.id);

    // Үнэлгээ
    assert.equal(only(await listTools({ sort: "unelgee" }))[0], t3.id);

    // Шинэ — сүүлд нийтлэгдсэн нь эхэнд
    assert.equal(only(await listTools({ sort: "shine" }))[0], t3.id);

    // Хүлээгдэж байгаа хэрэгсэл нийтэд харагдахгүй
    await prisma.tool.update({ where: { id: t1.id }, data: { status: "PENDING" } });
    assert.ok(!only(await listTools()).includes(t1.id));

    const facets = await toolFacets();
    assert.ok(facets.categories.includes("CODE"));
    assert.ok(facets.pricings.includes("PAID"));
    assert.ok(facets.supports.includes("NONE"));
    assert.ok(facets.platforms.includes("web"));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("bookmark CHECK: 4 баганаас яг нэг", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `b${Date.now()}`;
  const { prisma, user, mk, cleanup } = await fixture(tag);
  const { toggleBookmarkFor, isBookmarked, listToolBookmarks, listBookmarks } =
    await import("../bookmarks/queries");
  const { bookmarkedToolIds } = await import("./queries");

  const t = await mk(1);
  const guide = await prisma.guide.create({
    data: { slug: `test-g-${tag}`, title: "З", lead: "Т", bodyMd: "## А\nт", status: "PUBLISHED" },
  });

  try {
    assert.equal(await toggleBookmarkFor(user.id, { toolId: t.id }), true);
    assert.equal(await isBookmarked(user.id, { toolId: t.id }), true);
    assert.deepEqual((await listToolBookmarks(user.id)).map((x) => x.slug), [`test-${tag}-1`]);
    assert.deepEqual([...(await bookmarkedToolIds(user.id, [t.id]))], [t.id]);
    assert.deepEqual(await listBookmarks(user.id), [], "хэрэгсэл нийтлэлийн жагсаалтад орохгүй");

    // Идемпотент
    assert.equal(await toggleBookmarkFor(user.id, { toolId: t.id }), false);
    assert.equal(await toggleBookmarkFor(user.id, { toolId: t.id }), true);
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 1);

    // Зорилгогүй
    await assert.rejects(
      () => prisma.bookmark.create({ data: { userId: user.id } }),
      /check|constraint/i,
    );
    // Хоёр зорилго зэрэг
    await assert.rejects(
      () => prisma.bookmark.create({ data: { userId: user.id, toolId: t.id, guideId: guide.id } }),
      /check|constraint/i,
    );
    // Дөрвөн зорилго зэрэг ч болохгүй
    await assert.rejects(
      () => prisma.bookmark.create({ data: { userId: user.id, toolId: t.id, guideId: guide.id, promptId: null, articleId: null } }),
      /check|constraint/i,
    );

    // Хэрэгсэл устахад bookmark cascade
    await prisma.tool.delete({ where: { id: t.id } });
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 0);
  } finally {
    await prisma.guide.deleteMany({ where: { slug: `test-g-${tag}` } });
    await cleanup();
    await prisma.$disconnect();
  }
});

test("хувилбарын холбоос тэгш — хоёр талаас харагдана", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `a${Date.now()}`;
  const { prisma, mk, cleanup } = await fixture(tag);
  const { getTool, getToolsForVersus } = await import("./queries");

  const a = await mk(1);
  const b = await mk(2);
  try {
    await prisma.tool.update({ where: { id: a.id }, data: { alternativesTo: { connect: { id: b.id } } } });

    const fromA = await getTool(a.slug);
    const fromB = await getTool(b.slug);
    assert.deepEqual(fromA!.alternatives.map((x) => x.id), [b.id]);
    assert.deepEqual(fromB!.alternatives.map((x) => x.id), [a.id], "нөгөө талаас ч харагдана");

    const pair = await getToolsForVersus(a.slug, b.slug);
    assert.ok(pair);
    assert.deepEqual([pair![0].id, pair![1].id], [a.id, b.id]);
    assert.equal(await getToolsForVersus(a.slug, "байхгүй"), null);

    // Хүлээгдэж байгаа хэрэгсэл хувилбарт харагдахгүй
    await prisma.tool.update({ where: { id: b.id }, data: { status: "PENDING" } });
    assert.deepEqual((await getTool(a.slug))!.alternatives, []);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
