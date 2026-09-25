import { test } from "node:test";
import assert from "node:assert/strict";
import { isBot } from "./views.api";
import { parseFaq } from "./queries";

const hasDb = Boolean(process.env.DATABASE_URL);

test("isBot: crawler-ыг шүүнэ, хүнийг оруулна", () => {
  assert.equal(isBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141 Safari/537.36"), false);
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1"), false);

  assert.equal(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)"), true);
  assert.equal(isBot("Mozilla/5.0 (compatible; bingbot/2.0)"), true);
  assert.equal(isBot("facebookexternalhit/1.1"), true);
  assert.equal(isBot("curl/8.5.0"), true);
  assert.equal(isBot("python-requests/2.31"), true);
  assert.equal(isBot("HeadlessChrome/141"), true);
  assert.equal(isBot(""), true, "UA-гүй нь скрипт");
  assert.equal(isBot(null), true);
});

test("parseFaq: хэлбэр таарахгүй утгыг хаяна", () => {
  assert.deepEqual(parseFaq([{ q: "Асуулт", a: "Хариулт" }]), [{ q: "Асуулт", a: "Хариулт" }]);
  assert.deepEqual(parseFaq([{ q: " Зай ", a: " Тайрагдана " }]), [{ q: "Зай", a: "Тайрагдана" }]);
  assert.deepEqual(parseFaq("массив биш"), []);
  assert.deepEqual(parseFaq(null), []);
  assert.deepEqual(parseFaq([{ q: "Хариултгүй" }, { a: "Асуултгүй" }, null, 5]), []);
  assert.deepEqual(parseFaq([{ q: "", a: "х" }]), [], "хоосон асуулт орохгүй");
});

test("заавар: bookmark guideId-аар ажиллана, cascade устана", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { prisma } = await import("../db");
  const { toggleBookmarkFor, isBookmarked, listGuideBookmarks, bookmarkedGuideIds } =
    await import("../bookmarks/queries");
  const { listGuides, getGuide, relatedGuides } = await import("./queries");

  const tag = `g${Date.now()}`;
  const user = await prisma.user.create({ data: { email: `guide-${tag}@example.mn`, name: "Уншигч" } });
  const guide = await prisma.guide.create({
    data: {
      slug: `test-${tag}`, title: "Тест заавар", lead: "Тестийн зорилгоор бичсэн заавар.",
      bodyMd: "## 1. Эхлэх\nТовчийг дар.\n\n## 2. Дуусгах\nХадгал.",
      status: "PUBLISHED", publishedAt: new Date(), tools: ["ChatGPT"], audience: ["оюутан"],
      faq: [{ q: "Үнэгүй юу?", a: "Тийм." }], readMinutes: 3,
    },
  });
  const cleanup = async () => {
    await prisma.guide.deleteMany({ where: { slug: { startsWith: `test-${tag}` } } });
    await prisma.user.deleteMany({ where: { email: `guide-${tag}@example.mn` } });
  };

  try {
    // Хадгалах → хасах → хадгалах
    assert.equal(await isBookmarked(user.id, { guideId: guide.id }), false);
    assert.equal(await toggleBookmarkFor(user.id, { guideId: guide.id }), true);
    assert.equal(await isBookmarked(user.id, { guideId: guide.id }), true);
    assert.equal(await toggleBookmarkFor(user.id, { guideId: guide.id }), false);
    assert.equal(await toggleBookmarkFor(user.id, { guideId: guide.id }), true, "идемпотент");
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 1);

    const saved = await listGuideBookmarks(user.id);
    assert.deepEqual(saved.map((s) => s.slug), [`test-${tag}`]);
    assert.equal(saved[0]!.readMinutes, 3);
    assert.deepEqual([...(await bookmarkedGuideIds(user.id, [guide.id]))], [guide.id]);

    // Нийтлэлийн хадгалалттай хольж андуурахгүй
    const { listBookmarks } = await import("../bookmarks/queries");
    assert.deepEqual(await listBookmarks(user.id), [], "заавар нь нийтлэлийн жагсаалтад орохгүй");

    // DB-ийн CHECK: хоёулаа хоосон, эсвэл хоёулаа дүүрэн бол хүлээж авахгүй
    await assert.rejects(
      () => prisma.bookmark.create({ data: { userId: user.id } }),
      /check|constraint/i,
      "зорилгогүй bookmark үүсэхгүй",
    );

    // Query-ууд
    const detail = await getGuide(`test-${tag}`);
    assert.ok(detail);
    assert.deepEqual(detail!.faq, [{ q: "Үнэгүй юу?", a: "Тийм." }]);
    assert.equal(detail!.hasHero, false, "зураг үүсгээгүй");
    assert.ok((await listGuides({ audience: "оюутан" })).some((g) => g.id === guide.id));
    assert.ok(!(await listGuides({ audience: "багш" })).some((g) => g.id === guide.id));
    assert.ok(!(await listGuides({ tool: "Canva" })).some((g) => g.id === guide.id));
    assert.ok((await relatedGuides(detail!)).every((r) => r.id !== guide.id), "өөрийгөө санал болгохгүй");

    // Ноорог нь нийтэд харагдахгүй
    await prisma.guide.update({ where: { id: guide.id }, data: { status: "DRAFT" } });
    assert.equal(await getGuide(`test-${tag}`), null);
    assert.deepEqual(await listGuideBookmarks(user.id), [], "ноорог хадгалсан жагсаалтад гарахгүй");

    // Заавар устахад bookmark нь cascade-аар устана
    await prisma.guide.delete({ where: { id: guide.id } });
    assert.equal(await prisma.bookmark.count({ where: { userId: user.id } }), 0);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
});

test("views: bot нэмэгдүүлэхгүй, хүн нэмэгдүүлнэ", { skip: !hasDb && "DATABASE_URL алга" }, async () => {
  const { prisma } = await import("../db");
  const { bumpViews } = await import("./views");

  const tag = `v${Date.now()}`;
  const g = await prisma.guide.create({
    data: { slug: `test-${tag}`, title: "Тоолуур", lead: "Тест.", bodyMd: "## Алхам\nтекст" },
  });
  try {
    await bumpViews(g.id, "Googlebot/2.1");
    assert.equal((await prisma.guide.findUniqueOrThrow({ where: { id: g.id } })).views, 0);

    await bumpViews(g.id, "Mozilla/5.0 (X11; Linux x86_64) Chrome/141 Safari/537.36");
    assert.equal((await prisma.guide.findUniqueOrThrow({ where: { id: g.id } })).views, 1);

    // Байхгүй заавар дээр ч унахгүй
    await assert.doesNotReject(() => bumpViews("байхгүй-id", "Mozilla/5.0 Chrome/141"));
  } finally {
    await prisma.guide.deleteMany({ where: { slug: `test-${tag}` } });
    await prisma.$disconnect();
  }
});
