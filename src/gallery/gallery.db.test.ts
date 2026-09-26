import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);

async function fixture(tag: string) {
  const { prisma } = await import("../db");
  const source = await prisma.source.upsert({
    where: { url: `https://gal-${tag}.example.mn` },
    update: {},
    create: { name: `Тест ${tag}`, url: `https://gal-${tag}.example.mn`, isActive: false },
  });

  /** n дугаартай карттай нийтлэл. cardAt нь n-ээр эрэмбэлэгдэнэ (их = шинэ). */
  const mk = (
    n: number,
    over: { category?: "NEWS" | "RISK"; withCard?: boolean; likes?: number; copies?: number } = {},
  ) =>
    prisma.article.create({
      data: {
        slug: `gal-${tag}-${n}`, sourceId: source.id, sourceUrl: `https://gal-${tag}.example.mn/${n}`,
        sourceTitle: `T${n}`, sourceHash: `${tag}-${n}`, status: "PUBLISHED",
        category: over.category ?? "NEWS",
        titleMn: `Нийтлэл ${n}`, summaryMn: "Хураангуй", fbHook: `Баримт ${n}`,
        publishedAt: new Date(1_790_000_000_000 + n * 1_000),
        ...(over.withCard === false
          ? {}
          : {
              fbImageData: new Uint8Array([1, 2, 3]),
              fbImageAt: new Date(1_790_000_000_000 + n * 1_000),
            }),
        fbLikes: over.likes ?? 0,
        cardCopies: over.copies ?? 0,
      },
    });

  const cleanup = async () => {
    await prisma.article.deleteMany({ where: { sourceId: source.id } });
    await prisma.source.deleteMany({ where: { id: source.id } });
  };
  return { prisma, mk, cleanup, sourceId: source.id };
}

test("cursor pagination: давхардал, цоорхойгүй", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `p${Date.now()}`;
  const { prisma, mk, cleanup } = await fixture(tag);
  const { cardPage } = await import("./queries");

  try {
    for (let n = 1; n <= 7; n++) await mk(n);
    const mine = (items: { slug: string }[]) => items.filter((i) => i.slug.startsWith(`gal-${tag}-`));

    // Гурваар гүйлгэж бүх мөрийг цуглуулна
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard++) {
      const page = await cardPage({ cursor, size: 3 });
      seen.push(...mine(page.items).map((i) => i.slug));
      cursor = page.next;
      if (!cursor) break;
    }
    // Тестийн 7 мөр бүгд яг нэг удаа гарсан
    const mineSeen = seen.filter((s) => s.startsWith(`gal-${tag}-`));
    assert.equal(new Set(mineSeen).size, 7, "давхардалгүй");
    assert.equal(mineSeen.length, 7, "цоорхойгүй");

    // Шинээс хуучин руу. DB-д бодит нийтлэлүүд ч байгаа тул зөвхөн тестийн
    // мөрүүдийн ХАРЬЦАНГУЙ дарааллыг шалгана.
    assert.deepEqual(
      mineSeen,
      [7, 6, 5, 4, 3, 2, 1].map((n) => `gal-${tag}-${n}`),
      "шинээс хуучин руу",
    );

    // Карт байхгүй нийтлэл галерейд орохгүй
    await mk(8, { withCard: false });
    const after = await cardPage({ size: 50 });
    assert.ok(!after.items.some((i) => i.slug === `gal-${tag}-8`));

    // Танигдахгүй cursor нь эхнээс нь буцаана — хоосон хуудас гаргахгүй
    const bad = await cardPage({ cursor: "хог", size: 3 });
    const clean = await cardPage({ size: 3 });
    assert.ok(bad.items.length > 0, "хоосон биш");
    assert.deepEqual(bad.items.map((i) => i.slug), clean.items.map((i) => i.slug), "эхний хуудастай ижил");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("ангиллын шүүлт ба тоолол", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `f${Date.now()}`;
  const { prisma, mk, cleanup } = await fixture(tag);
  const { cardPage, cardCategories } = await import("./queries");

  try {
    await mk(1, { category: "NEWS" });
    await mk(2, { category: "RISK" });
    await mk(3, { category: "RISK" });

    const risk = await cardPage({ category: "RISK", size: 50 });
    const mineRisk = risk.items.filter((i) => i.slug.startsWith(`gal-${tag}-`));
    assert.deepEqual(mineRisk.map((i) => i.slug).sort(), [`gal-${tag}-2`, `gal-${tag}-3`]);

    const groups = await cardCategories();
    assert.ok(groups.some((g) => g.category === "RISK" && g.count >= 2));
    // Эрэмбэ нь тооноос буурах
    for (let i = 1; i < groups.length; i++) {
      assert.ok(groups[i - 1]!.count >= groups[i]!.count, "тооноос буурах эрэмбэ");
    }

    // Ноорог болвол галерейгээс гарна
    await prisma.article.updateMany({ where: { slug: `gal-${tag}-2` }, data: { status: "DRAFT" } });
    const after = await cardPage({ category: "RISK", size: 50 });
    assert.ok(!after.items.some((i) => i.slug === `gal-${tag}-2`));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("долоо хоногийн шилдэг, картын тоолуур", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `w${Date.now()}`;
  const { prisma, mk, cleanup } = await fixture(tag);
  const { weeklyBestCards, countCopy, getCard, latestCards } = await import("./queries");

  try {
    // Огноог одоогийн долоо хоногт оруулна (weeklyBestCards нь 7 хоногоор шүүнэ)
    const now = Date.now();
    const a = await mk(1, { likes: 0, copies: 3 });
    const b = await mk(2, { likes: 25 });
    await prisma.article.updateMany({
      where: { slug: { in: [a.slug, b.slug] } },
      data: { fbImageAt: new Date(now - 3_600_000) },
    });

    const best = await weeklyBestCards(10);
    const mine = best.filter((c) => c.slug.startsWith(`gal-${tag}-`));
    assert.deepEqual(mine.map((c) => c.slug), [b.slug, a.slug], "FB like нь татсан тооноос дээгүүр");

    // Тоолуур
    await countCopy(a.id);
    await countCopy(a.id);
    assert.equal((await prisma.article.findUniqueOrThrow({ where: { id: a.id } })).cardCopies, 5);
    await assert.doesNotReject(() => countCopy("байхгүй-id"));

    // Нэг картын хуудас
    const card = await getCard(a.slug);
    assert.ok(card);
    assert.equal(card!.hook, "Баримт 1");
    assert.equal(card!.summaryMn, "Хураангуй");

    // Карт байхгүй нийтлэл — картын хуудас гарахгүй
    const noCard = await mk(9, { withCard: false });
    assert.equal(await getCard(noCard.slug), null);

    assert.ok((await latestCards(50)).some((c) => c.slug === b.slug));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("backfill идемпотент: карттай нийтлэлийг дахин хөндөхгүй", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const tag = `b${Date.now()}`;
  const { prisma, mk, cleanup } = await fixture(tag);
  const { needsCard, backfillCards } = await import("./backfill");

  try {
    const withCard = await mk(1);
    const without = await mk(2, { withCard: false });

    const queue = await needsCard(100);
    assert.ok(queue.some((q) => q.slug === without.slug), "карттгүй нь дараалалд");
    assert.ok(!queue.some((q) => q.slug === withCard.slug), "карттай нь дараалалд орохгүй");

    // Dry run нь юу ч хөндөхгүй
    const before = await prisma.article.findUniqueOrThrow({ where: { id: without.id } });
    const dry = await backfillCards({ limit: 100, dry: true });
    assert.ok(dry.created.some((c) => c.slug === without.slug));
    const after = await prisma.article.findUniqueOrThrow({ where: { id: without.id } });
    assert.equal(after.fbImageAt, before.fbImageAt);
    assert.equal(after.fbImageData, before.fbImageData);

    // Карт үүссэний дараа дараалалд дахин орохгүй
    await prisma.article.update({
      where: { id: without.id },
      data: { fbImageData: new Uint8Array([9]), fbImageAt: new Date() },
    });
    assert.ok(!(await needsCard(100)).some((q) => q.slug === without.slug));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});
