/**
 * Resend-ээр имэйл илгээх нимгэн давхарга.
 * RESEND_API_KEY байхгүй бол илгээхгүй — дуудагч нь алгасна.
 */
import { siteHost } from "../lib/site";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: number;
  failed: number;
}

/** Нэг дуудлагад илгээх дээд тоо (Resend batch API) */
export const BATCH_SIZE = 100;

export function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function from(): string {
  return process.env.NEWSLETTER_FROM ?? `AI News <noreply@${siteHost()}>`;
}

/** Дуудагч нь тестэд өөрийн илгээгчээр солино */
export type Sender = (mails: Mail[]) => Promise<SendResult>;

export const resendSender: Sender = async (mails) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, failed: mails.length };

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const replyTo = process.env.NEWSLETTER_REPLY_TO;

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < mails.length; i += BATCH_SIZE) {
    const chunk = mails.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await resend.batch.send(
        chunk.map((m) => ({
          from: from(),
          to: [m.to],
          subject: m.subject,
          html: m.html,
          text: m.text,
          ...(replyTo ? { replyTo } : {}),
        })),
      );
      if (error) {
        failed += chunk.length;
        console.error(`✗ batch ${i / BATCH_SIZE + 1}: ${error.message}`);
      } else {
        sent += chunk.length;
      }
    } catch (e) {
      failed += chunk.length;
      console.error(`✗ batch ${i / BATCH_SIZE + 1}: ${(e as Error).message}`);
    }
  }
  return { sent, failed };
};

/** Нэг имэйл (баталгаажуулах захиа) */
export async function sendOne(mail: Mail): Promise<boolean> {
  const r = await resendSender([mail]);
  return r.sent > 0;
}
