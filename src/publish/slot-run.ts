/**
 * НИЙТЛЭХ горимын нэг slot — бэлэн нийтлэлийг сайтад гаргаад тэр дор нь FB-д постлоно.
 *
 *   npx tsx src/publish/slot-run.ts
 *
 * Дараалал:
 *   1. Жагсаалтын картын өдөр (Мя/Пү/Ням, өдрийн slot) бол картаа постлоод дуусна.
 *   2. Өдрийн квот (DAILY_PUBLISH_LIMIT) дүүрээгүй бол бэлэн (readyAt) DRAFT-уудаас
 *      slot-ын ангилал ба квотын дүрмээр 1-ийг сонгож PUBLISHED болгоно.
 *      Бэлэн нийтлэл байхгүй бол ердийн DRAFT-аас сонгоно (текст/зураг тэр дор нь үүснэ).
 *   3. Тэр нийтлэлийг шууд FB-д постлоно (бэлдсэн fbText + fbImageData-г ашиглана).
 *   4. Нийтлэх юм байхгүй бол дараалалд хүлээж буй постоор slot-оо дүүргэнэ.
 */
import "dotenv/config";
import { publishedToday, pickForSlot } from "../agent/quota";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { dailyPublishLimit } from "../agent/quota.api";
import {
  markFailed, markPosted, postPending, postRankingCard, publishArticleToFacebook, queueSize,
  rankingPostedToday,
} from "./facebook";
import { slotPlan } from "./slot.api";

export interface SlotResult {
  slot: string;
  /** Юу хийсэн: ranking | article | queue | none */
  action: "ranking" | "article" | "queue" | "none";
  detail: string;
  costUsd: number;
}

/** Нэг slot-ын ажил */
export async function runPublishSlot(now = new Date()): Promise<SlotResult> {
  const plan = slotPlan(now);
  const run = await prisma.jobRun.create({ data: { job: "publish", ...jobRunMeta() } });
  let costUsd = 0;

  const finish = async (r: Omit<SlotResult, "slot" | "costUsd">, ok = true): Promise<SlotResult> => {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), ok,
        itemsIn: await queueSize(), itemsOut: r.action === "none" ? 0 : 1,
        attempted: 1, failed: ok ? 0 : 1,
        costUsd, error: ok ? null : r.detail.slice(0, 500),
      },
    });
    return { slot: plan.slot, costUsd, ...r };
  };

  console.log(`Slot: ${plan.slot} (${plan.categories.join("/")}${plan.ranking ? " + жагсаалтын карт" : ""})`);

  // 1. Жагсаалтын картын өдөр — картаа тавиад дуусна
  if (plan.ranking && !(await rankingPostedToday(now))) {
    try {
      if (await postRankingCard(now)) return finish({ action: "ranking", detail: "жагсаалтын карт" });
    } catch (e) {
      console.error(`✗ жагсаалтын карт: ${(e as Error).message}`);
      // Карт бүтэхгүй бол ердийн нийтлэлээр slot-оо дүүргэнэ
    }
  }

  // 2. Квотын хүрээнд нэг нийтлэл сонгоно
  const limit = dailyPublishLimit();
  const already = await publishedToday(now);
  if (already >= limit) {
    console.log(`Өдрийн квот дүүрсэн (${already}/${limit}) — дараалалаас постлоно`);
    const posted = await postPending(now);
    return finish({
      action: posted.posted > 0 ? "queue" : "none",
      detail: posted.posted > 0 ? `дараалалаас ${posted.posted} пост` : `квот ${already}/${limit}, дараалал хоосон`,
    });
  }

  const pick = await pickForSlot(now, plan.categories);
  if (!pick) {
    console.log("Нийтлэх нийтлэл олдсонгүй — дараалалаас постлоно");
    const posted = await postPending(now);
    return finish({
      action: posted.posted > 0 ? "queue" : "none",
      detail: posted.posted > 0 ? `дараалалаас ${posted.posted} пост` : "нэр дэвшигч алга",
    });
  }

  // 3. Сайтад нийтэлнэ
  const article = await prisma.article.update({
    where: { id: pick.id },
    data: { status: "PUBLISHED", publishedAt: new Date(), reviewedBy: "auto" },
    select: { id: true, slug: true, titleMn: true, relevance: true, category: true, readyAt: true },
  });
  console.log(
    `↑ PUBLISHED score=${article.relevance} ${article.category} ` +
      `"${article.titleMn}" /medee/${article.slug} (${article.readyAt ? "бэлэн" : "бэлтгэлгүй"})`,
  );

  // 4. Тэр дор нь FB-д
  try {
    const out = await publishArticleToFacebook(article.id, { now });
    costUsd += out.costUsd;
    await markPosted(article.id, out.fbPostId);
    console.log(`✓ FB: ${out.fbPostId} (${out.kind})`);
    return finish({ action: "article", detail: `${article.titleMn} → FB ${out.kind}` });
  } catch (e) {
    const message = (e as Error).message;
    await markFailed(article.id, message);
    console.error(`✗ FB: ${message}`);
    // Нийтлэл сайтад гарсан — FB нь дараалалд үлдэж дараагийн slot-д дахин оролдоно
    return finish({ action: "article", detail: `${article.titleMn} нийтлэгдсэн, FB алдаа: ${message}` }, false);
  }
}

if (process.argv[1]?.endsWith("slot-run.ts")) {
  runPublishSlot()
    .then((r) => console.log(`${r.slot}: ${r.action} — ${r.detail}`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
