/**
 * Постын карт — цэвэр хэсэг (LLM, sharp-гүй тул тесттэй).
 *
 * Формат: 1080×1350 (4:5) гэрэл зураг, доод талд нь хар gradient, түүн дээр 2–4 мөр
 * цагаан headline. FB, IG хоёуланд feed дээр том харагдана.
 */
import { FONT_FALLBACK, FONT_FAMILY } from "./fonts";

/** Картын хэмжээ (4:5) */
export const CARD_W = 1080;
export const CARD_H = 1350;

/** Хажуугийн зай */
export const PAD = 64;

/** Доод хэдэн хувийг gradient бүрхэх вэ */
export const GRADIENT_RATIO = 0.45;

/** Headline-ий фонтын хэмжээнүүд — эхнийхээс нь эхэлж, багтахгүй бол дараагийнх */
export const FONT_SIZES = [64, 56, 48];

/** Headline хэдэн мөрөөс хэтрэхгүй вэ */
export const MAX_LINES = 4;

/** Мөр хоорондын зай */
export const LINE_HEIGHT = 1.15;

/** Headline-ий дээд урт */
export const MAX_HOOK_CHARS = 110;

/** Сурталчилгааны мөр */
export const CTA_FB = "_дагаарай";
export const CTA_IG = "_дэлгэрэнгүй bio-д";

/** Roboto Bold-ийн кирилл тэмдэгтийн дундаж өргөн (фонтын хэмжээнд харьцуулсан) */
const CHAR_RATIO = 0.53;

/** Ойролцоогоор мөрийн өргөнийг тооцно — үгээр таслахад хангалттай нарийвчлал */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_RATIO;
}

/** Үгээр нь таслаж мөр болгоно (шуналт алгоритм) */
export function wrapLines(text: string, fontSize: number, maxWidth = CARD_W - PAD * 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidth(candidate, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface FittedHeadline {
  lines: string[];
  fontSize: number;
}

/**
 * Headline-ыг картад багтаана: 64px-ээс эхэлж, MAX_LINES мөрөөс хэтэрвэл фонтыг
 * багасгана. 48px дээр ч багтахгүй бол null — дуудагч нь headline-ыг дахин бичүүлнэ.
 */
export function fitHeadline(text: string, sizes = FONT_SIZES): FittedHeadline | null {
  for (const fontSize of sizes) {
    const lines = wrapLines(text, fontSize);
    if (lines.length <= MAX_LINES) return { lines, fontSize };
  }
  return null;
}

// ---------- Headline (hook) ----------

export const HOOK_SYSTEM = `Чи монгол хэлний гарчиг бичдэг редактор. Нийтлэлээс нийгмийн сүлжээний зурган дээр тавих НЭГ өгүүлбэр бич.

Дүрэм:
- ${MAX_HOOK_CHARS} тэмдэгтээс богино, нэг өгүүлбэр.
- Тоо баримт заавал орно (хувь, доллар, хүний тоо, огноо, хэмжээ).
- Баталгаатай өнгө: "...болжээ", "...байдаг", "...гэж үзэж байна" маягаар дуусна.
- Асуулт биш, тушаал биш, кликбейт биш. Нийтлэлд байхгүй зүйл бүү нэм.
- Emoji, хашилт, том үсгээр хашгирах хориотой.
- Хэн бичсэн тухай юу ч бүү дурд.

Гурван өөр хувилбар бич — өөр өөр баримтаас эхэлсэн байх. Зөвхөн JSON.`;

export const HOOK_SCHEMA = {
  type: "object",
  properties: {
    hooks: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", description: `Нэг өгүүлбэр, ${MAX_HOOK_CHARS} тэмдэгтээс богино, тоотой` },
    },
  },
  required: ["hooks"],
  additionalProperties: false,
};

export interface HookProblem {
  code: "empty" | "too-long" | "no-number" | "emoji" | "quotes" | "multi-sentence" | "shouting";
  detail: string;
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;

/** Headline-ий шалгуур. Хоосон массив = зүгээр. */
export function checkHook(hook: string): HookProblem[] {
  const text = hook.trim();
  const problems: HookProblem[] = [];

  if (!text) return [{ code: "empty", detail: "хоосон" }];
  if (text.length > MAX_HOOK_CHARS) problems.push({ code: "too-long", detail: `${text.length} тэмдэгт` });
  if (!/\d/.test(text)) problems.push({ code: "no-number", detail: "тоо баримт алга" });
  if (EMOJI.test(text)) problems.push({ code: "emoji", detail: "emoji байна" });
  if (/["«»“”]/.test(text)) problems.push({ code: "quotes", detail: "хашилт байна" });
  // Дундаа цэг тавьсан бол хоёр өгүүлбэр — зурган дээр нэг л өгүүлбэр байна
  if (/[.!?…]\s+\S/.test(text)) problems.push({ code: "multi-sentence", detail: "нэгээс олон өгүүлбэр" });
  // \b нь кирилл үсэгтэй ажиллахгүй тул зайгаар нь таслаж шалгана
  const shouts = [...text.matchAll(/(?:^|\s)([A-ZА-ЯӨҮЁ]{4,})(?=\s|$|[.,!?:;])/gu)].map((m) => m[1]!);
  if (shouts.length >= 2 || shouts.some((w) => w.length >= 8)) {
    problems.push({ code: "shouting", detail: `том үсгээр: ${shouts.join(", ")}` });
  }

  return problems;
}

/**
 * Гурван хувилбараас хамгийн богиныг сонгоно (зурган дээр богино нь илүү).
 * Шалгуур давсан нь байхгүй бол null.
 */
export function pickHook(hooks: string[]): string | null {
  const valid = hooks
    .map((h) => h.trim())
    .filter((h) => checkHook(h).length === 0 && fitHeadline(h) !== null)
    .sort((a, b) => a.length - b.length);
  return valid[0] ?? null;
}

// ---------- Зургийн prompt ----------

/** Суурь зургийн тогтмол хэсэг — кино кадар/документари, "AI-style" гялтганахгүй */
export const PHOTO_PROMPT_PREFIX =
  "documentary photograph, candid cinematic still, real people in a real place, 35mm film look, " +
  "slight grain, natural lighting, shallow depth of field, muted colours, 4:5 vertical framing";

/** Хориглох жагсаалт — prompt-ийн төгсгөлд явна */
export const PHOTO_PROMPT_NEGATIVE =
  "no text, no letters, no logos, no watermark, no glossy stock-photo look, no 3D render, " +
  "no CGI, no neon, no glowing holograms, no futuristic UI overlays, no robot hands, " +
  "no blue digital background, no perfect studio lighting";

/** Бүтэн prompt */
export function buildPhotoPrompt(scene: string): string {
  return `${PHOTO_PROMPT_PREFIX}. ${scene.trim().replace(/\s+/g, " ")}. ${PHOTO_PROMPT_NEGATIVE}.`;
}

// ---------- SVG overlay ----------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface OverlayOptions {
  lines: string[];
  fontSize: number;
  /** Доод зүүн буланд: "_дагаарай" (FB) эсвэл "_дэлгэрэнгүй bio-д" (IG) */
  cta: string;
  width?: number;
  height?: number;
}

/**
 * Картын давхарга: доод gradient + headline + "AI News" wordmark + CTA.
 * Зөвхөн SVG — sharp-аар суурь зураг дээр давхарлана.
 */
export function overlaySvg(opts: OverlayOptions): string {
  const w = opts.width ?? CARD_W;
  const h = opts.height ?? CARD_H;
  const font = `${FONT_FAMILY}, ${FONT_FALLBACK}`;
  const gradientTop = Math.round(h * (1 - GRADIENT_RATIO));

  const step = Math.round(opts.fontSize * LINE_HEIGHT);
  const ctaY = h - PAD;
  // Headline-ийн сүүлийн мөр CTA-гаас дээш 56px зайтай
  const lastBaseline = ctaY - 56;
  const firstBaseline = lastBaseline - step * (opts.lines.length - 1);

  const headline = opts.lines
    .map(
      (line, i) =>
        `  <text x="${PAD}" y="${firstBaseline + i * step}" font-family="${font}" font-weight="700" ` +
        `font-size="${opts.fontSize}" fill="#ffffff">${esc(line)}</text>`,
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#000000" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- Дээд сүүдэр — цайвар зураг дээр wordmark уншигдахгүй байсан -->
  <rect x="0" y="0" width="${w}" height="${Math.round(h * 0.16)}" fill="url(#top)"/>
  <rect x="0" y="${gradientTop}" width="${w}" height="${h - gradientTop}" fill="url(#shade)"/>

  <text x="${PAD}" y="${PAD + 28}" font-family="${font}" font-weight="700" font-size="36"
        fill="#ffffff" fill-opacity="0.92">AI News</text>

${headline}

  <text x="${PAD}" y="${ctaY}" font-family="${font}" font-weight="400" font-size="28"
        fill="#ffffff" fill-opacity="0.7">${esc(opts.cta)}</text>
</svg>`;
}
