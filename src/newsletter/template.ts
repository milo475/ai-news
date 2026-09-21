/**
 * Newsletter-ийн имэйл — цэвэр функц (DB-гүй, сүлжээгүй, тесттэй).
 * React Email биш, inline-CSS HTML: имэйл клиентүүд гадаад CSS-ийг хасдаг.
 */

const ACCENT = "#4f46e5";
const INK = "#1b1b23";
const MUTED = "#6b6b76";
const PAPER = "#f7f6f2";
const LINE = "#e3e1db";

export interface DigestEmailInput {
  title: string;
  lead: string;
  /** Тойм доторх сэдвүүд — гарчиг + эхний догол мөр */
  sections: { heading: string; text: string }[];
  /** Сайт дээрх бүтэн холбоос */
  url: string;
  /** Бүртгэлээс гарах бүтэн холбоос — заавал */
  unsubscribeUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Markdown-аас `## гарчиг` + эхний догол мөрийг гаргана */
export function extractSections(markdown: string, limit = 4): { heading: string; text: string }[] {
  const out: { heading: string; text: string }[] = [];
  const blocks = markdown.split(/\n(?=## )/);
  for (const block of blocks) {
    const m = /^##\s+(.+)/.exec(block);
    if (!m) continue;
    const heading = m[1]!.trim();
    // Тоймын автомат хэсгүүдийг имэйлд оруулахгүй — сайт дээр уншина
    if (/^(Энэ digest-д орсон мэдээ|Жагсаалтын өөрчлөлт)$/.test(heading)) continue;
    const rest = block.slice(m[0].length).trim();
    const first = rest.split(/\n\s*\n/)[0] ?? "";
    out.push({ heading, text: stripMarkdown(first) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Имэйлд markdown хэрэггүй — холбоос, тодруулгыг энгийн текст болгоно */
export function stripMarkdown(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderDigestEmail(d: DigestEmailInput): RenderedEmail {
  const sections = d.sections
    .map(
      (s) => `
        <tr><td style="padding:0 0 18px 0">
          <div style="font:600 16px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};margin:0 0 6px">${esc(s.heading)}</div>
          <div style="font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED}">${esc(s.text)}</div>
        </td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(d.title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid ${LINE};border-radius:12px;padding:28px">
    <tr><td style="padding:0 0 22px 0">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px" valign="middle">
          <div style="width:32px;height:32px;border-radius:8px;background:${ACCENT}"></div>
        </td>
        <td valign="middle">
          <span style="font:800 20px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};letter-spacing:-0.5px">AI</span>
          <span style="font:800 20px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:${ACCENT};letter-spacing:-0.5px"> News</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:0 0 10px 0">
      <h1 style="margin:0;font:700 24px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};letter-spacing:-0.5px">${esc(d.title)}</h1>
    </td></tr>
    <tr><td style="padding:0 0 22px 0">
      <p style="margin:0;font:400 16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED}">${esc(d.lead)}</p>
    </td></tr>

    ${sections}

    <tr><td style="padding:6px 0 26px 0">
      <a href="${esc(d.url)}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font:600 15px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:13px 22px;border-radius:8px">Бүтнээр унших →</a>
    </td></tr>

    <tr><td style="border-top:1px solid ${LINE};padding:18px 0 0 0">
      <p style="margin:0 0 6px 0;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED}">
        AI News · <a href="${esc(d.url)}" style="color:${MUTED}">ainews.mn</a>
      </p>
      <p style="margin:0;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED}">
        Энэ захиаг хүлээж авахаа болих бол <a href="${esc(d.unsubscribeUrl)}" style="color:${MUTED}">энд дарна уу</a>.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    "AI News",
    "",
    d.title,
    "",
    d.lead,
    "",
    ...d.sections.flatMap((s) => [s.heading, s.text, ""]),
    `Бүтнээр унших: ${d.url}`,
    "",
    "—",
    "AI News · ainews.mn",
    `Бүртгэлээс гарах: ${d.unsubscribeUrl}`,
  ].join("\n");

  return { subject: d.title, html, text };
}
