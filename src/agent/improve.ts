/**
 * БЭЛТГЭХ горимын «improve» алхам — дараагийн slot-уудад нийтлэл бэлдэнэ.
 *
 *   npx tsx src/agent/improve.ts            # бэлэн нийтлэлийн тоог зорилтот хэмжээнд хүргэнэ
 *   npx tsx src/agent/improve.ts --limit 1
 *
 * Нийтлэл бүрт:
 *   1. текстийг нэг удаа засварлах (гарчиг богино, эхний өгүүлбэр хүчтэй, давхардал арилгах)
 *   2. FB текст бичих (fbText + fbTextAlt)
 *   3. зураг үүсгэх — зөвхөн эхний IMAGE_AHEAD нийтлэлд, өдрийн зургийн хязгаарын дотор
 *   4. readyAt тэмдэглэх
 *
 * Алхам бүр idempotent: аль хэдийн хийгдсэнийг алгасна. Тиймээс цаг бүрийн run давхар
 * зардал гаргахгүй — бэлэн нийтлэлийн тоо хүрсэн бол юу ч хийхгүй.
 */
import "dotenv/config";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { cardForArticle, saveCard } from "../publish/card";
import { imagesToday, recentImagePrompts } from "../publish/fbimage";
import { imageDailyLimit } from "../publish/fbimage.api";
import { generateFbCopy } from "../publish/fbcopy";
import { chatJson } from "./llm";
import {
  checkImproved, IMAGE_AHEAD, IMPROVE_SCHEMA, IMPROVE_SYSTEM, readyTarget, trimTitle,
  type ImproveOut,
} from "./improve.api";
import { pickForPrepare } from "./quota";

const IMPROVE_MODEL = process.env.WRITE_MODEL ?? "google/gemini-3.8-flash";

export interface ImproveResult {
  /** Одоо бэлэн байгаа нийтлэлийн тоо */
  ready: number;
  /** Энэ ажиллалтад бэлдсэн */
  prepared: { id: string; titleMn: string | null; hasImage: boolean }[];
  /** Бэлэн байсан ч зураггүй байсан нийтлэлд нөхөж үүсгэсэн зургийн тоо */
  imagesAdded: number;
  costUsd: number;
}

/** Нийтлэлийн текстийг нэг удаа засварлана */
export async function improveText(
  articleId: string,
  opts: { chat?: typeof chatJson } = {},
): Promise<{ changed: string[]; costUsd: number }> {
  const chat = opts.chat ?? chatJson;
  const a = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { id: true, titleMn: true, summaryMn: true, bodyMn: true, improvedAt: true },
  });
  if (a.improvedAt || !a.titleMn || !a.bodyMn) return { changed: [], costUsd: 0 };

  const out = await chat<ImproveOut>({
    model: IMPROVE_MODEL,
    system: IMPROVE_SYSTEM,
    user: [`Гарчиг: ${a.titleMn}`, `Хураангуй: ${a.summaryMn ?? ""}`, `Биет:\n${a.bodyMn}`].join("\n"),
    schema: IMPROVE_SCHEMA,
    maxTokens: 4_000,
    temperature: 0.3,
    reasoning: false,
  });

  const check = checkImproved({ titleMn: a.titleMn, bodyMn: a.bodyMn }, out.data);
  if (!check.ok) {
    // Засвар нь эх хувилбараас дор байвал хэвээр үлдээнэ — дахин оролдохгүй (зардал)
    console.warn(`  ⚠ засвар хүлээж авсангүй: ${check.problems.join("; ")}`);
    await prisma.article.update({ where: { id: a.id }, data: { improvedAt: new Date() } });
    return { changed: [], costUsd: out.costUsd };
  }

  await prisma.article.update({
    where: { id: a.id },
    data: {
      titleMn: trimTitle(out.data.titleMn),
      summaryMn: out.data.summaryMn.trim(),
      bodyMn: out.data.bodyMn.trim(),
      improvedAt: new Date(),
      tokensUsed: { increment: out.tokens },
    },
  });
  return { changed: out.data.changed, costUsd: out.costUsd };
}

/** Бэлэн (readyAt тэмдэглэгдсэн) DRAFT-уудын тоо */
export async function readyCount(): Promise<number> {
  return prisma.article.count({ where: { status: "DRAFT", readyAt: { not: null } } });
}

/** Зураггүй бэлэн нийтлэлийн тоо */
async function missingImageCount(): Promise<number> {
  return prisma.article.count({ where: { status: "DRAFT", readyAt: { not: null }, fbImageData: null } });
}

/**
 * Бэлэн боловч зураггүй нийтлэлүүдэд зураг нөхнө.
 *
 * Буфер дүүрэн үед (шинэ нийтлэл бэлдэхгүй) ч ажиллана: өдрийн зургийн хязгаар дүүрсэн
 * үед бэлдсэн нийтлэлүүд зураггүй үлддэг, маргааш квот сэргэхэд эндээс нөхөгдөнө.
 * Эс бөгөөс slot дээр зургаа үүсгэж 25 секунд алддаг.
 */
export async function topUpImages(max = IMAGE_AHEAD): Promise<{ added: number; costUsd: number }> {
  const imageLimit = imageDailyLimit();
  let added = 0;
  let costUsd = 0;

  const rows = await prisma.article.findMany({
    where: { status: "DRAFT", readyAt: { not: null }, fbImageData: null },
    orderBy: [{ relevance: "desc" }, { readyAt: "asc" }],
    take: max,
    select: { id: true, titleMn: true },
  });

  for (const r of rows) {
    if ((await imagesToday()) >= imageLimit) {
      console.log(`  өдрийн зургийн хязгаар дүүрсэн — ${rows.length - added} нийтлэл картгүй хүлээнэ`);
      break;
    }
    try {
      const built = await cardForArticle(r.id, { recentPrompts: await recentImagePrompts() });
      await saveCard(r.id, built);
      added++;
      costUsd += built.costUsd;
      console.log(`  ✓ карт нөхөв: ${r.titleMn} ($${built.costUsd.toFixed(3)})`);
    } catch (e) {
      console.warn(`  ⚠ ${r.titleMn}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  return { added, costUsd };
}

/** Бэлэн нийтлэлийн тоог зорилтот хэмжээнд хүргэж, зураггүйд нь зураг нөхнө */
export async function runImprove(limit?: number): Promise<ImproveResult> {
  const target = readyTarget();
  const ready = await readyCount();
  const need = Math.min(limit ?? target, Math.max(0, target - ready));
  const missingImages = await missingImageCount();
  if (need === 0 && missingImages === 0) {
    console.log(`Бэлэн нийтлэл ${ready}/${target}, бүгд зурагтай — хийх зүйл алга`);
    return { ready, prepared: [], imagesAdded: 0, costUsd: 0 };
  }

  const run = await prisma.jobRun.create({ data: { job: "improve", ...jobRunMeta() } });
  let costUsd = 0;
  const prepared: ImproveResult["prepared"] = [];

  try {
    // Нийтлэх үеийнхтэй ижил дүрмээр — нэг үйл явдлыг гурван эх сурвалжаас бэлдэхгүй
    const ids = need > 0 ? await pickForPrepare(need) : [];
    const rows = await prisma.article.findMany({
      where: { id: { in: ids } },
      select: { id: true, titleMn: true, fbText: true, fbImageData: true },
    });
    // pickForPrepare-ийн эрэмбийг хадгална (эхнийх нь зурагтай болно)
    const candidates = ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
    console.log(`Бэлэн ${ready}/${target}, ${candidates.length} нийтлэл бэлдэнэ...`);

    const imageLimit = imageDailyLimit();
    for (const [i, c] of candidates.entries()) {
      try {
        const improved = await improveText(c.id);
        costUsd += improved.costUsd;
        if (improved.changed.length) console.log(`  ✎ ${improved.changed.join("; ")}`);

        if (!c.fbText) {
          const copy = await generateFbCopy(c.id);
          console.log(`  ✓ FB текст (${copy.tokens} токен)`);
        }

        // Зураг зөвхөн дараагийн 2 slot-д орох нийтлэлүүдэд, өдрийн хязгаарын дотор
        let hasImage = c.fbImageData !== null;
        if (!hasImage && i < IMAGE_AHEAD && (await imagesToday()) < imageLimit) {
          const built = await cardForArticle(c.id, { recentPrompts: await recentImagePrompts() });
          await saveCard(c.id, built);
          costUsd += built.costUsd;
          hasImage = true;
          console.log(`  ✓ карт ($${built.costUsd.toFixed(3)})`);
        }

        const done = await prisma.article.update({
          where: { id: c.id },
          data: { readyAt: new Date() },
          select: { id: true, titleMn: true },
        });
        prepared.push({ ...done, hasImage });
        console.log(`  → бэлэн: ${done.titleMn}`);
      } catch (e) {
        // Нэг нийтлэл бэлдэгдэхгүй бол бусдыг зогсоохгүй — readyAt тавигдахгүй тул дараа дахин
        console.error(`  ✗ ${c.titleMn}: ${(e as Error).message.slice(0, 150)}`);
      }
    }

    // Буфер дүүрэн байсан ч зураггүй бэлэн нийтлэлүүдэд зураг нөхнө
    const images = await topUpImages();
    costUsd += images.costUsd;

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), ok: true,
        itemsIn: candidates.length, itemsOut: prepared.length,
        attempted: candidates.length, failed: candidates.length - prepared.length,
        costUsd,
      },
    });
    return { ready: await readyCount(), prepared, imagesAdded: images.added, costUsd };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 500), costUsd },
    });
    throw e;
  }
}

if (process.argv[1]?.endsWith("improve.ts")) {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : undefined;
  runImprove(limit)
    .then((r) =>
      console.log(
        `Бэлэн ${r.ready}, шинээр ${r.prepared.length}, зураг нөхсөн ${r.imagesAdded}, ` +
          `зардал $${r.costUsd.toFixed(4)}`,
      ),
    )
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
