/**
 * Facebook/Instagram постын текст — цэвэр хэсэг (LLM, DB-гүй тул тесттэй).
 *
 * Нэг пост = нэг санаа. Гарчгийг (headline) карт дээр бичдэг тул текст нь түүнийг
 * давтахгүй, харин тайлбарлана:
 *
 *   <1 өгүүлбэр — headline-ыг тайлбарласан контекст> <1–2 өгүүлбэр — яагаад чухал>
 *
 *   <Уншигчид хандсан 1 богино асуулт>
 *
 *   Холбоос коммент дээр.
 *
 *   Өдөр бүр AI-ийн сонирхолтой мэдээ авахыг хүсвэл AI News-ийг дагаарай.
 *
 * ГАДААД ХОЛБООС ПОСТЫН БИЕД БАЙХГҮЙ. Facebook нь гадагш чиглэсэн холбоостой постыг
 * 30–50% бага хүнд үзүүлдэг тул холбоосыг постлосны ДАРАА эхний коммент болгон тавина
 * (`linkComment()` → Graph `/{post-id}/comments`). Асуулт нь коммент цуглуулах зорилготой —
 * коммент нь постын хүрэлтийг мөн нэмдэг.
 */
import type { ArticleCategory } from "../generated/prisma/enums";

/** Постын биет (контекст + яагаад чухал) хэдэн тэмдэгт байх вэ */
export const MIN_BODY_CHARS = 250;
export const MAX_BODY_CHARS = 400;

/** Сүүлийн мөр — дагахыг урих */
export const FOLLOW_LINE = "Өдөр бүр AI-ийн сонирхолтой мэдээ авахыг хүсвэл AI News-ийг дагаарай.";

/** Холбоос биед байхгүй гэдгийг уншигчид хэлнэ */
export const LINK_IN_COMMENT_LINE = "Холбоос коммент дээр.";

/** Эхний комментын текст */
export function linkComment(link: string): string {
  return `Дэлгэрэнгүй: ${link}`;
}

/** Уншигчид хандсан асуултын дээд урт */
export const MAX_QUESTION_CHARS = 100;

/**
 * LLM-ийн санал болгосон hashtag-уудыг цэвэрлэнэ: «#» нэг л удаа, тэмдэгтгүй,
 * давхардалгүй, дээд тал нь 4.
 */
export function cleanTags(raw: string[], max = 4): string[] {
  const out: string[] = [];
  for (const t of raw) {
    const word = t.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
    if (!word || !/\p{L}/u.test(word)) continue;
    const tag = `#${word}`;
    if (out.some((x) => x.toLowerCase() === tag.toLowerCase())) continue;
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

/** Эх сурвалжийн мөрийн угтвар (FB_SHOW_SOURCE=true үед) */
export const SOURCE_PREFIX = "Эх сурвалж: ";

/** FB_SHOW_SOURCE — анхдагчаар эх сурвалжийн нэрийг бичихгүй */
export function showSource(env: Record<string, string | undefined> = process.env): boolean {
  return (env.FB_SHOW_SOURCE ?? "").trim().toLowerCase() === "true";
}

/** "https://www.theverge.com/x/y" → "theverge.com" */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Ангилал бүрийн өнгө аяс */
export const CATEGORY_TONE: Record<ArticleCategory, string> = {
  NEWS: "Тайван, мэдээллийн. Хамгийн чухал баримтыг эхэнд нь тавь.",
  PROJECT: "Хэн, юуг, яаж хийснийг тодорхой хэл. Уншигч «би ч бас хийж чадах уу» гэж бодохоор бич.",
  BUSINESS: "Мөнгө, зардал, боломжийг тодорхой хэл. Хэн ч давтаж болох эсэхийг шулуухан бич.",
  FACT: "Гайхшрал — гол тоо, баримтыг түрүүнд. Хэтрүүлэхгүй, баримтаараа гайхуул.",
  RISK: "Тайван, айлгахгүй. Юу болсон, уншигч юу анхаарах ёстойг тодорхой хэл.",
  HOWTO: "Практик. Юуг, ямар дарааллаар хийхийг товч хэл.",
};

export const FB_COPY_SYSTEM = `Чи монгол хэлээр бичдэг сэтгүүлч. Нийгмийн сүлжээний постын текст бич.

Зурган дээр аль хэдийн ГАРЧИГ бичигдсэн байгаа — түүнийг бүү давт, харин тайлбарла.

БҮТЭЦ (JSON-оор):
- context: НЭГ өгүүлбэр — гарчгийг тайлбарласан контекст (хэн, хаана, ямар нөхцөлд).
- why: 1–2 өгүүлбэр — яагаад чухал вэ, монгол уншигчид юу гэсэн үг вэ.
- question: уншигчид хандсан НЭГ богино асуулт (${MAX_QUESTION_CHARS} тэмдэгтээс багa).
- hashtags: 3–4 ширхэг сэдвийн шошго, "#" тэмдэгтээр эхэлнэ.

АСУУЛТ (question):
- Сэдэвтэй ЯГ холбоотой, хариулахад хялбар, «тийм/үгүй» эсвэл өөрийн туршлагаа хуваалцах
  боломжтой байх. Жишээ: "Та ажилдаа AI ашигладаг уу?", "Танай хүүхэд ийм апп хэрэглэдэг үү?"
- Зорилго нь коммент авах — сониуч, гэхдээ шар мэдээ биш.
- Ерөнхий, хоосон асуулт БОЛОХГҮЙ ("Та юу гэж бодож байна?" гэх мэт).

HASHTAG: кирилл ба латин ХОЛИМОГ бай (жишээ: #хиймэлоюун #chatgpt #технологи #openai).
Зөвхөн сэдвийн шошго — #Монгол, #AI зэрэг ерөнхийг систем өөрөө нэмнэ.

context + why нийлээд ${MIN_BODY_CHARS}–${MAX_BODY_CHARS} тэмдэгт байна.

ХЭВ МАЯГ: мэргэжлийн сэтгүүлч, гэхдээ уншигчтайгаа кофе уугаад ярьж байгаа мэт — тодорхой, итгэлтэй.

ҮНЭН ЗӨВ БАЙДАЛ (бусад бүх дүрмээс ДЭЭГҮҮР):
- Нийтлэлд БАЙХГҮЙ баримт, тодотгол, шинж чанарыг бүү нэм.
- Нийтлэлд байхгүй шалтгаан-үр дагаврыг бүү зохио («улмаас», «-аас болж», «оронд»).
- Хамрах хүрээг бүү өргөн: нэг муж → улс даяар, нэг төрөл → бүх төрөл, оролцогч → төсөл.
- Тоог контекстоос нь бүү салга.
- БУРУУТГАЛ, нэхэмжлэл, шүүх, компанийн мэдэгдэл, судалгаа, таамаг бол эх сурвалжийг
  ҮЛДЭЭ: «...гэж буруутгав», «...хэмээн шүүхэд өгчээ», «Anthropic зарлав», «судалгаагаар».
  Хэн нэгний үгийг тогтсон үнэн мэт бүү бич.

ХАТУУ ДҮРЭМ:
- Emoji ХЭРЭГЛЭХГҮЙ. Огт.
- Хашилт, том үсгээр хашгирахгүй.
- Хэн бичсэн тухай юу ч бүү бич: "AI бичсэн", "ChatGPT-ээр бэлтгэсэн" гэх мэт зүйл байх ёсгүй.
- Мэдээг нийтэлсэн САЙТ, хэвлэлийн нэрийг бүү бич (The Verge, TechCrunch, Futurism гэх мэт).
- Харин компани, модель, бүтээгдэхүүн, хүний нэрийг (Google, Gemini 4, Samsung, OpenAI) ТОДОРХОЙ бич —
  "судалгааны төв", "нэгэн компани" гэх мэт бүрхэг үг хэрэглэхийг хориглоно.
- Нийтлэлд байхгүй баримт, тоо бүү нэм.
- Холбоос бүү бич — систем түүнийг эхний коммент болгон тавина.

Хоёр хувилбар бич (өөр өнцгөөс).`;

export const FB_COPY_SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        properties: {
          context: { type: "string", description: "Нэг өгүүлбэр — гарчгийн контекст" },
          why: { type: "string", description: "1–2 өгүүлбэр — яагаад чухал" },
          question: {
            type: "string",
            description: `Уншигчид хандсан нэг богино асуулт, ${MAX_QUESTION_CHARS} тэмдэгтээс багa`,
          },
        },
        required: ["context", "why", "question"],
        additionalProperties: false,
      },
    },
    hashtags: {
      type: "array", items: { type: "string" }, minItems: 3, maxItems: 4,
      description: "#-ээр эхэлсэн сэдвийн шошго, кирилл+латин холимог",
    },
  },
  required: ["variants", "hashtags"],
  additionalProperties: false,
};

export interface CopyVariant {
  context: string;
  why: string;
  /** Уншигчид хандсан асуулт — постын сүүлд, коммент авах зорилготой */
  question: string;
}

/** Хоосон, хэт урт, эсвэл хэт ерөнхий асуултыг хаяна */
const VAGUE_QUESTION =
  /^(та\s+)?(юу\s+гэж\s+бодож\s+байна|ямар\s+санаа|та\s+юу\s+гэж\s+үзэж\s+байна)/iu;

/** Асуулт яагаад хаягдсаныг лог дээр харуулахад */
export type QuestionReject = "LLM асуулт өгөөгүй" | "хэт урт" | "асуултын тэмдэггүй" | "хэт ерөнхий";

export interface QuestionCheck {
  question: string | null;
  reason: QuestionReject | null;
}

/**
 * Асуултыг цэвэрлэж, хаясан бол ШАЛТГААНЫГ нь хамт буцаана.
 *
 * 2026-09-27-нд FB постод уншигчид хандсан асуулт огт гараагүй ч шалтгаан нь
 * лог дээр харагдахгүй байв — LLM өгөөгүй юу, эсвэл энэ шүүлт хаясан уу гэдэг нь
 * ялгагдахгүй бол алдааг олох аргагүй.
 */
export function checkQuestion(raw: string): QuestionCheck {
  const q = raw.replace(EMOJI_ALL, "").replace(/["«»“”]/g, "").replace(/\s+/g, " ").trim();
  if (!q) return { question: null, reason: "LLM асуулт өгөөгүй" };
  if (q.length > MAX_QUESTION_CHARS) return { question: null, reason: "хэт урт" };
  if (!q.endsWith("?")) return { question: null, reason: "асуултын тэмдэггүй" };
  if (VAGUE_QUESTION.test(q)) return { question: null, reason: "хэт ерөнхий" };
  return { question: q, reason: null };
}

export function cleanQuestion(raw: string): string | null {
  return checkQuestion(raw).question;
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;
const EMOJI_ALL = /[\p{Extended_Pictographic}️]/gu;

/** Биет: контекст + яагаад чухал */
export function bodyOf(v: CopyVariant): string {
  return `${v.context.trim()} ${v.why.trim()}`.replace(/\s+/g, " ").trim();
}

export interface PostParts {
  variant: CopyVariant;
  /** FB_SHOW_SOURCE=true үед эх сурвалжийн домэйн */
  sourceDomain?: string;
}

/**
 * FB постын бүтэн текст. **Холбоос агуулахгүй** — түүнийг `linkComment()`-ээр
 * эхний коммент болгон тавина.
 */
export function assemblePost(p: PostParts): string {
  const blocks = [bodyOf(p.variant)];
  const q = cleanQuestion(p.variant.question ?? "");
  if (q) blocks.push(q);
  blocks.push(LINK_IN_COMMENT_LINE);
  if (p.sourceDomain) blocks.push(`${SOURCE_PREFIX}${p.sourceDomain}`);
  blocks.push(FOLLOW_LINE);
  return blocks.join("\n\n");
}

/**
 * Нийтлэлийн эхний 1–2 өгүүлбэр — fidelity шүүгч FB текстийг хүлээж аваагүй үеийн
 * НӨӨЦ бие. Зохиогүй, нийтлэлээс шууд авсан тул гуйвуулах эрсдэлгүй.
 */
export const FALLBACK_BODY_CHARS = 320;

export function firstSentences(text: string | null, max = FALLBACK_BODY_CHARS): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;

  // Өгүүлбэрийн төгсгөлөөр таслана; олдохгүй бол үгээр
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (stop > max * 0.5) return cut.slice(0, stop + 1).trim();
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * Шүүгч хувилбаруудыг хүлээж аваагүй үед постын биеийг нийтлэлээс шууд бүрдүүлнэ.
 * Асуулт нэмэхгүй — зохиосон зүйл огт байхгүй байх нь энэ нөөцийн гол утга.
 */
export function fallbackVariant(a: { summaryMn: string | null; bodyMn: string | null }): CopyVariant | null {
  const context = firstSentences(a.summaryMn ?? a.bodyMn);
  if (context.length < 40) return null;
  return { context, why: "", question: "" };
}

/** «Дэлгэрэнгүй: https://...» хэлбэрийн мөр */
const STORED_LINK_LINE = /^\s*Дэлгэрэнгүй:\s*https?:\/\/\S+\s*$/i;

/**
 * DB-д хадгалсан хуучин `fbText`-ийг шинэ бүтэцтэй нийцүүлнэ.
 *
 * Холбоосыг комментод тавих болохоос ӨМНӨ бичигдсэн текстүүд биедээ
 * «Дэлгэрэнгүй: <url>» мөр агуулдаг. Тэднийг дахин бичүүлэхгүйгээр зөв постлоно:
 * холбоосын мөрийг хасаад «Холбоос коммент дээр» мөрийг нэмнэ.
 */
export function ensureLinkInComment(text: string): string {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b && !STORED_LINK_LINE.test(b));

  if (blocks.includes(LINK_IN_COMMENT_LINE)) return blocks.join("\n\n");

  // Дагах уриалгын ӨМНӨ тавина — эс тэгвээс төгсгөлд
  const at = blocks.indexOf(FOLLOW_LINE);
  if (at === -1) blocks.push(LINK_IN_COMMENT_LINE);
  else blocks.splice(at, 0, LINK_IN_COMMENT_LINE);
  return blocks.join("\n\n");
}

/**
 * Зураггүй нөөц хувилбар (link preview) — тэр постод холбоос нь хавсралт болж
 * ордог тул «Холбоос коммент дээр» гэсэн мөр нь зөрчилддөг. Түүнийг арилгана.
 */
export function withoutLinkNotice(text: string): string {
  return text
    .split(/\n{2,}/)
    .filter((b) => b.trim() !== LINK_IN_COMMENT_LINE)
    .join("\n\n");
}

export interface CopyProblem {
  code: "emoji" | "quotes" | "shouting" | "ai-author" | "source-name" | "too-short" | "too-long" | "has-link";
  detail: string;
}

/** Зөвхөн том үсгээр бичсэн үг — товчлол (NASA) хуурамч дохио өгөхгүйн тулд 2-оос олон бол */
const SHOUT_WORD = /(?:^|\s)([A-ZА-ЯӨҮЁ]{4,})(?=\s|$|[.,!?:;])/gu;
/** "AI бичсэн", "ChatGPT-ээр бэлтгэсэн" маягийн илчлэлт */
const AI_AUTHOR =
  /(AI|ИИ|хиймэл оюун\w*|ChatGPT|Gemini|Claude|GPT|Copilot|Grok)[^.!?\n]{0,40}(бичсэн|бичив|бэлтгэсэн|бэлтгэв|орчуулсан|орчуулав|үүсгэсэн|хийсэн байна)/iu;

/** Постын биетийг шалгана. Хоосон массив = зүгээр. */
export function checkBody(body: string, forbidden: string[] = []): CopyProblem[] {
  const problems: CopyProblem[] = [];
  if (EMOJI.test(body)) problems.push({ code: "emoji", detail: "emoji байна" });
  if (/["«»“”]/.test(body)) problems.push({ code: "quotes", detail: "хашилт байна" });

  const shouts = [...body.matchAll(SHOUT_WORD)].map((m) => m[1]!);
  if (shouts.length >= 2 || shouts.some((w) => w.length >= 8)) {
    problems.push({ code: "shouting", detail: `том үсгээр: ${shouts.join(", ")}` });
  }
  if (AI_AUTHOR.test(body)) problems.push({ code: "ai-author", detail: "AI бичсэн тухай дурдсан" });
  if (/https?:\/\//.test(body)) problems.push({ code: "has-link", detail: "холбоос байна" });

  for (const name of forbidden) {
    const n = name.trim();
    if (n.length >= 4 && body.toLowerCase().includes(n.toLowerCase())) {
      problems.push({ code: "source-name", detail: `эх сурвалжийн нэр: ${n}` });
    }
  }
  if (body.length < MIN_BODY_CHARS) problems.push({ code: "too-short", detail: `${body.length} тэмдэгт` });
  if (body.length > MAX_BODY_CHARS) problems.push({ code: "too-long", detail: `${body.length} тэмдэгт` });
  return problems;
}

/** Засаж болох зөрчлийг механикаар арилгана */
export function sanitizeVariant(v: CopyVariant): CopyVariant {
  const clean = (s: string) =>
    (s ?? "").replace(EMOJI_ALL, "").replace(/["«»“”]/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return { context: clean(v.context), why: clean(v.why), question: clean(v.question) };
}
