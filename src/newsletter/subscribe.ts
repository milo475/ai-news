/**
 * Бүртгэлийн урсгал — double opt-in.
 * Имэйл давхардвал алдаа биш: баталгаажуулах холбоосыг дахин илгээнэ
 * (аль имэйл бүртгэлтэй болохыг гадуур мэдэхээс сэргийлнэ).
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { isConfigured, sendOne } from "./mailer";
import { siteUrl as url } from "../lib/site";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export function siteUrl(): string {
  return url();
}

function token(): string {
  return randomBytes(24).toString("base64url");
}

function confirmMail(email: string, confirmToken: string) {
  const url = `${siteUrl()}/api/newsletter/confirm?token=${confirmToken}`;
  return {
    to: email,
    subject: "AI News — имэйлээ баталгаажуулна уу",
    text: `AI News-ийн долоо хоногийн тойм авахыг баталгаажуулна уу:\n\n${url}\n\nХэрэв та бүртгүүлээгүй бол энэ захиаг үл тоомсорлоно уу.`,
    html: `<!doctype html><html lang="mn"><body style="margin:0;background:#f7f6f2;padding:24px 12px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#1b1b23">
<table role="presentation" width="100%"><tr><td align="center">
<table role="presentation" style="max-width:520px;background:#fff;border:1px solid #e3e1db;border-radius:12px;padding:28px">
<tr><td>
  <p style="margin:0 0 14px;font:800 20px/1 -apple-system,Segoe UI,Roboto,sans-serif">AI<span style="color:#4f46e5"> News</span></p>
  <p style="margin:0 0 18px">AI News-ийн долоо хоногийн тойм авахыг баталгаажуулна уу.</p>
  <p style="margin:0 0 20px"><a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">Баталгаажуулах</a></p>
  <p style="margin:0;color:#6b6b76;font-size:12px">Хэрэв та бүртгүүлээгүй бол энэ захиаг үл тоомсорлоно уу.</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}

export interface SubscribeResult {
  ok: boolean;
  message: string;
}

/** Нэг мессеж — имэйл шинэ ч, бүртгэлтэй ч ялгаагүй (enumeration хамгаалалт) */
const SENT = "Баталгаажуулах холбоосыг имэйлээр илгээлээ. Шуудангаа шалгана уу.";

export async function subscribe(rawEmail: string): Promise<SubscribeResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, message: "Имэйл хаяг буруу байна." };
  const email = parsed.data;

  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing?.status === "ACTIVE") {
    return { ok: true, message: "Та аль хэдийн бүртгэлтэй байна." };
  }

  const confirmToken = token();
  if (existing) {
    // PENDING эсвэл UNSUBSCRIBED — шинэ токен өгөөд дахин урина
    await prisma.subscriber.update({
      where: { id: existing.id },
      data: { status: "PENDING", confirmToken, confirmedAt: null },
    });
  } else {
    await prisma.subscriber.create({
      data: { email, confirmToken, unsubscribeToken: token() },
    });
  }

  if (isConfigured()) await sendOne(confirmMail(email, confirmToken));
  else console.log(`RESEND_API_KEY алга — баталгаажуулах холбоос: ${siteUrl()}/api/newsletter/confirm?token=${confirmToken}`);

  return { ok: true, message: SENT };
}

export async function confirm(token: string): Promise<boolean> {
  const s = await prisma.subscriber.findUnique({ where: { confirmToken: token } });
  if (!s) return false;
  await prisma.subscriber.update({
    where: { id: s.id },
    data: { status: "ACTIVE", confirmedAt: new Date(), confirmToken: null },
  });
  return true;
}

export async function unsubscribe(token: string): Promise<boolean> {
  const s = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!s) return false;
  await prisma.subscriber.update({ where: { id: s.id }, data: { status: "UNSUBSCRIBED" } });
  return true;
}
