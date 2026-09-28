/**
 * Instagram постын цэвэр хэсэг (HTTP, DB-гүй тул тесттэй).
 *
 * IG постод холбоос дарагддаггүй тул FB текстийн холбоосын мөрийг «Дэлгэрэнгүй холбоос
 * bio-д.» болгож сольно.
 *
 * Hashtag нь **caption-д биш, эхний коммент** болж явна: caption цэвэрхэн харагдана,
 * хүрэлт нь ижил (Instagram хоёуланг адил индекслэдэг). 12–15 ширхэг, гурван давхарга:
 *   а) өргөн монгол — #монгол #mongolia #улаанбаатар ...
 *   б) niche — #aimongolia #хиймэлоюун #ai #chatgpt ...
 *   в) сэдвийн 3–4 — LLM-ийн санал (Article.fbTags), кирилл+латин холимог
 */
import { hashtagOf } from "./facebook.api";
import { siteUrl } from "../lib/site";
import { FOLLOW_LINE, LINK_IN_COMMENT_LINE, SOURCE_PREFIX } from "./fbcopy.api";

/** Instagram-ийн caption-ий дээд урт */
export const MAX_CAPTION_CHARS = 2_200;

/** Ийм удаа алдвал тухайн нийтлэлийг IG дараалалаас гаргана */
export const MAX_IG_ATTEMPTS = 3;

/** Холбоос дарагддаггүй тул bio руу чиглүүлнэ */
export const BIO_LINE = "Дэлгэрэнгүй холбоос bio-д.";

/** (а) Өргөн — монголын бүх хэрэглэгч хайдаг, урсгал их */
export const IG_BROAD_HASHTAGS = [
  "#монгол", "#mongolia", "#улаанбаатар", "#ulaanbaatar", "#монголмэдээ", "#мэдээ",
];

/** (б) Niche — бидний сэдвийн цөм, өрсөлдөөн бага, чанартай дагагч */
export const IG_NICHE_HASHTAGS = [
  "#aimongolia", "#хиймэлоюун", "#технологи", "#technology", "#ai", "#chatgpt",
];

/** (в) Сэдвийн шошгыг хэдээр хязгаарлах вэ */
export const MAX_TOPIC_HASHTAGS = 4;

/** Нийт hashtag-ийн доод/дээд тоо */
export const MIN_HASHTAGS = 12;
export const MAX_HASHTAGS = 15;

/** Instagram-ийн alt text-ийн дээд урт */
export const MAX_ALT_CHARS = 1_000;

/** IG_USER_ID — хоосон бол Instagram алхам алгасагдана */
export function igUserId(env: Record<string, string | undefined> = process.env): string | null {
  return env.IG_USER_ID?.trim() || null;
}

const EMOJI = /[\p{Extended_Pictographic}️]/gu;

/** «Дэлгэрэнгүй: https://...» хэлбэрийн мөр */
const LINK_LINE = /^\s*Дэлгэрэнгүй:\s*https?:\/\/\S+\s*$/i;

/** FB-д зориулсан мөрүүд — IG-д орохгүй */
function isFbOnlyLine(line: string): boolean {
  const t = line.trim();
  // «Холбоос коммент дээр» нь FB-ийн зохицуулалт — IG-д bio мөр орно
  return t === FOLLOW_LINE || t === LINK_IN_COMMENT_LINE || t.startsWith(SOURCE_PREFIX);
}

/**
 * Гурван давхаргын hashtag — 12–15 ширхэг.
 *
 * Сэдвийн шошго эхэлж (хамгийн хамааралтай), дараа нь niche, өргөнийг нөхөж тавина.
 * Давхардлыг үл хамаарах том/жижиг үсгээр шүүнэ.
 */
export function buildHashtags(topicTags: string[] = []): string[] {
  const tags: string[] = [];
  const add = (raw: string) => {
    const tag = hashtagOf(raw);
    if (!tag || tags.length >= MAX_HASHTAGS) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    tags.push(tag);
  };

  // (в) сэдвийн — 3–4
  for (const t of topicTags.slice(0, MAX_TOPIC_HASHTAGS)) add(t);
  // (б) niche
  for (const t of IG_NICHE_HASHTAGS) add(t);
  // (а) өргөн
  for (const t of IG_BROAD_HASHTAGS) add(t);
  return tags;
}

/** Эхний комментын текст — зөвхөн hashtag */
export function hashtagComment(tags: string[]): string {
  return tags.join(" ");
}

/**
 * Зургийн alt text — headline-аас.
 *
 * Instagram-д хараагүй хүн зургийг ойлгоход, мөн IG-ийн хайлтад хэрэглэгддэг.
 */
export function altTextFor(headline: string | null, titleMn: string | null = null): string | null {
  const raw = (headline ?? titleMn ?? "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const text = `AI News картын зураг. ${raw}`;
  return text.length <= MAX_ALT_CHARS ? text : `${text.slice(0, MAX_ALT_CHARS - 1)}…`;
}

/** Мөр нь зөвхөн hashtag-уудаас тогтож байна уу */
function isHashtagLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => w.startsWith("#"));
}

/**
 * FB текстээс IG caption үүсгэнэ. **Hashtag багтахгүй** — тэдгээр нь эхний коммент
 * болж явна (`buildHashtags` + `hashtagComment`).
 */
export function buildCaption(fbText: string): string {
  const blocks = fbText.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const body: string[] = [];
  for (const block of blocks) {
    if (LINK_LINE.test(block)) continue;              // холбоосын мөрийг хаяна
    if (isFbOnlyLine(block)) continue;                // FB-ийн дагах уриалга, эх сурвалж
    if (isHashtagLine(block)) continue;               // hashtag caption-д орохгүй
    body.push(block.replace(EMOJI, "").trim());
  }

  const caption = [...body, BIO_LINE].join("\n\n");
  return caption.length <= MAX_CAPTION_CHARS ? caption : trimCaption(body);
}

/** Хэт урт бол биетийг ард талаас нь хасна — bio мөр үргэлж үлдэнэ */
function trimCaption(body: string[]): string {
  const tail = `\n\n${BIO_LINE}`;
  const room = MAX_CAPTION_CHARS - tail.length;
  const kept: string[] = [];
  let used = 0;
  for (const block of body) {
    const cost = block.length + (kept.length ? 2 : 0);
    if (used + cost > room) break;
    kept.push(block);
    used += cost;
  }
  return `${kept.join("\n\n")}${tail}`;
}

export interface CaptionProblem {
  code: "emoji" | "too-long" | "has-link" | "has-hashtag" | "few-hashtags" | "many-hashtags";
  detail: string;
}

/** Caption-ий шалгалт — постлохоос өмнө */
export function checkCaption(caption: string): CaptionProblem[] {
  const problems: CaptionProblem[] = [];
  if (EMOJI.test(caption)) problems.push({ code: "emoji", detail: "emoji байна" });
  if (caption.length > MAX_CAPTION_CHARS) {
    problems.push({ code: "too-long", detail: `${caption.length} тэмдэгт` });
  }
  const tags = caption.match(/#\S+/g) ?? [];
  // Hashtag нь эхний комментод явах ёстой — caption цэвэрхэн байна
  if (tags.length > 0) problems.push({ code: "has-hashtag", detail: `${tags.length} hashtag` });
  if (/https?:\/\//.test(caption)) problems.push({ code: "has-link", detail: "холбоос байна" });
  return problems;
}

/** Hashtag-ийн тооны шалгалт */
export function checkHashtags(tags: string[]): CaptionProblem[] {
  const problems: CaptionProblem[] = [];
  if (tags.length < MIN_HASHTAGS) problems.push({ code: "few-hashtags", detail: `${tags.length} hashtag` });
  if (tags.length > MAX_HASHTAGS) problems.push({ code: "many-hashtags", detail: `${tags.length} hashtag` });
  return problems;
}

/** Зургийн нийтийн хаяг — Instagram-ийн сервер үүгээр татна */
export function publicImageUrl(articleId: string, site = siteUrl()): string {
  return `${site.replace(/\/+$/, "")}/api/fb-image/${articleId}`;
}

// ---------- Дараалал ----------

/**
 * IG-д хожуу тавихгүй байх хугацаа.
 *
 * Мэдээ 36 цагаас хуучирсан бол IG-д тавих нь хэрэглэгчийн хувьд «хуучин мэдээ»
 * болохоос гадна FB-тэй давхардсан дараалал үүсгэнэ. Ийм нийтлэлийг дарааллаас
 * хасна — оролдож унаж байгаа юм биш, зориуд алгасаж байгаа.
 */
export const IG_MAX_AGE_HOURS = 36;

export function igAgeCutoff(now: Date, hours = IG_MAX_AGE_HOURS): Date {
  return new Date(now.getTime() - hours * 3_600_000);
}

/** Нийтлэл IG-д тавихад хэт хуучирсан эсэх */
export function tooOldForIg(publishedAt: Date | null, now: Date, hours = IG_MAX_AGE_HOURS): boolean {
  if (!publishedAt) return false;
  return publishedAt.getTime() < igAgeCutoff(now, hours).getTime();
}

export interface QueueRow {
  hasImage: boolean;
  hasText: boolean;
  publishedAt: Date | null;
}

export interface QueueBreakdown {
  /** Одоо постлож болох */
  eligible: number;
  /** FB текст бичигдээгүй — IG тайлбар үүсгэх эх байхгүй */
  noText: number;
  /** 36 цагаас хуучин — дарааллаас хасагдана */
  tooOld: number;
  /** Зураггүй */
  noImage: number;
}

/**
 * Дараалалд юу байгааг ангилна.
 *
 * Өмнө нь `igQueueSize` нь зөвхөн зурагтай эсэхийг шалгадаг байсан ч сонголтын
 * query нь `fbText` -ийг БАС шаарддаг байв. Тиймээс «0 постлосон, дараалалд 6»
 * гэсэн зөрүү гарч, юу ч хийгдэхгүй байгаа шалтгаан харагдахгүй байлаа.
 */
export function breakdown(rows: QueueRow[], now: Date, hours = IG_MAX_AGE_HOURS): QueueBreakdown {
  const out: QueueBreakdown = { eligible: 0, noText: 0, tooOld: 0, noImage: 0 };
  for (const r of rows) {
    if (!r.hasImage) out.noImage++;
    else if (tooOldForIg(r.publishedAt, now, hours)) out.tooOld++;
    else if (!r.hasText) out.noText++;
    else out.eligible++;
  }
  return out;
}

/** Логт нэг мөрөөр: «дараалалд 6 (бэлэн 0, текстгүй 4, хуучин 2)» */
export function queueLabel(b: QueueBreakdown): string {
  const total = b.eligible + b.noText + b.tooOld + b.noImage;
  const parts = [`бэлэн ${b.eligible}`];
  if (b.noText) parts.push(`текстгүй ${b.noText}`);
  if (b.tooOld) parts.push(`36ц-аас хуучин ${b.tooOld}`);
  if (b.noImage) parts.push(`зураггүй ${b.noImage}`);
  return `${total} (${parts.join(", ")})`;
}
