/**
 * Долоо хоногийн админ тайлангийн имэйл — цэвэр функц (DB-гүй, сүлжээгүй, тесттэй).
 */

export interface ReportRow {
  label: string;
  value: string;
  /** Өмнөх долоо хоногтой харьцуулсан өөрчлөлт */
  delta?: string;
  /** Анхаарал татах мөр — ягаанаар */
  alert?: boolean;
}

export interface ReportSection {
  heading: string;
  rows: ReportRow[];
}

export interface ReportInput {
  /** "9/20–9/26" */
  weekLabel: string;
  sections: ReportSection[];
  /** Гараар анхаарах зүйлс — хоосон бол блок гарахгүй */
  warnings: string[];
  /** /admin руу шууд орох холбоос */
  adminUrl: string;
}

const INK = "#1b1b23";
const MUTED = "#6b6b76";
const LINE = "#e3e1db";
const ACCENT = "#4f46e5";
const DOWN = "#c0392b";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Хоёр тооны хувийн өөрчлөлт — "+42%", "-8%", "шинэ", "—" */
export function delta(now: number, before: number): string {
  if (before === 0) return now === 0 ? "—" : "шинэ";
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export function renderReport(r: ReportInput): { subject: string; html: string; text: string } {
  const sections = r.sections
    .map(
      (s) => `
      <tr><td style="padding:18px 0 6px 0;border-top:1px solid ${LINE}">
        <div style="font:700 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED};text-transform:uppercase;letter-spacing:.06em">${esc(s.heading)}</div>
      </td></tr>
      ${s.rows
        .map(
          (row) => `
      <tr><td style="padding:5px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font:400 15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED}">${esc(row.label)}</td>
          <td align="right" style="font:600 15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:${row.alert ? DOWN : INK};white-space:nowrap">
            ${esc(row.value)}${row.delta ? `<span style="color:${MUTED};font-weight:400"> · ${esc(row.delta)}</span>` : ""}
          </td>
        </tr></table>
      </td></tr>`,
        )
        .join("")}`,
    )
    .join("");

  const warnings =
    r.warnings.length === 0
      ? ""
      : `
      <tr><td style="padding:16px 0 0 0">
        <div style="border-left:3px solid ${DOWN};background:#fdf3f2;padding:10px 12px">
          <div style="font:700 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:${DOWN};margin-bottom:4px">Анхаарах</div>
          ${r.warnings
            .map(
              (w) =>
                `<div style="font:400 14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK}">· ${esc(w)}</div>`,
            )
            .join("")}
        </div>
      </td></tr>`;

  const subject = `AI News · долоо хоногийн тайлан ${r.weekLabel}`;

  const html = `<!doctype html>
<html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f6f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f2;padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid ${LINE};border-radius:12px;padding:26px">
    <tr><td style="padding:0 0 4px 0">
      <div style="font:800 18px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};letter-spacing:-0.4px">AI <span style="color:${ACCENT}">News</span></div>
    </td></tr>
    <tr><td style="padding:0 0 16px 0">
      <h1 style="margin:0;font:700 21px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK}">Долоо хоногийн тайлан</h1>
      <p style="margin:4px 0 0 0;font:400 14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED}">${esc(r.weekLabel)}</p>
    </td></tr>
    ${warnings}
    ${sections}
    <tr><td style="padding:22px 0 0 0;border-top:1px solid ${LINE}">
      <a href="${esc(r.adminUrl)}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font:600 14px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:11px 18px;border-radius:8px">Админ самбар →</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    `AI News · долоо хоногийн тайлан ${r.weekLabel}`,
    "",
    ...(r.warnings.length ? ["АНХААРАХ:", ...r.warnings.map((w) => `  · ${w}`), ""] : []),
    ...r.sections.flatMap((s) => [
      s.heading.toUpperCase(),
      ...s.rows.map((row) => `  ${row.label}: ${row.value}${row.delta ? ` (${row.delta})` : ""}`),
      "",
    ]),
    `Админ: ${r.adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}
