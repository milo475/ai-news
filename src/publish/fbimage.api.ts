/**
 * Өдрийн жагсаалтын брэндийн карт — цэвэр хэсэг (SVG, тесттэй).
 *
 * Нийтлэлийн постын карт (гэрэл зураг + headline) нь `card.api.ts` дотор; энэ файл нь
 * зөвхөн жагсаалтын картыг (топ 5, өсөлт/уналт, лого) зурна.
 */

/** Жагсаалтын картын хэмжээ (1:1) */
export const IMAGE_SIZE = 1080;

/** SVG дотор тавих текстийг escape хийнэ */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Контейнерт байдаг фонтууд (playwright image дээр DejaVu, Liberation байдаг) */
const FONT = "DejaVu Sans, Liberation Sans, Noto Sans, sans-serif";

const ACCENT = "#4f46e5";
const PAPER = "#f7f6f2";
const INK = "#1b1b23";
const MUTED = "#6b6b76";
const UP = "#15803d";
const DOWN = "#b91c1c";

export interface RankingRow {
  rank: number;
  name: string;
  company: string;
  /** +2 = 2 байр дээшилсэн, null = шинэ */
  rankDelta: number | null;
}

/** Картын толгой хэсэг — лого (хоёр хувилбарт ижил) */
function header(size: number, title: string, subtitle: string): string {
  return `  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${size}" height="14" fill="${ACCENT}"/>

  <rect x="88" y="96" width="64" height="64" rx="16" fill="${ACCENT}"/>
  <rect x="101" y="134" width="9" height="13" rx="2" fill="#fff" fill-opacity="0.55"/>
  <rect x="115" y="124" width="9" height="23" rx="2" fill="#fff" fill-opacity="0.8"/>
  <rect x="130" y="114" width="9" height="33" rx="2" fill="#fff"/>
  <text x="172" y="145" font-family="${FONT}" font-size="46" font-weight="700" fill="${INK}">AI <tspan fill="${ACCENT}">News</tspan></text>

  <text x="88" y="240" font-family="${FONT}" font-size="62" font-weight="700" fill="${INK}">${esc(title)}</text>
  <text x="88" y="288" font-family="${FONT}" font-size="32" fill="${MUTED}">${esc(subtitle)}</text>`;
}

function clipName(name: string, max = 26): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Жагсаалтын брэндийн карт — 1080×1080 SVG (sharp-аар PNG болгоно) */
export function rankingCardSvg(rows: RankingRow[], dateLabel: string, size = IMAGE_SIZE): string {
  const top = rows.slice(0, 5);
  const rowH = 122;
  const top0 = 410;

  const items = top.map((r, i) => {
    const y = top0 + i * rowH;
    const trend =
      r.rankDelta === null ? { text: "шинэ", color: ACCENT }
      : r.rankDelta > 0 ? { text: `▲ ${r.rankDelta}`, color: UP }
      : r.rankDelta < 0 ? { text: `▼ ${Math.abs(r.rankDelta)}`, color: DOWN }
      : { text: "—", color: MUTED };
    return `
  <text x="88" y="${y}" font-family="${FONT}" font-size="54" font-weight="700" fill="${ACCENT}">${r.rank}</text>
  <text x="168" y="${y}" font-family="${FONT}" font-size="46" fill="${INK}">${esc(clipName(r.name))}</text>
  <text x="168" y="${y + 40}" font-family="${FONT}" font-size="30" fill="${MUTED}">${esc(r.company)}</text>
  <text x="${size - 88}" y="${y}" font-family="${FONT}" font-size="40" fill="${trend.color}" text-anchor="end">${trend.text}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${header(size, "Хэрэглээний топ 5", `OpenRouter, ${dateLabel} · өмнөх өдрөөс`)}
  ${items.join("\n")}

  <text x="88" y="${size - 70}" font-family="${FONT}" font-size="32" fill="${MUTED}">ainews.mn/jagsaalt</text>
</svg>`;
}

export interface BenchRankingRow {
  rank: number;
  name: string;
  company: string;
  /** 0–10 */
  score: number;
}

/**
 * Бенчмаркийн топ 5 карт — «монголоор хамгийн сайн».
 *
 * Жагсаалтын картаас ялгаатай нь өсөлт/уналтын оронд 0–10 оноог харуулна.
 */
export function benchCardSvg(rows: BenchRankingRow[], monthText: string, size = IMAGE_SIZE): string {
  const top = rows.slice(0, 5);
  const rowH = 122;
  const top0 = 410;

  const items = top.map((r, i) => {
    const y = top0 + i * rowH;
    // Онооны туузны урт — 0–10-ыг 220px-д буулгана
    const barW = Math.round(Math.min(1, Math.max(0, r.score / 10)) * 220);
    return `
  <text x="88" y="${y}" font-family="${FONT}" font-size="54" font-weight="700" fill="${ACCENT}">${r.rank}</text>
  <text x="168" y="${y}" font-family="${FONT}" font-size="46" fill="${INK}">${esc(clipName(r.name, 22))}</text>
  <text x="168" y="${y + 40}" font-family="${FONT}" font-size="30" fill="${MUTED}">${esc(r.company)}</text>
  <rect x="${size - 88 - 220}" y="${y + 16}" width="220" height="12" rx="6" fill="${MUTED}" fill-opacity="0.2"/>
  <rect x="${size - 88 - 220}" y="${y + 16}" width="${barW}" height="12" rx="6" fill="${ACCENT}"/>
  <text x="${size - 88}" y="${y}" font-family="${FONT}" font-size="44" font-weight="700" fill="${INK}" text-anchor="end">${r.score.toFixed(1)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${header(size, "Монголоор хамгийн сайн", `${monthText} · 0–10 оноо`)}
  ${items.join("\n")}

  <text x="88" y="${size - 70}" font-family="${FONT}" font-size="32" fill="${MUTED}">ainews.mn/benchmark</text>
</svg>`;
}
