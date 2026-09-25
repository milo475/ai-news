/**
 * Facebook/Instagram постын текст — цэвэр хэсэг (LLM, DB-гүй тул тесттэй).
 *
 * Нэг пост = нэг санаа. Гарчгийг (headline) карт дээр бичдэг тул текст нь түүнийг
 * давтахгүй, харин тайлбарлана:
 *
 *   <1 өгүүлбэр — headline-ыг тайлбарласан контекст> <1–2 өгүүлбэр — яагаад чухал>
 *
 *   Дэлгэрэнгүй: https://сайт/medee/slug
 *
 *   Өдөр бүр AI-ийн сонирхолтой мэдээ авахыг хүсвэл AI News-ийг дагаарай.
 */
import type { ArticleCategory } from "../generated/prisma/enums";

/** Постын биет (контекст + яагаад чухал) хэдэн тэмдэгт байх вэ */
export const MIN_BODY_CHARS = 250;
export const MAX_BODY_CHARS = 400;

/** Сүүлийн мөр — дагахыг урих */
export const FOLLOW_LINE = "Өдөр бүр AI-ийн сонирхолтой мэдээ авахыг хүсвэл AI News-ийг дагаарай.";

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
- hashtags: 2–4 ширхэг сэдвийн шошго, "#" тэмдэгтээр эхэлнэ.

context + why нийлээд ${MIN_BODY_CHARS}–${MAX_BODY_CHARS} тэмдэгт байна.

ХЭВ МАЯГ: мэргэжлийн сэтгүүлч, гэхдээ уншигчтайгаа кофе уугаад ярьж байгаа мэт — тодорхой, итгэлтэй.

ХАТУУ ДҮРЭМ:
- Emoji ХЭРЭГЛЭХГҮЙ. Огт.
- Хашилт, том үсгээр хашгирахгүй.
- Хэн бичсэн тухай юу ч бүү бич: "AI бичсэн", "ChatGPT-ээр бэлтгэсэн" гэх мэт зүйл байх ёсгүй.
- Мэдээг нийтэлсэн САЙТ, хэвлэлийн нэрийг бүү бич (The Verge, TechCrunch, Futurism гэх мэт).
- Харин компани, модель, бүтээгдэхүүн, хүний нэрийг (Google, Gemini 4, Samsung, OpenAI) ТОДОРХОЙ бич —
  "судалгааны төв", "нэгэн компани" гэх мэт бүрхэг үг хэрэглэхийг хориглоно.
- Нийтлэлд байхгүй баримт, тоо бүү нэм.
- Холбоос бүү бич — систем өөрөө нэмнэ.

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
        },
        required: ["context", "why"],
        additionalProperties: false,
      },
    },
    hashtags: {
      type: "array", items: { type: "string" }, minItems: 2, maxItems: 4,
      description: "#-ээр эхэлсэн сэдвийн шошго",
    },
  },
  required: ["variants", "hashtags"],
  additionalProperties: false,
};

export interface CopyVariant {
  context: string;
  why: string;
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;
const EMOJI_ALL = /[\p{Extended_Pictographic}️]/gu;

/** Биет: контекст + яагаад чухал */
export function bodyOf(v: CopyVariant): string {
  return `${v.context.trim()} ${v.why.trim()}`.replace(/\s+/g, " ").trim();
}

export interface PostParts {
  variant: CopyVariant;
  link: string;
  /** FB_SHOW_SOURCE=true үед эх сурвалжийн домэйн */
  sourceDomain?: string;
}

/** FB постын бүтэн текст */
export function assemblePost(p: PostParts): string {
  const blocks = [bodyOf(p.variant), `Дэлгэрэнгүй: ${p.link}`];
  if (p.sourceDomain) blocks.push(`${SOURCE_PREFIX}${p.sourceDomain}`);
  blocks.push(FOLLOW_LINE);
  return blocks.join("\n\n");
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
    s.replace(EMOJI_ALL, "").replace(/["«»“”]/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return { context: clean(v.context), why: clean(v.why) };
}
