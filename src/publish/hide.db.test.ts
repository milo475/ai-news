import { test } from "node:test";
import assert from "node:assert/strict";

const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * HIDDEN нийтлэл нь `status: "PUBLISHED"` шүүлт бүрээс автоматаар хасагдана:
 * нийтлэлийн хуудас 404, жагсаалт, sitemap-д гарахгүй. Энэ тест тэр гэрээг
 * бататгана — шинэ статусыг нэмэхэд аль нэг газар алдагдвал энд баригдана.
 */
test(
  "HIDDEN нийтлэл нийтлэл, жагсаалт, sitemap-аас хасагдана",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { prisma } = await import("../db");
    const { getNewsItem } = await import("../data");
    const { hideArticle, showArticle } = await import("./fix");

    const source = await prisma.source.findFirst({ select: { id: true } });
    if (!source) { assert.ok(true, "эх сурвалж алга — алгаслаа"); return; }

    const slug = `test-hidden-${Date.now()}`;
    const a = await prisma.article.create({
      data: {
        slug, status: "PUBLISHED", kind: "NEWS", category: "NEWS",
        sourceId: source.id,
        sourceUrl: `https://example.test/${slug}`,
        sourceTitle: "Test", sourceHash: slug,
        titleMn: "Тестийн нийтлэл", summaryMn: "Хураангуй", bodyMn: "Биет",
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    try {
      assert.ok(await getNewsItem(slug), "нийтлэгдсэн үед уншигдана");

      const posts = await hideArticle(slug);
      assert.equal(posts.fbPostId, null);

      const hidden = await prisma.article.findUniqueOrThrow({
        where: { slug },
        select: { status: true, publishedAt: true, correctionNote: true },
      });
      assert.equal(hidden.status, "HIDDEN");
      assert.ok(hidden.publishedAt, "publishedAt хэвээр — буцаахад хэрэгтэй");
      assert.ok(hidden.correctionNote, "шалтгаан тэмдэглэгдэнэ");

      assert.equal(await getNewsItem(slug), null, "нуусны дараа хуудас 404");
      assert.equal(
        await prisma.article.count({ where: { slug, status: "PUBLISHED" } }),
        0,
        "PUBLISHED шүүлтэд орохгүй (sitemap, жагсаалт)",
      );

      await showArticle(slug);
      assert.ok(await getNewsItem(slug), "--show буцаана");
    } finally {
      await prisma.article.delete({ where: { id: a.id } });
      await prisma.$disconnect();
    }
  },
);

test(
  "нийтлэгдээгүй нийтлэлийг нуухгүй",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { prisma } = await import("../db");
    const { hideArticle } = await import("./fix");
    const draft = await prisma.article.findFirst({ where: { status: "DRAFT" }, select: { slug: true } });
    if (!draft) { assert.ok(true, "DRAFT алга — алгаслаа"); return; }
    await assert.rejects(() => hideArticle(draft.slug), /статус DRAFT/);
    await prisma.$disconnect();
  },
);

/**
 * Нуухаас өмнө: энэ нийтлэл рүү заасан бусад агуулгыг олох ёстой. Тоймын
 * хэсгийн мэдээний жагсаалт нь биед /medee/<slug> гэж бичигддэг бөгөөд
 * DigestItem хүснэгтээр ч холбогддог — хоёуланг нь барина, давхардуулахгүй.
 */
test(
  "inboundLinks — тойм ба холбоос бүхий нийтлэлийг олно",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { prisma } = await import("../db");
    const { inboundLinks } = await import("./fix");

    const source = await prisma.source.findFirst({ select: { id: true } });
    if (!source) { assert.ok(true, "эх сурвалж алга — алгаслаа"); return; }

    const stamp = Date.now();
    const base = {
      status: "PUBLISHED" as const, category: "NEWS" as const, sourceId: source.id,
      sourceTitle: "Test", publishedAt: new Date(),
      titleMn: "Тест", summaryMn: "Хураангуй",
    };
    const target = await prisma.article.create({
      data: {
        ...base, kind: "NEWS", slug: `t-target-${stamp}`, sourceHash: `h1-${stamp}`,
        sourceUrl: `https://example.test/t1-${stamp}`, bodyMn: "Биет",
      },
      select: { id: true, slug: true },
    });
    const linker = await prisma.article.create({
      data: {
        ...base, kind: "NEWS", slug: `t-linker-${stamp}`, sourceHash: `h2-${stamp}`,
        sourceUrl: `https://example.test/t2-${stamp}`,
        bodyMn: `Дэлгэрэнгүй: /medee/${target.slug} дээр.`,
      },
      select: { id: true, slug: true },
    });
    const digest = await prisma.article.create({
      data: {
        ...base, kind: "DIGEST", slug: `t-digest-${stamp}`, sourceHash: `h3-${stamp}`,
        sourceUrl: `https://example.test/t3-${stamp}`,
        bodyMn: `Тойм. /medee/${target.slug}`,
        digestItems: { create: [{ articleId: target.id, order: 1 }] },
      },
      select: { id: true, slug: true },
    });

    try {
      const links = await inboundLinks(target.slug);
      assert.deepEqual(links.digests.map((d) => d.slug), [digest.slug]);
      assert.deepEqual(links.articles.map((a) => a.slug), [linker.slug], "тойм давхардахгүй");

      // Холбоосгүй нийтлэлд хоосон
      const none = await inboundLinks(linker.slug);
      assert.deepEqual([...none.articles, ...none.digests], []);
    } finally {
      await prisma.digestItem.deleteMany({ where: { digestId: digest.id } });
      await prisma.article.deleteMany({ where: { id: { in: [target.id, linker.id, digest.id] } } });
      await prisma.$disconnect();
    }
  },
);
