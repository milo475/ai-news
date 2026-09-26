/**
 * Нийтлэгдсэн мэдээг Facebook хуудсанд постлоно.
 *
 *   npx tsx src/publish/facebook.ts
 *
 * FB_PAGE_ACCESS_TOKEN хоосон бол юу ч хийхгүй гарна.
 *
 * Нэг run = нэг slot (FB_POSTS_PER_RUN, default 1). Slot-ыг ажилласан цагаас тодорхойлно
 * (slot.api.ts): өглөө NEWS/RISK, өдөр жагсаалтын карт эсвэл FACT/BUSINESS, орой
 * PROJECT/HOWTO/BUSINESS. Сонгосон ангиллаас олдохгүй бол дараалалын дараагийнхыг авна.
 *
 * Пост бүрт: fbText (тусдаа LLM-ээр бичсэн, байхгүй бол энд бичүүлнэ) + 1080×1080 зураг
 * → /{page-id}/photos. Зураг гараагүй бол /{page-id}/feed рүү (link preview) буцна.
 *
 * Амжилтгүй бол fbPostedAt хоосон үлдэж дараагийн run-д дахин оролдоно; 3 удаа унасан
 * нийтлэлийг fbError-той нь дараалалаас гаргана.
 */
import "dotenv/config";
import { prisma } from "../db";
import type { ArticleCategory } from "../generated/prisma/enums";
import { ubDateLabel } from "../jobs/day";
import { jobRunMeta } from "../jobs/meta";
import { articleLink, buildPost, MAX_ATTEMPTS, postsPerRun } from "./facebook.api";
import { generateFbCopy } from "./fbcopy";
import { cardForArticle, saveCard } from "./card";
import { recentImagePrompts, rankingCard } from "./fbimage";
import { slotPlan } from "./slot.api";
import { siteUrl } from "../lib/site";

const GRAPH = "https://graph.facebook.com/v21.0";
/** Нэг run дотор хэд хэдэн пост явбал хооронд нь завсарлана */
const GAP_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function credentials(): { pageId: string; token: string } {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN тохируулаагүй байна");
  return { pageId, token };
}

interface GraphOut { id?: string; post_id?: string; error?: { message?: string } }

async function graphPost(url: string, body: FormData | string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    ...(typeof body === "string" ? { headers: { "Content-Type": "application/json" }, body } : { body }),
  });
  const json = (await res.json()) as GraphOut;
  const id = json.post_id ?? json.id;
  if (!res.ok || !id) {
    throw new Error(`Facebook ${res.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`);
  }
  return id;
}

/** Зурагтай пост — feed дээр том харагдана. post_id нь хуудасны постын id. */
export async function postPhoto(image: Buffer, caption: string): Promise<string> {
  const { pageId, token } = credentials();
  const form = new FormData();
  form.append("caption", caption);
  form.append("access_token", token);
  form.append("source", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "post.jpg");
  return graphPost(`${GRAPH}/${pageId}/photos`, form);
}

/** Зураггүй нөөц хувилбар — холбоосын preview-ээр og:image гарна */
export async function postLink(message: string, link: string): Promise<string> {
  const { pageId, token } = credentials();
  return graphPost(`${GRAPH}/${pageId}/feed`, JSON.stringify({ message, link, access_token: token }));
}

export const POSTABLE_SELECT = {
  id: true,
  slug: true,
  titleMn: true,
  summaryMn: true,
  bodyMn: true,
  fbText: true,
  fbImageData: true,
  category: true,
  models: { select: { name: true } },
  companies: { select: { name: true } },
} as const;

/** Амжилттай постыг тэмдэглэнэ */
export async function markPosted(articleId: string, fbPostId: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: { fbPostId, fbPostedAt: new Date(), fbError: null },
  });
}

/** Алдааг бүртгэнэ — MAX_ATTEMPTS хүрвэл дараалалаас гарна */
export async function markFailed(articleId: string, message: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: { fbAttempts: { increment: 1 }, fbError: message.slice(0, 300) },
  });
}

/** Постлохыг хүлээж буй нийтлэлийн тоо — /admin дээр харуулна */
export async function queueSize(): Promise<number> {
  return prisma.article.count({
    where: { status: "PUBLISHED", fbPostedAt: null, fbPostId: null, fbAttempts: { lt: MAX_ATTEMPTS } },
  });
}

export interface PublishOutcome {
  fbPostId: string;
  /** photo = зурагтай, link = зураггүй нөөц */
  kind: "photo" | "link";
  costUsd: number;
}

/**
 * Нэг нийтлэлийг постолно: текст → зураг → Facebook.
 * Зураг гарахгүй бол link пост руу буцна. Алдаа гарвал throw (дуудагч нь markFailed хийнэ).
 */
export async function publishArticleToFacebook(
  articleId: string,
  opts: { now?: Date } = {},
): Promise<PublishOutcome> {
  const a = await prisma.article.findUniqueOrThrow({ where: { id: articleId }, select: POSTABLE_SELECT });

  // FB текст: agent-ийн хураангуйг биш, FB-д зориулж бичсэнийг хэрэглэнэ
  let text = a.fbText;
  if (!text) text = (await generateFbCopy(a.id)).text;

  const link = articleLink(a.slug);
  let costUsd = 0;

  // БЭЛТГЭХ горимд үүсгэсэн карт байвал түүнийг шууд ашиглана — дахин үүсгэхгүй,
  // өдрийн зургийн квотоос ч идэхгүй. Байхгүй бол энд үүсгэнэ.
  let photo: Buffer | null = a.fbImageData ? Buffer.from(a.fbImageData) : null;
  if (!photo) {
    try {
      const built = await cardForArticle(a.id, { recentPrompts: await recentImagePrompts() });
      await saveCard(a.id, built);
      costUsd = built.costUsd;
      photo = built.card;
    } catch (e) {
      console.warn(`  ⚠ карт үүссэнгүй: ${(e as Error).message.slice(0, 150)}`);
    }
  }

  if (photo) {
    try {
      return { fbPostId: await postPhoto(photo, text), kind: "photo", costUsd };
    } catch (e) {
      // Зурагтай пост амжилтгүй (хэмжээ, эрх) — текстээ алдалгүй link постоор
      console.warn(`  ⚠ зурагтай пост унасан: ${(e as Error).message.slice(0, 120)} — link постоор оролдоно`);
    }
  }

  // Нөөц: холбоосын preview (og:image)
  const message = text ?? buildPost({
    titleMn: a.titleMn, summaryMn: a.summaryMn, bodyMn: a.bodyMn, link,
    modelNames: a.models.map((m) => m.name), companyNames: a.companies.map((c) => c.name),
  });
  return { fbPostId: await postLink(message, link), kind: "link", costUsd };
}

/** Өнөөдөр жагсаалтын карт тавьсан уу */
export async function rankingPostedToday(now: Date): Promise<boolean> {
  const row = await prisma.fbRankingPost.findUnique({ where: { day: ubDateLabel(now) } });
  return row !== null;
}

/** Жагсаалтын карт постолно (нийтлэлтэй холбоогүй). Жагсаалт бэлэн биш бол false. */
export async function postRankingCard(now = new Date()): Promise<boolean> {
  const card = await rankingCard(now);
  if (!card) {
    console.log("Жагсаалт бэлэн биш — карт тавихгүй");
    return false;
  }
  const site = siteUrl();
  const caption = [
    `Өнөөдрийн хэрэглээний топ 5 — аль AI моделийг хамгийн их ашиглаж байна вэ.`,
    `Жагсаалт өдөр бүр шинэчлэгддэг: өсөлт, уналтыг өмнөх өдөртэй харьцуулж харуулна.`,
    `Дэлгэрэнгүй: ${site}/jagsaalt`,
    `#AI #ХиймэлОюун #Жагсаалт`,
  ].join("\n\n");

  const fbPostId = await postPhoto(card.buffer, caption);
  await prisma.fbRankingPost.create({ data: { day: ubDateLabel(now), fbPostId } });
  console.log(`✓ жагсаалтын карт → ${fbPostId}`);
  return true;
}

/**
 * Бенчмаркийн топ 5 карт — сард нэг удаа, шинэ хэмжилт гарсны дараа.
 *
 * Аль хэдийн тавигдсан, эсвэл дүн бэлэн биш бол false буцаана.
 */
export async function postBenchCard(): Promise<boolean> {
  const { benchCard } = await import("./fbimage");
  const card = await benchCard();
  if (!card) return false;

  // Сар бүр нэг удаа — өдрийн картаас тусдаа түлхүүрээр
  const key = `bench-${card.month}`;
  if (await prisma.fbRankingPost.findUnique({ where: { day: key } })) return false;

  const { latestBoard } = await import("../bench/queries");
  const board = await latestBoard();
  if (!board) return false;

  const site = siteUrl();
  const best = board.rows[0]!;
  const caption = [
    `${board.label}: монгол хэлээр хамгийн сайн ажилласан AI модель бол ${best.name}.`,
    `${board.rows.length} моделийг монгол хэлний ${board.taskCount} бодит даалгавраар тестэллээ — ` +
      `орчуулга, товчлол, албан бичиг, тоон бодлого, монгол соёлын мэдлэг. Оноо 0-10.`,
    `Бүтэн эрэмбэ, аргачлал: ${site}/benchmark`,
    `#AI #ХиймэлОюун #МонголХэл`,
  ].join("\n\n");

  const fbPostId = await postPhoto(card.buffer, caption);
  await prisma.fbRankingPost.create({ data: { day: key, fbPostId } });
  console.log(`✓ бенчмаркийн карт → ${fbPostId}`);
  return true;
}

/** Slot-ын ангиллаар эрэмбэлсэн дараалал — сонгосон ангиллаас олдохгүй бол бусдаас */
async function queueForSlot(categories: ArticleCategory[], take: number) {
  const base = {
    status: "PUBLISHED" as const,
    fbPostedAt: null,
    fbPostId: null,
    fbAttempts: { lt: MAX_ATTEMPTS },
    titleMn: { not: null },
  };
  const order = [{ publishedAt: "desc" as const }, { relevance: "desc" as const }];

  const preferred = await prisma.article.findMany({
    where: { ...base, category: { in: categories } },
    orderBy: order,
    take,
    select: POSTABLE_SELECT,
  });
  if (preferred.length >= take) return preferred;

  const rest = await prisma.article.findMany({
    where: { ...base, id: { notIn: preferred.map((p) => p.id) } },
    orderBy: order,
    take: take - preferred.length,
    select: POSTABLE_SELECT,
  });
  return [...preferred, ...rest];
}

export interface PostPendingResult {
  posted: number;
  failed: number;
  skipped: boolean;
  queue: number;
  /** Энэ run ямар slot дээр ажилласан */
  slot: string;
  costUsd: number;
}

/** Тухайн slot-ын постыг тавина */
export async function postPending(now = new Date()): Promise<PostPendingResult> {
  const plan = slotPlan(now);
  if (!process.env.FB_PAGE_ACCESS_TOKEN) {
    console.log("FB тохируулаагүй, алгасав");
    return { posted: 0, failed: 0, skipped: true, queue: 0, slot: plan.slot, costUsd: 0 };
  }
  const perRun = postsPerRun();
  if (perRun === 0) {
    console.log("FB_POSTS_PER_RUN=0, алгасав");
    return { posted: 0, failed: 0, skipped: true, queue: await queueSize(), slot: plan.slot, costUsd: 0 };
  }

  const run = await prisma.jobRun.create({ data: { job: "facebook", ...jobRunMeta() } });
  let posted = 0;
  let failed = 0;
  let costUsd = 0;

  try {
    console.log(`Slot: ${plan.slot} (${plan.categories.join("/")}${plan.ranking ? " + жагсаалтын карт" : ""})`);

    // Өдрийн slot дээр долоо хоногийн 3 өдөр жагсаалтын карт тавина — нийтлэлийн оронд
    if (plan.ranking && !(await rankingPostedToday(now))) {
      try {
        if (await postRankingCard(now)) posted++;
      } catch (e) {
        failed++;
        console.error(`✗ жагсаалтын карт: ${(e as Error).message}`);
      }
    }

    if (posted === 0) {
      const articles = await queueForSlot(plan.categories, perRun);
      console.log(`Дараалалд ${await queueSize()} нийтлэл, энэ удаа ${articles.length} постлоно...`);

      for (const [i, a] of articles.entries()) {
        try {
          const out = await publishArticleToFacebook(a.id, { now });
          costUsd += out.costUsd;
          await markPosted(a.id, out.fbPostId);
          posted++;
          console.log(`✓ [${a.category}] ${a.titleMn} → ${out.fbPostId} (${out.kind})`);
        } catch (e) {
          const message = (e as Error).message;
          await markFailed(a.id, message);
          failed++;
          console.error(`✗ ${a.titleMn}: ${message}`);
        }
        if (i < articles.length - 1) await sleep(GAP_MS);
      }
    }

    const queue = await queueSize();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), ok: failed === 0 || posted > 0,
        itemsIn: queue + posted, itemsOut: posted,
        attempted: posted + failed, failed,
        costUsd, error: failed > 0 ? `${failed} пост амжилтгүй` : null,
      },
    });
    if (costUsd > 0) console.log(`Зургийн зардал: $${costUsd.toFixed(4)}`);
    return { posted, failed, skipped: false, queue, slot: plan.slot, costUsd };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 500), costUsd },
    });
    throw e;
  }
}

if (process.argv[1]?.endsWith("facebook.ts")) {
  postPending()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
