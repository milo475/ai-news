/**
 * Instagram постын цэвэр хэсэг (HTTP, DB-гүй тул тесттэй).
 *
 * IG постод холбоос дарагддаггүй тул FB текстийн «Дэлгэрэнгүй: <url>» мөрийг
 * «Дэлгэрэнгүй холбоос bio-д.» болгож сольж, hashtag-ийг 5–8 болгож өргөтгөнө.
 */
import { hashtagOf } from "./facebook.api";
import { siteUrl } from "../lib/site";
import { FOLLOW_LINE, SOURCE_PREFIX } from "./fbcopy.api";

/** Instagram-ийн caption-ий дээд урт */
export const MAX_CAPTION_CHARS = 2_200;

/** Ийм удаа алдвал тухайн нийтлэлийг IG дараалалаас гаргана */
export const MAX_IG_ATTEMPTS = 3;

/** Холбоос дарагддаггүй тул bio руу чиглүүлнэ */
export const BIO_LINE = "Дэлгэрэнгүй холбоос bio-д.";

/** IG постод үргэлж явах hashtag-ууд */
export const IG_BASE_HASHTAGS = ["#AI", "#ХиймэлОюун", "#Монгол", "#технологи"];

/** Нийт hashtag-ийн доод/дээд тоо */
export const MIN_HASHTAGS = 5;
export const MAX_HASHTAGS = 8;

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
  return t === FOLLOW_LINE || t.startsWith(SOURCE_PREFIX);
}

/** Мөр нь зөвхөн hashtag-уудаас тогтож байна уу */
function isHashtagLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => w.startsWith("#"));
}

/**
 * FB текстээс IG caption үүсгэнэ.
 * @param extraTags сэдвийн нэрс (модель, компани, шошго) — hashtag болгоно
 */
export function buildCaption(fbText: string, extraTags: string[] = []): string {
  const blocks = fbText.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const body: string[] = [];
  const found: string[] = [];
  for (const block of blocks) {
    if (LINK_LINE.test(block)) continue;              // холбоосын мөрийг хаяна
    if (isFbOnlyLine(block)) continue;                // FB-ийн дагах уриалга, эх сурвалж
    if (isHashtagLine(block)) {
      found.push(...block.split(/\s+/).filter(Boolean));
      continue;
    }
    body.push(block.replace(EMOJI, "").trim());
  }

  const tags: string[] = [];
  const add = (raw: string) => {
    const tag = hashtagOf(raw);
    if (!tag || tags.length >= MAX_HASHTAGS) return;
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  };
  for (const t of IG_BASE_HASHTAGS) add(t);
  // Сэдвийн шошго: FB текстэд байсан нь эхэлж, дараа нь нэрс
  for (const t of [...found, ...extraTags]) add(t);

  const caption = [...body, BIO_LINE, tags.join(" ")].join("\n\n");
  return caption.length <= MAX_CAPTION_CHARS ? caption : trimCaption(body, tags);
}

/** Хэт урт бол биетийг ард талаас нь хасна — hashtag ба bio мөр үргэлж үлдэнэ */
function trimCaption(body: string[], tags: string[]): string {
  const tail = `\n\n${BIO_LINE}\n\n${tags.join(" ")}`;
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
  code: "emoji" | "too-long" | "few-hashtags" | "many-hashtags" | "has-link";
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
  if (tags.length < MIN_HASHTAGS) problems.push({ code: "few-hashtags", detail: `${tags.length} hashtag` });
  if (tags.length > MAX_HASHTAGS) problems.push({ code: "many-hashtags", detail: `${tags.length} hashtag` });
  if (/https?:\/\//.test(caption)) problems.push({ code: "has-link", detail: "холбоос байна" });
  return problems;
}

/** Зургийн нийтийн хаяг — Instagram-ийн сервер үүгээр татна */
export function publicImageUrl(articleId: string, site = siteUrl()): string {
  return `${site.replace(/\/+$/, "")}/api/fb-image/${articleId}`;
}
