/**
 * Бенчмаркийн нэг сарын үр дүнг бүрэн устгана.
 *
 *   npm run bench:reset -- --month 2026-09          — юу устахыг ХАРУУЛНА (устгахгүй)
 *   npm run bench:reset -- --month 2026-09 --yes    — үнэхээр устгана
 *   npm run bench:reset -- --month 2026-09 --yes --with-published
 *
 * Юу устах вэ: тухайн сарын BenchRun (BenchResult, BenchModelSummary нь cascade-аар
 * хамт), мөн уг run-ийн автоматаар үүсгэсэн **DRAFT** нийтлэл.
 *
 * Нийтлэгдсэн нийтлэлийг зориуд хөндөхгүй — уншигчид уншсан, FB-д тавигдсан байж
 * болно. `--with-published` гэж зөвшөөрч л байж устгана.
 */
import "dotenv/config";
import { prisma } from "../db";
import { runCli } from "../lib/cli";
import { currentMonth } from "./summary.api";
import { describePlan, isMonth, parseArgs, type Plan } from "./reset.api";

export interface ResetResult {
  month: string;
  deleted: boolean;
  plan: Plan | null;
  articleDeleted: string | null;
}

/** Юу устахыг тооцно (устгахгүй) */
export async function planReset(month: string, withPublished = false): Promise<Plan | null> {
  const run = await prisma.benchRun.findUnique({
    where: { month },
    select: {
      id: true, status: true, articleId: true,
      _count: { select: { results: true, summaries: true } },
    },
  });
  if (!run) return null;

  // articleId нь нийтлэлийн SLUG (run.ts дээр ингэж хадгалдаг)
  const article = run.articleId
    ? await prisma.article.findUnique({
        where: { slug: run.articleId },
        select: { slug: true, status: true },
      })
    : null;

  const removable = article && (article.status === "DRAFT" || withPublished);

  return {
    month,
    runId: run.id,
    status: run.status,
    results: run._count.results,
    summaries: run._count.summaries,
    articleSlug: removable ? article.slug : null,
    keptArticleSlug: article && !removable ? article.slug : null,
  };
}

export async function resetMonth(
  month: string,
  opts: { yes?: boolean; withPublished?: boolean } = {},
): Promise<ResetResult> {
  if (!isMonth(month)) throw new Error(`Сар буруу байна: "${month}" — "2026-09" хэлбэртэй байх ёстой`);

  const plan = await planReset(month, opts.withPublished);
  if (!plan) return { month, deleted: false, plan: null, articleDeleted: null };
  if (!opts.yes) return { month, deleted: false, plan, articleDeleted: null };

  // Нийтлэлийг эхэлж — run устахад articleId-ийн ул мөр алга болно
  let articleDeleted: string | null = null;
  if (plan.articleSlug) {
    await prisma.article.delete({ where: { slug: plan.articleSlug } });
    articleDeleted = plan.articleSlug;
  }
  // BenchResult, BenchModelSummary нь onDelete: Cascade
  await prisma.benchRun.delete({ where: { id: plan.runId } });

  return { month, deleted: true, plan, articleDeleted };
}

if (process.argv[1]?.endsWith("reset.ts") && process.argv[1]?.includes("bench")) {
  await runCli(async () => {
    const args = parseArgs(process.argv);
    const month = args.month ?? currentMonth();
    if (!isMonth(month)) throw new Error(`Сар буруу байна: "${month}" — жишээ: --month 2026-09`);

    const r = await resetMonth(month, { yes: args.yes, withPublished: args.withPublished });

    if (!r.plan) {
      console.log(`${month}: бенчмаркийн run олдсонгүй — устгах юм алга.`);
      return;
    }

    for (const line of describePlan(r.plan)) console.log(line);

    if (!r.deleted) {
      console.log("\nЮу ч устгасангүй. Үнэхээр устгахыг хүсвэл --yes нэмнэ үү:");
      console.log(`  npm run bench:reset -- --month ${month} --yes`);
      return;
    }

    console.log(
      `\n✓ ${month} устлаа — ${r.plan.results} үр дүн, ${r.plan.summaries} дүгнэлт` +
        (r.articleDeleted ? `, нийтлэл /medee/${r.articleDeleted}` : ""),
    );
    console.log("Дахин ажиллуулах: npm run bench -- --month " + month);
  });
}
