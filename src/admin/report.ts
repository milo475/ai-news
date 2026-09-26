/**
 * Долоо хоногийн админ тайланг цуглуулж имэйлээр илгээнэ.
 *
 *   npx tsx src/admin/report.ts          # илгээнэ
 *   npx tsx src/admin/report.ts --dry    # зөвхөн текстээр хэвлэнэ
 *
 * Хаяг: ADMIN_EMAIL (эсвэл дутуу бол алгасна). Ням гарагт pipeline дуудна.
 */
import { prisma } from "@/db";
import { weekLabel } from "@/agent/digest.api";
import { isConfigured, sendOne } from "@/newsletter/mailer";
import { recentErrors } from "@/lib/errors";
import { shortMessage } from "@/lib/errors.api";
import { absUrl } from "@/lib/site";
import { delta, renderReport, type ReportSection } from "./report.api";

export interface ReportResult {
  skipped?: boolean;
  reason?: string;
  sent?: boolean;
  subject?: string;
  text?: string;
}

function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL?.trim() || null;
}

/** Хоёр долоо хоногийн тоо — одоогийнх ба өмнөх */
function ranges(now: Date) {
  const weekMs = 7 * 86_400_000;
  return {
    thisWeek: { gte: new Date(now.getTime() - weekMs), lt: now },
    lastWeek: { gte: new Date(now.getTime() - 2 * weekMs), lt: new Date(now.getTime() - weekMs) },
    from: new Date(now.getTime() - weekMs),
    to: now,
  };
}

export async function buildReport(now = new Date()) {
  const { thisWeek, lastWeek, from, to } = ranges(now);

  const [
    pubNow, pubPrev, localNow, localPrev,
    fbNow, fbPrev, igNow, igPrev,
    usersNow, usersPrev, usersTotal,
    subsNow, subsTotal,
    guidesNow, promptsNow, toolsNow, reviewsNow,
    pendingPrompts, pendingTools, pendingReviews,
    costNow, costPrev,
    failedRuns, errs,
    searchNow, emptyNow,
    quizNow,
  ] = await Promise.all([
    prisma.article.count({ where: { status: "PUBLISHED", publishedAt: thisWeek } }),
    prisma.article.count({ where: { status: "PUBLISHED", publishedAt: lastWeek } }),
    prisma.article.count({ where: { status: "PUBLISHED", region: "MN", publishedAt: thisWeek } }),
    prisma.article.count({ where: { status: "PUBLISHED", region: "MN", publishedAt: lastWeek } }),

    prisma.article.count({ where: { fbPostedAt: thisWeek } }),
    prisma.article.count({ where: { fbPostedAt: lastWeek } }),
    prisma.article.count({ where: { igPostedAt: thisWeek } }),
    prisma.article.count({ where: { igPostedAt: lastWeek } }),

    prisma.user.count({ where: { createdAt: thisWeek } }),
    prisma.user.count({ where: { createdAt: lastWeek } }),
    prisma.user.count(),

    prisma.subscriber.count({ where: { createdAt: thisWeek } }),
    prisma.subscriber.count({ where: { status: "ACTIVE" } }),

    prisma.guide.count({ where: { status: "PUBLISHED", publishedAt: thisWeek } }),
    prisma.prompt.count({ where: { status: "PUBLISHED", publishedAt: thisWeek } }),
    prisma.tool.count({ where: { status: "PUBLISHED", createdAt: thisWeek } }),
    prisma.toolReview.count({ where: { createdAt: thisWeek } }),

    prisma.prompt.count({ where: { status: "PENDING" } }),
    prisma.tool.count({ where: { status: "PENDING" } }),
    prisma.toolReview.count({ where: { status: "PENDING" } }),

    prisma.jobRun.aggregate({ _sum: { costUsd: true }, where: { startedAt: thisWeek } }),
    prisma.jobRun.aggregate({ _sum: { costUsd: true }, where: { startedAt: lastWeek } }),

    prisma.jobRun.count({ where: { ok: false, startedAt: thisWeek } }),
    recentErrors(5),

    prisma.searchLog.count({ where: { createdAt: thisWeek } }),
    prisma.searchLog.count({ where: { createdAt: thisWeek, resultCount: 0 } }),

    prisma.quizResult.count({ where: { createdAt: thisWeek } }),
  ]);

  const cost = (v: { toString(): string } | null) => (v ? Number(v.toString()) : 0);
  const costThis = cost(costNow._sum.costUsd);
  const costLast = cost(costPrev._sum.costUsd);

  const sections: ReportSection[] = [
    {
      heading: "Контент",
      rows: [
        { label: "Нийтэлсэн мэдээ", value: String(pubNow), delta: delta(pubNow, pubPrev) },
        { label: "Монголын мэдээ", value: String(localNow), delta: delta(localNow, localPrev) },
        { label: "Шинэ заавар", value: String(guidesNow) },
        { label: "Шинэ prompt", value: String(promptsNow) },
        { label: "Шинэ хэрэгсэл", value: String(toolsNow) },
      ],
    },
    {
      heading: "Нийгмийн сүлжээ",
      rows: [
        { label: "Facebook пост", value: String(fbNow), delta: delta(fbNow, fbPrev) },
        { label: "Instagram пост", value: String(igNow), delta: delta(igNow, igPrev) },
      ],
    },
    {
      heading: "Хэрэглэгч",
      rows: [
        { label: "Шинэ бүртгэл", value: String(usersNow), delta: delta(usersNow, usersPrev) },
        { label: "Бүртгэлтэй бүгд", value: String(usersTotal) },
        { label: "Имэйл захиалга", value: `+${subsNow}`, delta: `бүгд ${subsTotal}` },
        { label: "Шүүмж", value: String(reviewsNow) },
        { label: "Асуулга дуусгасан", value: String(quizNow) },
      ],
    },
    {
      heading: "Хайлт",
      rows: [
        { label: "Хайлт", value: String(searchNow) },
        {
          label: "Үр дүнгүй хайлт",
          value: `${emptyNow}${searchNow > 0 ? ` (${Math.round((emptyNow / searchNow) * 100)}%)` : ""}`,
          alert: searchNow > 20 && emptyNow * 4 > searchNow,
        },
      ],
    },
    {
      heading: "Зардал ба эрүүл мэнд",
      rows: [
        {
          label: "OpenRouter",
          value: `$${costThis.toFixed(2)}`,
          delta: delta(Math.round(costThis * 100), Math.round(costLast * 100)),
        },
        { label: "Унасан ажиллалт", value: String(failedRuns), alert: failedRuns > 0 },
        { label: "Бүртгэгдсэн алдаа", value: String(errs.length ? errs[0]!.count : 0), alert: errs.length > 0 },
      ],
    },
  ];

  const warnings: string[] = [];
  if (pubNow === 0) warnings.push("Долоо хоногт нэг ч мэдээ нийтлэгдээгүй — pipeline-ыг шалгана уу.");
  if (localNow === 0) warnings.push("Монголын мэдээ нийтлэгдээгүй.");
  if (failedRuns > 0) warnings.push(`${failedRuns} ажиллалт унасан (/admin → Алдаа).`);
  const pending = pendingPrompts + pendingTools + pendingReviews;
  if (pending > 0) {
    warnings.push(
      `Хүлээгдэж байна: prompt ${pendingPrompts}, хэрэгсэл ${pendingTools}, шүүмж ${pendingReviews}.`,
    );
  }
  for (const e of errs.slice(0, 3)) {
    warnings.push(`${e.source}: ${shortMessage(e.message, 90)} (${e.count}×)`);
  }

  return renderReport({
    weekLabel: weekLabel(from, to),
    sections,
    warnings,
    adminUrl: absUrl("/admin"),
  });
}

export async function sendWeeklyReport(opts: { dry?: boolean } = {}): Promise<ReportResult> {
  const to = adminEmail();
  if (!to) return { skipped: true, reason: "ADMIN_EMAIL тохируулаагүй" };

  const mail = await buildReport();
  if (opts.dry) return { skipped: true, reason: "dry run", subject: mail.subject, text: mail.text };
  if (!isConfigured()) return { skipped: true, reason: "RESEND_API_KEY алга" };

  const sent = await sendOne({ to, subject: mail.subject, html: mail.html, text: mail.text });
  return { sent, subject: mail.subject };
}

if (process.argv[1]?.endsWith("report.ts")) {
  const dry = process.argv.includes("--dry");
  sendWeeklyReport({ dry })
    .then((r) => {
      if (r.text) console.log(r.text);
      console.log(r.skipped ? `алгасав: ${r.reason}` : r.sent ? "✓ илгээв" : "✗ илгээгдсэнгүй");
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
