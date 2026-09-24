/**
 * FB постын зураг — үүсгэх, хэмжээ тааруулах, DB-д хадгалах.
 *
 *   npx tsx src/publish/fbimage.ts <slug>            # нийтлэлд зураг үүсгэнэ
 *   npx tsx src/publish/fbimage.ts --ranking         # жагсаалтын карт (өнөөдрийн)
 *   npx tsx src/publish/fbimage.ts <slug> --out a.jpg  # файл болгож хадгална (шалгахад)
 *
 * Гурван эх үүсвэр:
 *   ai      — OpenRouter-ийн зургийн моделиор үүсгэсэн editorial гэрэл зураг (үндсэн)
 *   source  — эх нийтлэлийн og:image + «Зураг: <эх сурвалж>» credit (FB_USE_SOURCE_IMAGE=true)
 *   ranking — өдрийн жагсаалтын брэндийн карт
 *
 * Зургийг Article.fbImageData-д (1080×1080 JPEG) хадгална: web ба cron тусдаа контейнер
 * учраас файлын систем дундаа хуваалцдаггүй.
 */
import "dotenv/config";
import sharp from "sharp";
import { CATEGORY_LABEL } from "../agent/category";
import { chatImage, chatJson } from "../agent/llm";
import { prisma } from "../db";
import { ubDateLabel, ubDayRange } from "../jobs/day";
import { getLatestLeaderboard } from "../queries/leaderboard";
import {
  buildImagePrompt, CATEGORY_SCENE_HINT, creditSvg, creditText, FALLBACK_IMAGE_MODEL,
  imageDailyLimit, imageModel, IMAGE_SIZE, isGenericScene, rankingCardSvg, RECENT_SCENES,
  recentScenesBlock, SCENE_SCHEMA, SCENE_SYSTEM, sceneTooSimilar, useSourceImage,
  type RankingRow,
} from "./fbimage.api";

const JPEG_QUALITY = 82;
const DOWNLOAD_TIMEOUT_MS = 15_000;

type Chat = typeof chatJson;
type ImageCall = typeof chatImage;

export interface ImageResult {
  buffer: Buffer;
  kind: "ai" | "source" | "ranking";
  prompt: string | null;
  costUsd: number;
}

/** 1080×1080 JPEG болгоно (талыг нь тайрч) */
export async function squareJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover", position: "attention" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/** Доод буланд «Зураг: <эх сурвалж>» бичнэ */
export async function withCredit(square: Buffer, sourceName: string): Promise<Buffer> {
  const overlay = Buffer.from(creditSvg(creditText(sourceName)));
  return sharp(square)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/** УБ цагаар өнөөдөр хэдэн AI зураг үүсгэсэн бэ */
export async function imagesToday(now = new Date()): Promise<number> {
  const { start, end } = ubDayRange(now);
  return prisma.article.count({
    where: { fbImageKind: "ai", fbImageAt: { gte: start, lt: end } },
  });
}

interface ArticleForImage {
  id: string;
  titleMn: string | null;
  summaryMn: string | null;
  category: keyof typeof CATEGORY_SCENE_HINT;
  sourceImageUrl: string | null;
  source: { name: string };
}

/** Сүүлийн постуудын зургийн prompt — давхардахгүй байх */
export async function recentImagePrompts(limit = RECENT_SCENES): Promise<string[]> {
  const rows = await prisma.article.findMany({
    where: { fbImagePrompt: { not: null }, fbImageKind: "ai" },
    orderBy: { fbImageAt: "desc" },
    take: limit,
    select: { fbImagePrompt: true },
  });
  return rows.map((r) => r.fbImagePrompt!).filter(Boolean);
}

/**
 * Нийтлэлээс зургийн дүрслэл гаргуулж, зураг үүсгэнэ.
 * Дүрслэл хэт ерөнхий (оффис, компьютерийн ард хүн) эсвэл сүүлийн постуудтай давхарсан бол
 * шалтгааныг нь хэлж нэг удаа дахин гаргуулна.
 */
export async function generateAiImage(
  a: ArticleForImage,
  opts: { chat?: Chat; image?: ImageCall; recentPrompts?: string[] } = {},
): Promise<ImageResult> {
  const chat = opts.chat ?? chatJson;
  const image = opts.image ?? chatImage;
  const recent = opts.recentPrompts ?? [];

  const base = [
    `Category: ${a.category} (${CATEGORY_LABEL[a.category]}) — ${CATEGORY_SCENE_HINT[a.category]}.`,
    `Headline: ${a.titleMn ?? ""}`,
    `Summary: ${a.summaryMn ?? ""}`,
    recentScenesBlock(recent),
  ].filter(Boolean);

  let scene = "";
  let subject = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<{ subject: string; scene: string }>({
      model: process.env.SCORE_MODEL ?? "deepseek/deepseek-v4.1-flash",
      system: SCENE_SYSTEM,
      user: [
        ...base,
        ...(attempt === 0
          ? []
          : [
              "",
              `The previous answer was rejected: "${scene}".`,
              isGenericScene(scene)
                ? "It was too generic. Name the concrete object or place from the article itself."
                : "It was too close to a recent scene. Pick a different subject and camera angle.",
            ]),
      ].join("\n"),
      schema: SCENE_SCHEMA,
      maxTokens: 400,
      temperature: attempt === 0 ? 0.6 : 0.9,
      reasoning: false,
    });
    scene = out.data.scene;
    subject = out.data.subject;
    if (!isGenericScene(scene) && !sceneTooSimilar(scene, recent)) break;
    console.warn(`  ⚠ дүрслэл ${isGenericScene(scene) ? "хэт ерөнхий" : "өмнөх зурагтай төстэй"}: ${scene}`);
  }
  console.log(`  зургийн сэдэв: ${subject}`);

  const prompt = buildImagePrompt(scene);
  const model = imageModel();
  let out;
  try {
    out = await image({ model, prompt });
  } catch (e) {
    // Үндсэн модель унасан (лимит, буулгасан) — нөөц моделиор нэг удаа
    console.warn(`  ⚠ ${model}: ${(e as Error).message.slice(0, 120)} — ${FALLBACK_IMAGE_MODEL} оролдоно`);
    out = await image({ model: FALLBACK_IMAGE_MODEL, prompt });
  }

  return { buffer: await squareJpeg(out.buffer), kind: "ai", prompt, costUsd: out.costUsd };
}

/** Эх нийтлэлийн og:image-ийг татаж credit-тэй болгоно */
export async function sourceImage(a: ArticleForImage): Promise<ImageResult | null> {
  if (!a.sourceImageUrl) return null;
  try {
    const res = await fetch(a.sourceImageUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const square = await squareJpeg(Buffer.from(await res.arrayBuffer()));
    return { buffer: await withCredit(square, a.source.name), kind: "source", prompt: null, costUsd: 0 };
  } catch (e) {
    console.warn(`  ⚠ эх сурвалжийн зураг татагдсангүй: ${(e as Error).message.slice(0, 100)}`);
    return null;
  }
}

/** Өдрийн жагсаалтын карт — топ 5, өсөлт/уналт, лого */
export async function rankingCard(now = new Date()): Promise<ImageResult | null> {
  const { date, rows } = await getLatestLeaderboard("OPENROUTER_USAGE", 5);
  if (rows.length < 5) return null;
  const cardRows: RankingRow[] = rows.map((r) => ({
    rank: r.rank,
    name: r.model.name,
    company: r.company.name,
    rankDelta: r.rankDelta,
  }));
  const svg = rankingCardSvg(cardRows, ubDateLabel(date ?? now));
  const buffer = await sharp(Buffer.from(svg))
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return { buffer, kind: "ranking", prompt: null, costUsd: 0 };
}

/** Зургийг нийтлэлд хадгална */
export async function saveImage(articleId: string, r: ImageResult): Promise<string> {
  const url = `/api/fb-image/${articleId}`;
  await prisma.article.update({
    where: { id: articleId },
    data: {
      // Prisma Bytes нь Uint8Array<ArrayBuffer> хүлээдэг — Buffer-ийг хөрвүүлнэ
      fbImageData: new Uint8Array(r.buffer),
      fbImageUrl: url,
      fbImageKind: r.kind,
      fbImagePrompt: r.prompt,
      fbImageAt: new Date(),
    },
  });
  return url;
}

/**
 * Нийтлэлд зураг бэлдэнэ: тохиргооноос хамаарч эх сурвалжийн зураг эсвэл AI зураг.
 * Алдаа гарвал null — дуудагч нь link post руу буцна.
 */
export async function imageForArticle(
  articleId: string,
  opts: { chat?: Chat; image?: ImageCall; now?: Date; force?: boolean; recentPrompts?: string[] } = {},
): Promise<ImageResult | null> {
  const now = opts.now ?? new Date();
  const a = (await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    select: {
      id: true, titleMn: true, summaryMn: true, category: true, sourceImageUrl: true,
      source: { select: { name: true } },
    },
  })) as ArticleForImage;

  if (useSourceImage()) {
    const fromSource = await sourceImage(a);
    if (fromSource) return fromSource;
    // og:image байхгүй бол AI зураг руу шилжинэ
  }

  const limit = imageDailyLimit();
  const used = await imagesToday(now);
  if (!opts.force && used >= limit) {
    console.warn(`  ⚠ өдрийн зургийн хязгаар дүүрсэн (${used}/${limit}) — зураггүй постлоно`);
    return null;
  }

  try {
    return await generateAiImage(a, { ...opts, recentPrompts: opts.recentPrompts ?? (await recentImagePrompts()) });
  } catch (e) {
    console.warn(`  ⚠ зураг үүссэнгүй: ${(e as Error).message.slice(0, 150)}`);
    return null;
  }
}

if (process.argv[1]?.endsWith("fbimage.ts")) {
  const outArg = process.argv.indexOf("--out");
  const out = outArg > -1 ? process.argv[outArg + 1] : null;

  const result = process.argv.includes("--ranking")
    ? await rankingCard()
    : await (async () => {
        const key = process.argv[2];
        if (!key) throw new Error("Хэрэглээ: npx tsx src/publish/fbimage.ts <slug> [--out файл]");
        const a = await prisma.article.findFirstOrThrow({
          where: { OR: [{ slug: key }, { id: key }] },
          select: { id: true },
        });
        const r = await imageForArticle(a.id, { force: true });
        if (r) await saveImage(a.id, r);
        return r;
      })();

  if (!result) {
    console.error("Зураг гарсангүй");
    process.exitCode = 1;
  } else {
    console.log(`${result.kind}: ${(result.buffer.length / 1024).toFixed(0)} KB, $${result.costUsd.toFixed(4)}`);
    if (result.prompt) console.log(`prompt: ${result.prompt}`);
    if (out) {
      await sharp(result.buffer).toFile(out);
      console.log(`→ ${out}`);
    }
  }
  await prisma.$disconnect();
}
