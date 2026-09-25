/**
 * Постын карт үүсгэх — суурь гэрэл зураг + текст давхарлалт.
 *
 *   npx tsx src/publish/card.ts <slug> --out card.jpg
 *
 * Хоёр зураг гарна:
 *   hero — тексгүй суурь (вэб нийтлэлийн дээр 16:9-өөр огтолно)
 *   card — hero дээр gradient + headline давхарласан 1080×1350 (FB, IG)
 *
 * Headline-ыг LLM 3 хувилбараар бичиж, checkHook давсан хамгийн богиныг сонгоно.
 * 4 мөрөөс хэтэрвэл фонт 64 → 56 → 48 болж багасна; 48 дээр ч багтахгүй бол
 * headline-ыг дахин бичүүлнэ.
 */
import "dotenv/config";
// fonts нь FONTCONFIG_FILE тохируулдаг тул sharp-аас ӨМНӨ импортлоно
import "./fonts";
import sharp from "sharp";
import { CATEGORY_LABEL } from "../agent/category";
import { chatImage, chatJson } from "../agent/llm";
import { prisma } from "../db";
import {
  buildPhotoPrompt, CARD_H, CARD_W, CTA_FB, checkHook, fitHeadline, HOOK_SCHEMA, HOOK_SYSTEM,
  overlaySvg, pickHook,
} from "./card.api";
import {
  CATEGORY_SCENE_HINT, FALLBACK_IMAGE_MODEL, imageModel, isGenericScene, recentScenesBlock,
  SCENE_SCHEMA, SCENE_SYSTEM, sceneTooSimilar, useSourceImage,
} from "./fbimage.api";

const JPEG_QUALITY = 86;

type Chat = typeof chatJson;
type ImageCall = typeof chatImage;

export interface CardResult {
  /** Тексттэй карт, 1080×1350 */
  card: Buffer;
  /** Тексгүй суурь, 1080×1350 */
  hero: Buffer;
  headline: string;
  prompt: string;
  costUsd: number;
}

interface ArticleForCard {
  id: string;
  titleMn: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
  category: keyof typeof CATEGORY_SCENE_HINT;
  /** FB_USE_SOURCE_IMAGE=true үед суурь болгон хэрэглэнэ */
  sourceImageUrl?: string | null;
}

/** Эх сурвалжийн зургийг татна (FB_USE_SOURCE_IMAGE) */
async function sourceHero(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await heroJpeg(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.warn(`  ⚠ эх сурвалжийн зураг татагдсангүй: ${(e as Error).message.slice(0, 100)}`);
    return null;
  }
}

/** Суурь зургийг 1080×1350 болгоно */
export async function heroJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(CARD_W, CARD_H, { fit: "cover", position: "attention" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/** Суурь зураг дээр gradient + headline давхарлана */
export async function renderCard(hero: Buffer, headline: string, cta = CTA_FB): Promise<Buffer> {
  const fitted = fitHeadline(headline);
  if (!fitted) throw new Error(`Headline картад багтсангүй: ${headline}`);

  const overlay = Buffer.from(overlaySvg({ lines: fitted.lines, fontSize: fitted.fontSize, cta }));
  return sharp(hero)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/** Нийтлэлээс headline бичүүлнэ — 3 хувилбараас хамгийн богиныг */
export async function writeHeadline(
  a: ArticleForCard,
  opts: { chat?: Chat } = {},
): Promise<{ headline: string; costUsd: number }> {
  const chat = opts.chat ?? chatJson;
  let costUsd = 0;
  let problems: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<{ hooks: string[] }>({
      model: process.env.WRITE_MODEL ?? "google/gemini-3.8-flash",
      system: HOOK_SYSTEM,
      user: [
        `Гарчиг: ${a.titleMn ?? ""}`,
        `Хураангуй: ${a.summaryMn ?? ""}`,
        `Нийтлэл: ${(a.bodyMn ?? "").slice(0, 1_500)}`,
        ...(attempt === 0 ? [] : ["", `Өмнөх оролдлого амжилтгүй: ${problems.join("; ")}`]),
      ].join("\n"),
      schema: HOOK_SCHEMA,
      maxTokens: 3_000,
      temperature: attempt === 0 ? 0.6 : 0.9,
      reasoning: false,
    });
    costUsd += out.costUsd;

    const picked = pickHook(out.data.hooks ?? []);
    if (picked) return { headline: picked, costUsd };
    problems = (out.data.hooks ?? []).flatMap((h) => checkHook(h).map((p) => `"${h.slice(0, 40)}" — ${p.detail}`));
    console.warn(`  ⚠ headline тохирсонгүй: ${problems.slice(0, 3).join("; ")}`);
  }
  throw new Error("Headline бичигдсэнгүй (шалгуур давсангүй)");
}

/** Нийтлэлээс зургийн дүрслэл гаргуулна (ерөнхий/давхардсаныг нэг удаа дахин) */
async function writeScene(
  a: ArticleForCard,
  recent: string[],
  chat: Chat,
): Promise<{ scene: string; subject: string; costUsd: number }> {
  const base = [
    `Category: ${a.category} (${CATEGORY_LABEL[a.category]}) — ${CATEGORY_SCENE_HINT[a.category]}.`,
    `Headline: ${a.titleMn ?? ""}`,
    `Summary: ${a.summaryMn ?? ""}`,
    recentScenesBlock(recent),
  ].filter(Boolean);

  let scene = "";
  let subject = "";
  let costUsd = 0;

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
    costUsd += out.costUsd;
    scene = out.data.scene;
    subject = out.data.subject;
    if (!isGenericScene(scene) && !sceneTooSimilar(scene, recent)) break;
    console.warn(`  ⚠ дүрслэл ${isGenericScene(scene) ? "хэт ерөнхий" : "өмнөхтэй төстэй"}: ${scene}`);
  }
  return { scene, subject, costUsd };
}

/**
 * Нийтлэлд карт бэлдэнэ: дүрслэл → суурь зураг → headline → давхарлалт.
 * @param opts.headline бэлэн headline (/admin-аас засаж дахин үүсгэхэд)
 */
export async function buildCard(
  a: ArticleForCard,
  opts: { chat?: Chat; image?: ImageCall; recentPrompts?: string[]; headline?: string; cta?: string } = {},
): Promise<CardResult> {
  const chat = opts.chat ?? chatJson;
  const image = opts.image ?? chatImage;
  let costUsd = 0;

  // FB_USE_SOURCE_IMAGE=true бол эх нийтлэлийн зургийг суурь болгоно (зардалгүй)
  let hero: Buffer | null = null;
  let prompt = "эх сурвалжийн зураг";
  if (useSourceImage() && a.sourceImageUrl) hero = await sourceHero(a.sourceImageUrl);

  if (!hero) {
    const { scene, subject, costUsd: sceneCost } = await writeScene(a, opts.recentPrompts ?? [], chat);
    costUsd += sceneCost;
    console.log(`  зургийн сэдэв: ${subject}`);

    prompt = buildPhotoPrompt(scene);
    const model = imageModel();
    let out;
    try {
      out = await image({ model, prompt });
    } catch (e) {
      console.warn(`  ⚠ ${model}: ${(e as Error).message.slice(0, 120)} — ${FALLBACK_IMAGE_MODEL} оролдоно`);
      out = await image({ model: FALLBACK_IMAGE_MODEL, prompt });
    }
    costUsd += out.costUsd;
    hero = await heroJpeg(out.buffer);
  }

  let headline = opts.headline?.trim() ?? "";
  if (!headline) {
    const written = await writeHeadline(a, { chat });
    headline = written.headline;
    costUsd += written.costUsd;
  }
  console.log(`  headline: ${headline}`);

  return { card: await renderCard(hero, headline, opts.cta), hero, headline, prompt, costUsd };
}

/** Картыг DB-д хадгална (карт + суурь + headline + prompt) */
export async function saveCard(articleId: string, r: CardResult): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: {
      fbImageData: new Uint8Array(r.card),
      fbImageUrl: `/api/fb-image/${articleId}`,
      heroImageData: new Uint8Array(r.hero),
      heroImageUrl: `/api/hero-image/${articleId}`,
      fbImageKind: "card",
      fbImagePrompt: r.prompt,
      fbImageAt: new Date(),
      fbHook: r.headline,
    },
  });
}

/** Нийтлэлийн id-гаар карт үүсгэнэ */
export async function cardForArticle(
  articleId: string,
  opts: { chat?: Chat; image?: ImageCall; recentPrompts?: string[]; headline?: string } = {},
): Promise<CardResult> {
  const a = (await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    select: {
      id: true, titleMn: true, summaryMn: true, bodyMn: true, category: true, sourceImageUrl: true,
    },
  })) as ArticleForCard;
  return buildCard(a, opts);
}

if (process.argv[1]?.endsWith("card.ts")) {
  const key = process.argv[2];
  const outArg = process.argv.indexOf("--out");
  const out = outArg > -1 ? process.argv[outArg + 1] : null;
  if (!key) {
    console.error("Хэрэглээ: npx tsx src/publish/card.ts <slug|id> [--out файл]");
    process.exit(1);
  }
  const found = await prisma.article.findFirstOrThrow({
    where: { OR: [{ slug: key }, { id: key }] },
    select: { id: true, titleMn: true },
  });
  const { recentImagePrompts } = await import("./fbimage");
  const r = await cardForArticle(found.id, { recentPrompts: await recentImagePrompts() });
  await saveCard(found.id, r);
  console.log(`card ${(r.card.length / 1024).toFixed(0)} KB, hero ${(r.hero.length / 1024).toFixed(0)} KB, $${r.costUsd.toFixed(4)}`);
  if (out) {
    await sharp(r.card).toFile(out);
    await sharp(r.hero).toFile(out.replace(/\.jpg$/, "-hero.jpg"));
    console.log(`→ ${out}`);
  }
  await prisma.$disconnect();
}
