/**
 * Хуучин нийтлэлүүдэд карт үүсгэнэ (карт үүсэх болохоос өмнөх нийтлэлүүд).
 *
 *   npm run backfill:cards               — сүүлийн 30 карттгүй PUBLISHED нийтлэлд
 *   npm run backfill:cards -- --limit 5  — 5-д
 *   npm run backfill:cards -- --dry      — зөвхөн юу хийхээ хэвлэнэ
 *
 * Суурь зураг (heroImageData) байвал зөвхөн текст давхарлана — LLM, зургийн зардал
 * гарахгүй. Байхгүй бол шинээр (~$0.035/ширхэг).
 *
 * Өдрийн зургийн квотоос (FB_IMAGE_DAILY_LIMIT) хамааралгүй ажиллана: энэ нь нэг
 * удаагийн нөхөн ажил, автомат pipeline биш.
 */
import "dotenv/config";
import "../publish/fonts";
import { prisma } from "../db";

export interface BackfillResult {
  created: { slug: string; from: "hero" | "new" }[];
  skipped: string[];
  failed: { slug: string; error: string }[];
  costUsd: number;
}

/** Карттай эсэх — fbImageAt нь картын үүссэн огноо */
export async function needsCard(limit: number) {
  return prisma.article.findMany({
    where: { status: "PUBLISHED", fbImageAt: null, titleMn: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true, slug: true, titleMn: true, summaryMn: true, bodyMn: true, category: true,
      sourceImageUrl: true, heroImageData: true, fbHook: true,
      source: { select: { name: true } },
    },
  });
}

export async function backfillCards(
  opts: { limit?: number; dry?: boolean } = {},
): Promise<BackfillResult> {
  const limit = opts.limit ?? 30;
  const r: BackfillResult = { created: [], skipped: [], failed: [], costUsd: 0 };

  const rows = await needsCard(limit);
  if (rows.length === 0) {
    console.log("Карт дутуу нийтлэл алга.");
    return r;
  }
  console.log(`${rows.length} нийтлэлд карт үүсгэнэ${opts.dry ? " (dry run)" : ""}`);

  const { renderCard, writeHeadline, buildCard, saveCard } = await import("../publish/card");
  const { recentImagePrompts } = await import("../publish/fbimage");
  const recentPrompts = await recentImagePrompts();

  for (const [i, a] of rows.entries()) {
    const hasHero = a.heroImageData !== null;
    const from = hasHero ? "hero" : "new";
    console.log(`${i + 1}/${rows.length} ${a.slug} — ${hasHero ? "суурь зурагтай (үнэгүй)" : "шинэ зураг"}`);

    if (opts.dry) {
      r.created.push({ slug: a.slug, from });
      continue;
    }

    try {
      if (hasHero) {
        // Суурь зураг байгаа — зөвхөн headline бичүүлж давхарлана
        let headline = a.fbHook?.trim() ?? "";
        let costUsd = 0;
        if (!headline) {
          const written = await writeHeadline({
            id: a.id, titleMn: a.titleMn, summaryMn: a.summaryMn, bodyMn: a.bodyMn,
            category: a.category,
          });
          headline = written.headline;
          costUsd = written.costUsd;
        }
        const card = await renderCard(Buffer.from(a.heroImageData!), headline);
        await prisma.article.update({
          where: { id: a.id },
          data: {
            fbImageData: new Uint8Array(card),
            fbImageUrl: `/api/fb-image/${a.id}`,
            fbImageKind: "card",
            fbImageAt: new Date(),
            fbHook: headline,
          },
        });
        r.costUsd += costUsd;
        console.log(`   ✓ overlay ($${costUsd.toFixed(4)})`);
      } else {
        const built = await buildCard(
          {
            id: a.id, titleMn: a.titleMn, summaryMn: a.summaryMn, bodyMn: a.bodyMn,
            category: a.category, sourceImageUrl: a.sourceImageUrl, source: a.source,
          },
          { recentPrompts, headline: a.fbHook ?? undefined },
        );
        await saveCard(a.id, built);
        recentPrompts.push(built.prompt);
        r.costUsd += built.costUsd;
        console.log(`   ✓ шинэ зураг ($${built.costUsd.toFixed(4)})`);
      }
      r.created.push({ slug: a.slug, from });
    } catch (e) {
      const error = (e as Error).message.slice(0, 160);
      r.failed.push({ slug: a.slug, error });
      console.warn(`   ✗ ${error}`);
    }
  }
  return r;
}

if (process.argv[1]?.endsWith("backfill.ts")) {
  const limitArg = process.argv.indexOf("--limit");
  const r = await backfillCards({
    limit: limitArg > -1 ? Number(process.argv[limitArg + 1]) : undefined,
    dry: process.argv.includes("--dry"),
  });
  const fromHero = r.created.filter((c) => c.from === "hero").length;
  console.log(
    `\n${r.created.length} карт (${fromHero} суурь зургаас, ${r.created.length - fromHero} шинэ), ` +
    `${r.failed.length} амжилтгүй — $${r.costUsd.toFixed(3)}`,
  );
  await prisma.$disconnect();
}
