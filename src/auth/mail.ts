/**
 * Хэрэглэгчийн имэйлүүд — баталгаажуулах, нууц үг сэргээх.
 *
 * RESEND_API_KEY тохируулаагүй бол (dev) холбоосыг консолд хэвлэнэ — бүртгэл зогсохгүй.
 */
import { isConfigured, sendOne } from "../newsletter/mailer";
import { siteUrl } from "../newsletter/subscribe";
import { RESET_HOURS, VERIFY_HOURS } from "./tokens";

function wrap(title: string, body: string, button: { href: string; label: string }): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:32rem;line-height:1.6">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  ${body}
  <p style="margin:24px 0">
    <a href="${button.href}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${button.label}</a>
  </p>
  <p style="font-size:13px;color:#6b6b76">Товч ажиллахгүй бол энэ хаягийг хуулж хөтөч дээрээ нээнэ үү:<br>
    <a href="${button.href}">${button.href}</a></p>
  <p style="font-size:13px;color:#6b6b76">Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу.</p>
</div>`;
}

/** Баталгаажуулах холбоос илгээнэ. Илгээгдээгүй бол false (dev-д консолд гарна). */
export async function sendVerifyEmail(email: string, token: string, name?: string | null): Promise<boolean> {
  const href = `${siteUrl()}/batalgaajuulah/${token}`;
  if (!isConfigured()) {
    console.log(`\n[dev] Баталгаажуулах холбоос (${email}):\n  ${href}\n`);
    return false;
  }
  return sendOne({
    to: email,
    subject: "AI News — имэйлээ баталгаажуулна уу",
    text: `Имэйлээ баталгаажуулна уу: ${href}`,
    html: wrap(
      `Тавтай морил${name ? `, ${name}` : ""}!`,
      `<p>Бүртгэлээ дуусгахын тулд имэйл хаягаа баталгаажуулна уу. Холбоос ${VERIFY_HOURS} цаг хүчинтэй.</p>`,
      { href, label: "Имэйлээ баталгаажуулах" },
    ),
  });
}

/** Нууц үг сэргээх холбоос илгээнэ */
export async function sendResetEmail(email: string, token: string): Promise<boolean> {
  const href = `${siteUrl()}/nevtreh/shine-nuuts-ug/${token}`;
  if (!isConfigured()) {
    console.log(`\n[dev] Нууц үг сэргээх холбоос (${email}):\n  ${href}\n`);
    return false;
  }
  return sendOne({
    to: email,
    subject: "AI News — нууц үг сэргээх",
    text: `Шинэ нууц үг тохируулах: ${href}`,
    html: wrap(
      "Нууц үгээ шинэчлэх",
      `<p>Доорх товчоор шинэ нууц үг тохируулна уу. Холбоос ${RESET_HOURS} цаг хүчинтэй.</p>`,
      { href, label: "Шинэ нууц үг тохируулах" },
    ),
  });
}
