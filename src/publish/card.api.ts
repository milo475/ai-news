/**
 * Постын карт — цэвэр хэсэг (LLM, sharp-гүй тул тесттэй).
 *
 * Формат: 1080×1350 (4:5) гэрэл зураг, доод талд нь хар gradient, түүн дээр 2–4 мөр
 * цагаан headline. FB, IG хоёуланд feed дээр том харагдана.
 */
import type { ArticleCategory } from "../generated/prisma/enums";
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

Уншигчийг ГАЙХУУЛАХ эсвэл түүнд ШУУД ХАМААТАЙ ганц баримт сонго.

БҮТЭЦ: [хэн/юу] + [гайхалтай тоо эсвэл харьцуулалт] + [үр дагавар].

ХОРИОТОЙ:
- Огноо (2026, 9-р сарын 21, 21-нд) — зурган дээр огноо хэрэггүй.
- Мэдээллийн хуурай хэллэг: "танилцуулжээ", "зарлажээ", "төлөвлөжээ", "мэдэгдлээ".
  Оронд нь: "болж байна", "болно", "байдаг", "хүрчээ", "унтардаг болжээ".
- Emoji, хашилт, том үсгээр хашгирах.
- Хэн бичсэн тухай дурдах.
- ${MAX_HOOK_CHARS} тэмдэгтээс урт байх, хоёр өгүүлбэр болгох.

САЙН жишээ:
- Компаниас нэг ажилтан гарахад орлох зардал нь жилийн цалингаас 1.5–2 дахин их байдаг.
- Гэрийн энгийн хөргөгч хүртэл системийн алдаанаас болж унтардаг болжээ.
- Хиймэл оюун 5 хүн тутмын 1-ийн ажлын цагийг хоногт нэг цагаар хэмнэж байна.

МУУ жишээ:
- X компани шинэ бүтээгдэхүүнээ 9-р сарын 21-нд танилцууллаа.  (огноо + хуурай хэллэг)
- Технологи хурдацтай хөгжиж байна.  (тоо ч үгүй, баримт ч үгүй)

Тоо байхгүй сэдэвт харьцуулалт, эсрэгцүүлэл хэрэглэж болно ("хүртэл", "ч гэсэн", "гэвч").

Гурван өөр хувилбар бич — өөр өөр баримтаас эхэлсэн байх. Хувилбар бүрийг ӨӨРӨӨ үнэл:
surprise (гайхшрал), relevance (монгол уншигчид хамаатай эсэх), clarity (нэг уншаад ойлгогдох эсэх),
тус бүр 0–10. Зөвхөн JSON.`;

export const HOOK_SCHEMA = {
  type: "object",
  properties: {
    hooks: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: `Нэг өгүүлбэр, ${MAX_HOOK_CHARS} тэмдэгтээс богино` },
          surprise: { type: "integer", minimum: 0, maximum: 10 },
          relevance: { type: "integer", minimum: 0, maximum: 10 },
          clarity: { type: "integer", minimum: 0, maximum: 10 },
        },
        required: ["text", "surprise", "relevance", "clarity"],
        additionalProperties: false,
      },
    },
  },
  required: ["hooks"],
  additionalProperties: false,
};

export interface ScoredHook {
  text: string;
  surprise: number;
  relevance: number;
  clarity: number;
}

/** Гурван шалгуурын нийлбэр — сонголтын үндэс */
export function hookScore(h: ScoredHook): number {
  return (h.surprise ?? 0) + (h.relevance ?? 0) + (h.clarity ?? 0);
}

export interface HookProblem {
  code:
    | "empty" | "too-long" | "no-number" | "emoji" | "quotes" | "multi-sentence" | "shouting"
    | "date" | "press-release";
  detail: string;
}

const EMOJI = /[\p{Extended_Pictographic}\uFE0F]/u;

/** Огноо, он сар өдрийн хэлбэрүүд — "тоотой" гэж тооцогдохгүй */
// \b нь кирилл үсгийн хажууд ажиллахгүй тул зай/тэмдэгтийн заагаар шалгана
const DATE_PATTERNS: RegExp[] = [
  /(19|20)\d{2}\s*он[а-яөүё]*/gu,               // "2026 оны", "2026 онд"
  /\d{1,2}\s*-?\s*р\s+сар[а-яөүё]*/gu,          // "9-р сарын"
  /\d{1,2}\s*дугаар\s+сар[а-яөүё]*/gu,
  /\d{1,2}-(нд|ны|ний|нээс|наас)(?=\s|$|[.,!?])/gu, // "21-нд"
  /(19|20)\d{2}(?=\s|$|[.,!?])/gu,               // ганцаар "2026"
];

/** Огноо заасан хэсгүүдийг хасна */
export function stripDates(text: string): string {
  let out = text;
  for (const re of DATE_PATTERNS) out = out.replace(re, " ");
  return out.replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").trim();
}

/** Харьцуулалт/эсрэгцүүлэл — тоогүй ч гэсэн хүчтэй гарчиг болгодог үгс */
const CONTRAST_WORDS = ["хүртэл", "ч гэсэн", "гэвч", "атал", "байтал", "хэрнээ"];

/** Үр дагаврын тоо (огноо тооцохгүй) эсвэл харьцуулалт байна уу */
export function hasImpactNumber(text: string): boolean {
  if (/\d/.test(stripDates(text))) return true;
  const lower = text.toLowerCase();
  return CONTRAST_WORDS.some((w) => lower.includes(w));
}

/** Мэдээллийн хуурай хэллэг — зурган дээр хориотой */
const PRESS_RELEASE =
  /(танилцуул|зарла|төлөвлө|мэдэгдэ|хэлэлцэ|нээлтээ хий)[а-яөүё]*?(жээ|лаа|лээ|на|нэ|в)(?=\s|$|[.,!?])/iu;

/** Headline-ий шалгуур. Хоосон массив = зүгээр. */
export function checkHook(hook: string): HookProblem[] {
  const text = hook.trim();
  const problems: HookProblem[] = [];

  if (!text) return [{ code: "empty", detail: "хоосон" }];
  if (text.length > MAX_HOOK_CHARS) problems.push({ code: "too-long", detail: `${text.length} тэмдэгт` });
  if (stripDates(text) !== text) problems.push({ code: "date", detail: "огноо байна" });
  if (!hasImpactNumber(text)) {
    problems.push({ code: "no-number", detail: "үр дагаврын тоо ч, харьцуулалт ч алга" });
  }
  if (PRESS_RELEASE.test(text)) problems.push({ code: "press-release", detail: "мэдээллийн хуурай хэллэг" });
  if (EMOJI.test(text)) problems.push({ code: "emoji", detail: "emoji байна" });
  if (/["«»“”]/.test(text)) problems.push({ code: "quotes", detail: "хашилт байна" });
  if (/[.!?…]\s+\S/.test(text)) problems.push({ code: "multi-sentence", detail: "нэгээс олон өгүүлбэр" });
  // \b нь кирилл үсэгтэй ажиллахгүй тул зайгаар нь таслаж шалгана
  const shouts = [...text.matchAll(/(?:^|\s)([A-ZА-ЯӨҮЁ]{4,})(?=\s|$|[.,!?:;])/gu)].map((m) => m[1]!);
  if (shouts.length >= 2 || shouts.some((w) => w.length >= 8)) {
    problems.push({ code: "shouting", detail: `том үсгээр: ${shouts.join(", ")}` });
  }

  return problems;
}

/**
 * Хувилбаруудаас хамгийн өндөр оноотойг сонгоно (тэнцвэл богиныг).
 * Шалгуур давсан нь байхгүй бол null.
 */
export function pickHook(hooks: ScoredHook[]): ScoredHook | null {
  const valid = hooks
    .map((h) => ({ ...h, text: h.text?.trim() ?? "" }))
    .filter((h) => checkHook(h.text).length === 0 && fitHeadline(h.text) !== null)
    .sort((a, b) => (hookScore(b) - hookScore(a)) || (a.text.length - b.text.length));
  return valid[0] ?? null;
}

// ---------- Зургийн модель, тохиргоо ----------

/**
 * Анхдагч зургийн модель. 2026-09-24-нд туршихад нэг зураг ≈ $0.034 бөгөөд
 * gemini-2.5-flash-image ($0.039) нь зарим prompt дээр зургийн оронд текст буцаадаг байв.
 */
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
/** Үндсэн модель унасан үед оролдох нөөц */
export const FALLBACK_IMAGE_MODEL = "google/gemini-2.5-flash-image";

/** Өдөрт үүсгэх зургийн дээд тоо — зардлын хамгаалалт */
export const DEFAULT_IMAGE_DAILY_LIMIT = 5;

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

// ---------- Зургийн дүрслэл (scene) ----------

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

CATEGORY RULE (stated in the user message):
- FACT, HOWTO, PROJECT → everyday life ONLY. A laboratory, physics rig, cleanroom, microscope,
  test bench or research facility is FORBIDDEN. Show an ordinary person using the technology where
  they live and work: a phone in a hand, a laptop on a kitchen table, a home, a cafe, an office
  desk, a shop counter, a street, public transport.
- RISK, NEWS, BUSINESS → a professional setting is allowed when the article is about it
  (a courtroom, a server room, a factory floor, a government office).

Prefer the HUMAN side of the topic over a literal illustration: show who is affected and what they
do, not the technology itself. Examples:
- model compression / faster inference → someone using an assistant on their phone on a bus
- a new chip → a phone being unboxed or a laptop on a kitchen table, not a cleanroom
- a research paper → the everyday task the research changes
A literal lab, physics equipment or server room is allowed only when the article is about that place.

Rules:
- One sentence, English, under 200 characters.
- Compose for a 4:5 card: the subject sits in the upper two-thirds, the lower third stays empty
  or dark (a table, floor, wall or shadow) so a headline can be laid over it.
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

/** Хадгалсан prompt-оос тогтмол угтвар/хориглох жагсаалтыг хасаж зөвхөн дүрслэлийг үлдээнэ */
export function sceneOf(prompt: string): string {
  return prompt
    .replace(`${PHOTO_PROMPT_PREFIX}. `, "")
    .replace(`. ${PHOTO_PROMPT_NEGATIVE}.`, "")
    .replace(PHOTO_PROMPT_NEGATIVE, "")
    .trim();
}

/** Сүүлийн постуудын prompt-ыг LLM-д харуулж давхардлаас сэргийлнэ */
export function recentScenesBlock(prompts: string[]): string {
  const scenes = prompts
    .map(sceneOf)
    .filter(Boolean)
    .slice(0, RECENT_SCENES);
  if (scenes.length === 0) return "";
  return ["Recent scenes (do not repeat these subjects or angles):", ...scenes.map((s) => `- ${s}`)].join("\n");
}

/** Хэдэн постын зургийг давхардлын шалгалтад харгалзах вэ */
export const RECENT_SCENES = 10;

/** Хориглосон ерөнхий дүрслэлүүд — эдгээр таарвал нэг удаа дахин гаргуулна */
const GENERIC_PATTERNS: RegExp[] = [
  // «government office with a filing cabinet» гэх мэт тодорхой дүрслэлийг барихгүй —
  // зөвхөн ерөнхий тодотголтой оффисыг
  /\b(modern|bright|busy|generic|typical|corporate|open[- ]plan)\s+office\b/i,
  /\b(an?|the)\s+office\s+(interior|space|environment)\b/i,
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

/**
 * Сүүлийн постуудын аль нэгтэй хэт төстэй үү.
 * Хадгалсан prompt-ууд урт тогтмол угтвартай тул зөвхөн дүрслэлийг нь харьцуулна —
 * эс бөгөөс угтварын давхцал бодит ялгааг шингэлнэ.
 */
export function sceneTooSimilar(scene: string, recent: string[], threshold = 0.35): boolean {
  const target = sceneOf(scene);
  return recent.some((r) => similarity(target, sceneOf(r)) > threshold);
}

/** Ангилал бүрийн өнцөг — сэдвийн объектыг аль талаас нь харуулах вэ */
export const CATEGORY_SCENE_HINT: Record<ArticleCategory, string> = {
  NEWS: "show the thing the news is about (the device, building, vehicle, material, place)",
  PROJECT: "show an ordinary person using or showing off what was built, at home or at a work desk",
  BUSINESS: "show where the money is made: the shop floor, the goods, the machine, the counter",
  FACT: "show an ordinary person in daily life who benefits from the finding — never the research itself",
  RISK: "show the calm, concrete detail at stake (a lock, a camera, a document, a fence) — no alarm, no fear",
  HOWTO: "show the tool in use in everyday surroundings, from the user's point of view",
};

/**
 * Эдгээр ангилалд мэргэжлийн/судалгааны орчин хориотой — уншигч өөрийгөө таних ёстой.
 * RISK, NEWS, BUSINESS-д нийтлэл нь тэр тухай бол зөвшөөрнө.
 */
export const EVERYDAY_ONLY: ArticleCategory[] = ["FACT", "HOWTO", "PROJECT"];

/** Хориглох орчны түлхүүр үгс */
const LAB_PATTERNS: RegExp[] = [
  /\b(laborator(y|ies)|lab bench|lab coat)\b/i,
  /\b(cleanroom|clean room)\b/i,
  /\b(microscope|centrifuge|oscilloscope|spectrometer|pipette|petri dish)\b/i,
  /\b(physics|scientific|research)\s+(rig|instrument|equipment|apparatus|facility|bench|panel)\b/i,
  /\b(test bench|instrument panel|control panel|wafer|fume hood)\b/i,
  /\b(researcher|scientist|technician)\b/i,
];

/** Тухайн ангилалд зөвшөөрөгдөхгүй мэргэжлийн орчин мөн үү */
export function isLabScene(scene: string, category: ArticleCategory): boolean {
  if (!EVERYDAY_ONLY.includes(category)) return false;
  return LAB_PATTERNS.some((re) => re.test(scene));
}

// ---------- Зургийн prompt ----------

/**
 * Суурь зургийн тогтмол хэсэг — кино кадар/документари, "AI-style" гялтганахгүй.
 * Компози: гол объект дээд 2/3-д, доод 1/3 хоосон/харанхуй — тэнд headline бичигдэнэ.
 */
export const PHOTO_PROMPT_PREFIX =
  "documentary photograph, candid cinematic still, real people in a real place, 35mm film look, " +
  "slight grain, natural lighting, shallow depth of field, muted colours, 4:5 vertical framing, " +
  "main subject placed in the upper two-thirds of the frame, lower third empty and darker " +
  "(floor, table surface, shadow or wall) leaving clean space for a text overlay";

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
  /** Эх сурвалжийн зураг хэрэглэсэн бол доод баруун буланд: "Зураг: The Verge AI" */
  credit?: string;
  width?: number;
  height?: number;
}

/** Эх сурвалжийн зураг хэрэглэсэн үеийн credit текст */
export function creditText(sourceName: string): string {
  return `Зураг: ${sourceName}`;
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

  // Эх сурвалжийн зураг хэрэглэсэн бол доод баруун буланд жижгээр зохиогчийг нь бичнэ
  const credit = opts.credit
    ? `  <text x="${w - PAD}" y="${ctaY}" font-family="${font}" font-weight="400" font-size="24"\n` +
      `        fill="#ffffff" fill-opacity="0.55" text-anchor="end">${esc(opts.credit)}</text>`
    : "";

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
${credit}
</svg>`;
}
