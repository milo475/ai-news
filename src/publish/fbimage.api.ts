/**
 * FB постын зураг — цэвэр хэсэг (сүлжээ, DB-гүй): prompt, тохиргоо, SVG зурах.
 *
 * Зарчим: жинхэнэ ертөнцийн editorial гэрэл зураг. Текст, лого, бодит хүний нүүр зурахгүй
 * (AI текстийг буруу гаргадаг, лого/нүүр нь эрх зүйн эрсдэлтэй).
 */
import type { ArticleCategory } from "../generated/prisma/enums";

/**
 * Анхдагч зургийн модель. 2026-09-24-нд туршихад нэг зураг ≈ $0.034 бөгөөд
 * gemini-2.5-flash-image ($0.039) нь зарим prompt дээр зургийн оронд текст буцаадаг байв.
 */
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
/** Үндсэн модель унасан үед оролдох нөөц */
export const FALLBACK_IMAGE_MODEL = "google/gemini-2.5-flash-image";

/** Өдөрт үүсгэх зургийн дээд тоо — зардлын хамгаалалт */
export const DEFAULT_IMAGE_DAILY_LIMIT = 5;

/** FB постын зургийн хэмжээ */
export const IMAGE_SIZE = 1080;

export function imageModel(env: Record<string, string | undefined> = process.env): string {
  return env.IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
}

export function imageDailyLimit(env: Record<string, string | undefined> = process.env): number {
  const raw = env.FB_IMAGE_DAILY_LIMIT?.trim();
  if (!raw) return DEFAULT_IMAGE_DAILY_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_IMAGE_DAILY_LIMIT;
}

/** FB_USE_SOURCE_IMAGE=true үед эх нийтлэлийн og:image-ийг хэрэглэнэ (анхдагчаар AI зураг) */
export function useSourceImage(env: Record<string, string | undefined> = process.env): boolean {
  return (env.FB_USE_SOURCE_IMAGE ?? "").trim().toLowerCase() === "true";
}

/** Зургийн prompt-ийн тогтмол хэсэг */
export const IMAGE_PROMPT_PREFIX =
  "photorealistic editorial photograph, natural light, real-world scene, no text, no logos, no watermark, 1:1 square composition";

/** LLM-ээс нэг өгүүлбэрийн дүрслэл авах system prompt */
export const SCENE_SYSTEM = `You turn a news article into a short scene description for an editorial stock photograph.

FIRST decide the concrete subject: the specific object, place or action the article is actually about,
then describe a scene built around it. Examples:
- text-to-speech model → a studio microphone with a waveform on the screen behind it
- border surveillance cameras → a lone watchtower with a camera mast in the desert
- chip factory investment → a wafer being handled with tweezers in a cleanroom
- copyright lawsuit → a stack of printed documents and a gavel on a courtroom bench
- delivery robots → a small wheeled robot waiting at a pedestrian crossing

BANNED (too generic — never use unless the article is literally about it):
"an office", "a modern office", "people at computers", "a person at a laptop", "a team in a meeting
room", "a business handshake", "a boardroom", "generic server racks", "a glowing AI brain",
"a humanoid robot", "abstract digital background", "hands typing on a keyboard".

Rules:
- One sentence, English, under 200 characters.
- Real-world, photographable scene — objects and places first, people only if they belong there.
- No brand names, no logos, no product names, no text or signage in the scene.
- No recognisable real people, no faces in close-up; people seen from behind, from the side, or in soft focus.
- No charts, no user interfaces with readable text.
- Add one photographic detail (shallow depth of field, wide shot, overhead view, morning light).
- If recent scenes are listed, pick a different subject and camera angle from all of them.

Return JSON only.`;

export const SCENE_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "The concrete object, place or action, 2–6 English words" },
    scene: { type: "string", description: "One English sentence, under 200 characters" },
  },
  required: ["subject", "scene"],
  additionalProperties: false,
};

/** Сүүлийн постуудын prompt-ыг LLM-д харуулж давхардлаас сэргийлнэ */
export function recentScenesBlock(prompts: string[]): string {
  const scenes = prompts
    .map((p) => p.replace(`${IMAGE_PROMPT_PREFIX}: `, "").trim())
    .filter(Boolean)
    .slice(0, RECENT_SCENES);
  if (scenes.length === 0) return "";
  return ["Recent scenes (do not repeat these subjects or angles):", ...scenes.map((s) => `- ${s}`)].join("\n");
}

/** Хэдэн постын зургийг давхардлын шалгалтад харгалзах вэ */
export const RECENT_SCENES = 10;

/** Хориглосон ерөнхий дүрслэлүүд — эдгээр таарвал нэг удаа дахин гаргуулна */
const GENERIC_PATTERNS: RegExp[] = [
  /\b(a |an |the )?(modern |bright |busy |open[- ]plan )?office\b/i,
  /\b(co-?working|workspace|cubicle|boardroom|meeting room|conference room)\b/i,
  /\bpeople (at|in front of|around) (a |the )?(computer|laptop|desk|screen|monitor)/i,
  /\b(a |an |the )?(person|man|woman|developer|analyst|employee|worker)\b[^.]{0,30}\b(at|on|in front of) (a|the|their|two|multiple) (laptop|computer|desk|monitor|screen)/i,
  /\b(hands? typing|typing on a keyboard)\b/i,
  /\b(handshake|shaking hands|team (meeting|collaborating))\b/i,
  /\b(server (racks?|room)|data cent(er|re))\b/i,
  /\b(glowing|digital|abstract) (brain|network|background|interface)\b/i,
  /\bhumanoid robot\b/i,
];

/** Дүрслэл хэт ерөнхий үү (оффис, компьютерийн ард хүн гэх мэт) */
export function isGenericScene(scene: string): boolean {
  return GENERIC_PATTERNS.some((re) => re.test(scene));
}

/** Үгээр харьцуулсан ижил төстэй байдал (Jaccard), 0–1 */
function similarity(a: string, b: string): number {
  const words = (t: string) =>
    new Set(
      t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
    );
  const [x, y] = [words(a), words(b)];
  if (x.size === 0 || y.size === 0) return 0;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / (x.size + y.size - shared);
}

const STOP_WORDS = new Set([
  "with", "from", "that", "this", "seen", "shot", "view", "light", "depth", "field", "shallow",
  "focus", "photograph", "photorealistic", "editorial", "scene", "real", "world", "composition",
  "natural", "square", "close", "wide", "background", "foreground",
]);

/** Сүүлийн постуудын аль нэгтэй хэт төстэй үү */
export function sceneTooSimilar(scene: string, recent: string[], threshold = 0.35): boolean {
  return recent.some((r) => similarity(scene, r) > threshold);
}

/** Ангилал бүрийн өнцөг — сэдвийн объектыг аль талаас нь харуулах вэ */
export const CATEGORY_SCENE_HINT: Record<ArticleCategory, string> = {
  NEWS: "show the thing the news is about (the device, building, vehicle, material, place)",
  PROJECT: "show the thing that was built and the tools or workbench around it",
  BUSINESS: "show where the money is made: the shop floor, the goods, the machine, the counter",
  FACT: "show the object being measured, tested or counted, and the instrument doing it",
  RISK: "show the calm, concrete detail at stake (a lock, a camera, a document, a fence) — no alarm, no fear",
  HOWTO: "show the tool or material in use, close, from the user's point of view",
};

/** Бүтэн prompt: тогтмол хэсэг + LLM-ийн дүрслэл */
export function buildImagePrompt(scene: string): string {
  return `${IMAGE_PROMPT_PREFIX}: ${scene.trim().replace(/\s+/g, " ")}`;
}

/** Эх сурвалжийн зураг хэрэглэсэн бол буланд нь бичих текст */
export function creditText(sourceName: string): string {
  return `Зураг: ${sourceName}`;
}

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

/** Зургийн доод буланд тавих credit хаяг (SVG overlay) */
export function creditSvg(text: string, size = IMAGE_SIZE): string {
  const pad = Math.round(size * 0.02);
  const h = Math.round(size * 0.042);
  const fontSize = Math.round(h * 0.55);
  const w = Math.round(fontSize * 0.62 * text.length + pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect x="${size - w - pad}" y="${size - h - pad}" width="${w}" height="${h}" rx="${Math.round(h / 4)}" fill="#000" fill-opacity="0.55"/>
  <text x="${size - w / 2 - pad}" y="${size - h / 2 - pad}" fill="#fff" font-family="${FONT}" font-size="${fontSize}"
        text-anchor="middle" dominant-baseline="central">${esc(text)}</text>
</svg>`;
}

export interface RankingRow {
  rank: number;
  name: string;
  company: string;
  /** +2 = 2 байр дээшилсэн, null = шинэ */
  rankDelta: number | null;
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
    const name = r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name;
    return `
  <text x="88" y="${y}" font-family="${FONT}" font-size="54" font-weight="700" fill="${ACCENT}">${r.rank}</text>
  <text x="168" y="${y}" font-family="${FONT}" font-size="46" fill="${INK}">${esc(name)}</text>
  <text x="168" y="${y + 40}" font-family="${FONT}" font-size="30" fill="${MUTED}">${esc(r.company)}</text>
  <text x="${size - 88}" y="${y}" font-family="${FONT}" font-size="40" fill="${trend.color}" text-anchor="end">${trend.text}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${size}" height="14" fill="${ACCENT}"/>

  <rect x="88" y="96" width="64" height="64" rx="16" fill="${ACCENT}"/>
  <rect x="101" y="134" width="9" height="13" rx="2" fill="#fff" fill-opacity="0.55"/>
  <rect x="115" y="124" width="9" height="23" rx="2" fill="#fff" fill-opacity="0.8"/>
  <rect x="130" y="114" width="9" height="33" rx="2" fill="#fff"/>
  <text x="172" y="145" font-family="${FONT}" font-size="46" font-weight="700" fill="${INK}">AI <tspan fill="${ACCENT}">News</tspan></text>

  <text x="88" y="240" font-family="${FONT}" font-size="62" font-weight="700" fill="${INK}">Хэрэглээний топ 5</text>
  <text x="88" y="288" font-family="${FONT}" font-size="32" fill="${MUTED}">OpenRouter, ${esc(dateLabel)} · өмнөх өдрөөс</text>
  ${items.join("\n")}

  <text x="88" y="${size - 70}" font-family="${FONT}" font-size="32" fill="${MUTED}">ainews.mn/jagsaalt</text>
</svg>`;
}
