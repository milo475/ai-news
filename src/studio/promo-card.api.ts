/**
 * «Долоо хоногийн промпт»-ын карт — 1080×1350, одоогийн загварын дүрмээр.
 *
 * Ердийн мэдээний картаас ялгаатай нь ХОЁР блок: дээр «Хүсэлт», доор «Юу
 * гарах». Дээд буланд «Промпт студи» тэмдэг, доор «Жишээ» гэж тодорхой.
 */
import { CARD_H, CARD_W, PAD, wrapLines } from "../publish/card.api";
import { FONT_FALLBACK, FONT_FAMILY } from "../publish/fonts";
import { PROMO_TAG } from "./promo.api";

/** Блокийн фонтын хэмжээ — эхнийхээс эхэлж, багтахгүй бол дараагийнх */
export const BLOCK_SIZES = [52, 44, 38];
export const BLOCK_MAX_LINES = 4;
const LINE_H = 1.2;

export interface Block {
  label: string;
  lines: string[];
  fontSize: number;
}

/** Текстийг картад багтаах — багтахгүй бол хамгийн жижгээр тайрна */
export function fitBlock(label: string, text: string): Block {
  for (const fontSize of BLOCK_SIZES) {
    const lines = wrapLines(text, fontSize, CARD_W - PAD * 2);
    if (lines.length <= BLOCK_MAX_LINES) return { label, lines, fontSize };
  }
  const fontSize = BLOCK_SIZES[BLOCK_SIZES.length - 1]!;
  const lines = wrapLines(text, fontSize, CARD_W - PAD * 2).slice(0, BLOCK_MAX_LINES);
  const last = lines.length - 1;
  if (last >= 0) lines[last] = `${lines[last]!.replace(/[.,;:\s]+$/u, "")}…`;
  return { label, lines, fontSize };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface PromoOverlay {
  request: string;
  outcome: string;
  /** Доод мөр — сүлжээнээс хамаарна («коммент дээр» / «bio-д») */
  footer: string;
  width?: number;
  height?: number;
}

/**
 * Хоёр блоктой давхарга.
 *
 * Ердийн картын адил доод талд gradient, дээд талд wordmark. Дунд нь
 * «Хүсэлт → Юу гарах» гэсэн хоёр блок.
 */
export function promoOverlaySvg(o: PromoOverlay): string {
  const w = o.width ?? CARD_W;
  const h = o.height ?? CARD_H;
  const font = `${FONT_FAMILY}, ${FONT_FALLBACK}`;

  const top = fitBlock("ХҮСЭЛТ", o.request);
  const bottom = fitBlock("ЮУ ГАРАХ", o.outcome);

  /** Блокийн өндөр: шошго + мөрүүд */
  const blockHeight = (b: Block): number => 48 + Math.round(b.fontSize * LINE_H) * (b.lines.length - 1) + b.fontSize;

  // Агуулгыг БОСОО ТӨВД байрлуулна — доод тал хоосон үлдэхгүй
  const ARROW_GAP = 72;
  const totalH = blockHeight(top) + ARROW_GAP + 56 + blockHeight(bottom);
  const startTop = Math.max(280, Math.round((h - totalH) / 2));

  const render = (b: Block, startY: number): { svg: string; endY: number } => {
    const step = Math.round(b.fontSize * LINE_H);
    const labelY = startY;
    const firstLine = startY + 48;
    const body = b.lines
      .map(
        (line, i) =>
          `  <text x="${PAD}" y="${firstLine + i * step}" font-family="${font}" font-weight="700" ` +
          `font-size="${b.fontSize}" fill="#ffffff">${esc(line)}</text>`,
      )
      .join("\n");
    return {
      svg:
        `  <text x="${PAD}" y="${labelY}" font-family="${font}" font-weight="700" font-size="24"\n` +
        `        fill="#ffffff" fill-opacity="0.55" letter-spacing="2">${esc(b.label)}</text>\n${body}`,
      endY: firstLine + (b.lines.length - 1) * step,
    };
  };

  const first = render(top, startTop);
  const arrowY = first.endY + ARROW_GAP;
  const second = render(bottom, arrowY + 56);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1117"/>
      <stop offset="1" stop-color="#05070a"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>

  <text x="${PAD}" y="${PAD + 28}" font-family="${font}" font-weight="700" font-size="36"
        fill="#ffffff" fill-opacity="0.92">AI News</text>
  <text x="${w - PAD}" y="${PAD + 28}" font-family="${font}" font-weight="700" font-size="26"
        fill="#7c9cff" text-anchor="end">${esc(PROMO_TAG)}</text>

${first.svg}

  <text x="${PAD}" y="${arrowY}" font-family="${font}" font-weight="700" font-size="44"
        fill="#7c9cff">↓</text>

${second.svg}

  <text x="${PAD}" y="${h - PAD}" font-family="${font}" font-weight="400" font-size="26"
        fill="#ffffff" fill-opacity="0.6">${esc(o.footer)}</text>
</svg>`;
}
