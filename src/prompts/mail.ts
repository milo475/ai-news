/**
 * Prompt-ын шийдвэрийг хэрэглэгчид мэдэгдэх имэйл.
 *
 * RESEND_API_KEY тохируулаагүй бол (dev) консолд хэвлээд үйлдлийг зогсоохгүй.
 */
import { isConfigured, sendOne } from "../newsletter/mailer";
import { siteUrl } from "../lib/site";

function wrap(title: string, body: string, link?: { href: string; label: string }): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:32rem;line-height:1.6">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  ${body}
  ${link ? `<p style="margin:24px 0"><a href="${link.href}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${link.label}</a></p>` : ""}
  <p style="font-size:13px;color:#6b6b76">AI News · Prompt сан</p>
</div>`;
}

export async function sendPromptApproved(email: string, title: string, slug: string): Promise<boolean> {
  const href = `${siteUrl()}/prompt/${slug}`;
  if (!isConfigured()) {
    console.log(`\n[dev] Prompt баталлаа (${email}): «${title}» ${href}\n`);
    return false;
  }
  return sendOne({
    to: email,
    subject: "AI News — таны prompt нийтлэгдлээ",
    text: `«${title}» prompt нийтлэгдлээ: ${href}`,
    html: wrap(
      "Таны prompt нийтлэгдлээ",
      `<p>«${title}» prompt Prompt санд нэмэгдлээ. Баярлалаа!</p>`,
      { href, label: "Prompt-оо харах" },
    ),
  });
}

export async function sendPromptRejected(email: string, title: string, reason: string): Promise<boolean> {
  const href = `${siteUrl()}/prompt/nemeh`;
  if (!isConfigured()) {
    console.log(`\n[dev] Prompt татгалзлаа (${email}): «${title}» — ${reason}\n`);
    return false;
  }
  return sendOne({
    to: email,
    subject: "AI News — таны prompt нийтлэгдсэнгүй",
    text: `«${title}» prompt нийтлэгдсэнгүй. Шалтгаан: ${reason}`,
    html: wrap(
      "Таны prompt нийтлэгдсэнгүй",
      `<p>«${title}» prompt-ыг нийтлэх боломжгүй байлаа.</p>
       <p style="background:#f4f4f5;padding:12px;border-radius:8px"><strong>Шалтгаан:</strong> ${reason}</p>
       <p>Засаад дахин илгээж болно.</p>`,
      { href, label: "Шинэ prompt нэмэх" },
    ),
  });
}
