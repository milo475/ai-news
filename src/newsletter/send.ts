/**
 * Сүүлийн нийтлэгдсэн digest-ийг бүртгүүлсэн хүмүүст илгээнэ.
 *
 *   npm run newsletter:send
 *   npm run newsletter:send -- --dry-run          # хэнд явахыг л хэвлэнэ
 *   npm run newsletter:send -- --test=me@mail.mn  # зөвхөн тэр хаяг руу
 *
 * Нэг digest хоёр удаа илгээгдэхгүй (NewsletterSend-ээр шалгана).
 */
import "dotenv/config";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { isConfigured, resendSender, type Mail, type Sender } from "./mailer";
import { siteUrl } from "./subscribe";
import { extractSections, renderDigestEmail } from "./template";

export interface SendSummary {
  skipped: boolean;
  reason?: string;
  digestSlug?: string;
  recipients: number;
  sent: number;
  failed: number;
}

export interface SendOptions {
  dryRun?: boolean;
  /** Зөвхөн энэ хаяг руу (туршилт) — NewsletterSend бичихгүй */
  testEmail?: string;
  /** Тестэд солих илгээгч */
  sender?: Sender;
}

export async function runNewsletter(opts: SendOptions = {}): Promise<SendSummary> {
  const run = await prisma.jobRun.create({ data: { job: "newsletter", ...jobRunMeta() } });
  const done = async (s: SendSummary) => {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), ok: true,
        itemsIn: s.recipients, itemsOut: s.sent,
        attempted: s.recipients, failed: s.failed,
      },
    });
    return s;
  };

  try {
    if (!isConfigured() && !opts.dryRun && !opts.sender) {
      console.log("RESEND_API_KEY тохируулаагүй, алгасав");
      return done({ skipped: true, reason: "RESEND_API_KEY алга", recipients: 0, sent: 0, failed: 0 });
    }

    const digest = await prisma.article.findFirst({
      where: { kind: "DIGEST", status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { id: true, slug: true, titleMn: true, summaryMn: true, bodyMn: true },
    });
    if (!digest) {
      console.log("Нийтлэгдсэн digest алга, алгасав");
      return done({ skipped: true, reason: "digest алга", recipients: 0, sent: 0, failed: 0 });
    }

    const isTest = Boolean(opts.testEmail);
    if (!isTest) {
      const already = await prisma.newsletterSend.findUnique({ where: { digestArticleId: digest.id } });
      if (already) {
        console.log(`"${digest.titleMn}" аль хэдийн илгээгдсэн (${already.sentCount} хаяг), алгасав`);
        return done({ skipped: true, reason: "аль хэдийн илгээсэн", digestSlug: digest.slug, recipients: 0, sent: 0, failed: 0 });
      }
    }

    const subscribers = isTest
      ? [{ email: opts.testEmail!, unsubscribeToken: "test" }]
      : await prisma.subscriber.findMany({ where: { status: "ACTIVE" }, select: { email: true, unsubscribeToken: true } });

    const base = siteUrl();
    const url = `${base}/medee/${digest.slug}`;
    const sections = extractSections(digest.bodyMn ?? "");

    const mails: Mail[] = subscribers.map((s) => {
      const { subject, html, text } = renderDigestEmail({
        title: digest.titleMn ?? "AI-ийн долоо хоног",
        lead: digest.summaryMn ?? "",
        sections,
        url,
        unsubscribeUrl: `${base}/api/newsletter/unsubscribe?token=${s.unsubscribeToken}`,
      });
      return { to: s.email, subject, html, text };
    });

    if (opts.dryRun) {
      console.log(`[dry-run] "${digest.titleMn}" → ${mails.length} хаяг`);
      for (const m of mails.slice(0, 10)) console.log(`  ${m.to}`);
      if (mails.length > 10) console.log(`  … бас ${mails.length - 10}`);
      return done({ skipped: true, reason: "dry-run", digestSlug: digest.slug, recipients: mails.length, sent: 0, failed: 0 });
    }

    if (mails.length === 0) {
      console.log("Идэвхтэй бүртгэл алга, алгасав");
      return done({ skipped: true, reason: "бүртгэл алга", digestSlug: digest.slug, recipients: 0, sent: 0, failed: 0 });
    }

    const { sent, failed } = await (opts.sender ?? resendSender)(mails);
    if (!isTest) {
      await prisma.newsletterSend.create({
        data: { digestArticleId: digest.id, sentCount: sent, failedCount: failed },
      });
    }
    console.log(`"${digest.titleMn}" → илгээсэн ${sent}, алдаа ${failed}${isTest ? " (тест)" : ""}`);
    return done({ skipped: false, digestSlug: digest.slug, recipients: mails.length, sent, failed });
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 1000) },
    });
    throw e;
  }
}

if (process.argv[1]?.endsWith("send.ts")) {
  const testArg = process.argv.find((a) => a.startsWith("--test="));
  runNewsletter({
    dryRun: process.argv.includes("--dry-run"),
    testEmail: testArg?.slice("--test=".length),
  })
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
