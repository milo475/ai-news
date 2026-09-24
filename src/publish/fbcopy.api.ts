/**
 * Facebook постын текст — цэвэр хэсэг (LLM, DB-гүй тул тесттэй).
 *
 * Нийтлэлийн хураангуйг шууд хэрэглэхгүй: FB-д зориулж тусдаа бичүүлнэ.
 * Энд prompt, schema, бүтэц угсрах, шалгах дүрэм байна.
 */
import type { ArticleCategory } from "../generated/prisma/enums";
import { BASE_HASHTAGS, hashtagOf } from "./facebook.api";

/** Постын нийт урт (тэмдэгт) */
export const MIN_POST_CHARS = 400;
export const MAX_POST_CHARS = 700;

/** "See more"-оос өмнө харагдах эхний мөрийн дээд урт */
export const MAX_HOOK_CHARS = 90;

/** Hook-ийн 5 загвар — ээлжлэн хэрэглэж аль нь ажилладгийг хардаг */
export const HOOK_TYPES = ["number", "contrast", "question", "local", "forecast"] as const;
export type HookType = (typeof HOOK_TYPES)[number];

export const HOOK_HINT: Record<HookType, string> = {
  number: "тоо, фактаар эхэл (хэдэн хувь, хэдэн доллар, хэдэн хүн)",
  contrast: "зөрчил: нэг зүйл ийм байтал нөгөө нь тийм — «...гэтэл» гэсэн эргэлт",
  question: "уншигчид шууд хандсан асуулт",
  local: "Монгол эсвэл жирийн хүний өнцгөөс — энэ юу гэсэн үг",
  forecast: "дараа юу болох вэ гэсэн таамаг",
};

/** Ангилал бүрийн өнгө аяс */
export const CATEGORY_TONE: Record<ArticleCategory, string> = {
  NEWS: "Тайван, мэдээллийн. Хамгийн чухал баримтыг эхэнд нь тавь.",
  PROJECT: "Хэн, юуг, яаж хийснийг тодорхой хэл. Уншигч «би ч бас хийж чадах уу» гэж бодохоор бич.",
  BUSINESS: "Мөнгө, зардал, боломжийг тодорхой хэл. Хэн ч давтаж болох эсэхийг шулуухан бич.",
  FACT: "Гайхшрал — гол тоо, баримтыг түрүүнд. Хэтрүүлэхгүй, баримтаараа гайхуул.",
  RISK: "Тайван, айлгахгүй. Юу болсон, уншигч юу анхаарах ёстойг тодорхой хэл.",
  HOWTO: "Практик. Юуг, ямар дарааллаар хийхийг товч хэл.",
};

export const FB_COPY_SYSTEM = `Чи монгол хэлээр бичдэг сэтгүүлч. Facebook хуудсанд тавих пост бич.

ХЭВ МАЯГ: мэргэжлийн сэтгүүлч, гэхдээ уншигчтайгаа кофе уугаад ярьж байгаа мэт — тодорхой, итгэлтэй, заримдаа нэг хөнгөн үг.

ХАТУУ ДҮРЭМ:
- Emoji ХЭРЭГЛЭХГҮЙ. Огт.
- Хашилт, том үсгээр хашгирахгүй.
- Хэн бичсэн тухай юу ч бүү бич: "AI бичсэн", "ChatGPT-ээр бэлтгэсэн" гэх мэт зүйл байх ёсгүй.
- Эх сурвалжийн (сайт, хэвлэлийн) нэрийг бүү бич.
- Нийтлэлд байхгүй баримт, тоо бүү нэм.
- Кликбейт биш — амласнаа нийтлэл дотор нь өгдөг байх.

БҮТЭЦ (JSON-оор буцаана):
- hook: ганц мөр, ${MAX_HOOK_CHARS} тэмдэгтээс богино. Facebook-ийн "See more"-оос өмнө зөвхөн энэ мөр харагдана.
- body: 2–3 өгүүлбэр — яагаад чухал вэ, уншигчид юу гэсэн үг вэ.
- hashtags: 2–3 ширхэг, emoji-гүй, "#" тэмдэгтээр эхэлнэ.

Нийт пост 400–700 тэмдэгт болохоор бич.`;

/** LLM-д өгөх schema — 2 хувилбар, өөр өөр hook загвартай */
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
          hookType: { type: "string", enum: [...HOOK_TYPES] },
          hook: { type: "string", description: `Ганц мөр, ${MAX_HOOK_CHARS} тэмдэгтээс богино` },
          body: { type: "string", description: "2–3 өгүүлбэр" },
          hashtags: {
            type: "array", items: { type: "string" }, minItems: 2, maxItems: 3,
            description: "#-ээр эхэлсэн 2–3 шошго",
          },
        },
        required: ["hookType", "hook", "body", "hashtags"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
};

export interface CopyVariant {
  hookType: string;
  hook: string;
  body: string;
  hashtags: string[];
}

/** Хамгийн цөөн хэрэглэсэн hook загвараас 2-ыг сонгоно — 5 загвар жигд ээлжилнэ */
export function pickHookTypes(usage: Record<string, number>, rand = Math.random): HookType[] {
  const scored = HOOK_TYPES.map((t) => ({ t, n: usage[t] ?? 0, r: rand() }));
  scored.sort((a, b) => (a.n !== b.n ? a.n - b.n : a.r - b.r));
  return [scored[0]!.t, scored[1]!.t];
}

/** LLM-ийн өгсөн шошгыг цэвэрлэж, #AI #ХиймэлОюун-ийг нь баталгаажуулна */
export function normalizeHashtags(raw: string[]): string[] {
  const tags = [...BASE_HASHTAGS];
  for (const t of raw) {
    const tag = hashtagOf(t);
    if (tag && !tags.some((x) => x.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    if (tags.length === 3) break;
  }
  return tags;
}

/** Постын бүтэн текст: hook / body / «Дэлгэрэнгүй:» холбоос / hashtag */
export function assemblePost(v: CopyVariant, link: string): string {
  return [
    v.hook.trim(),
    v.body.trim(),
    `Дэлгэрэнгүй: ${link}`,
    normalizeHashtags(v.hashtags).join(" "),
  ].join("\n\n");
}

const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJI_ALL = /[\p{Extended_Pictographic}\uFE0F]/gu;
/** Зөвхөн том үсгээр бичсэн үг — товчлол (NASA, DARPA) хуурамч дохио өгөхгүйн тулд 2-оос олон бол хашгирсан гэж үзнэ */
const SHOUT_WORD = /(?:^|\s)([A-ZА-ЯӨҮЁ]{4,})(?=\s|$|[.,!?:;])/gu;
/** "AI бичсэн", "ChatGPT-ээр бэлтгэсэн" маягийн илчлэлт */
const AI_AUTHOR =
  /(AI|ИИ|хиймэл оюун\w*|ChatGPT|Gemini|Claude|GPT|Copilot|Grok)[^.!?\n]{0,40}(бичсэн|бичив|бэлтгэсэн|бэлтгэв|орчуулсан|орчуулав|үүсгэсэн|хийсэн байна)/iu;

export interface CopyProblem {
  code: "emoji" | "hook-long" | "quotes" | "shouting" | "ai-author" | "source-name" | "too-short" | "too-long";
  detail: string;
}

/**
 * Постыг дүрмийн дагуу шалгана. Хоосон массив = зүгээр.
 * @param forbidden эх сурвалжийн нэр гэх мэт постод гарч болохгүй үгс
 */
export function checkPost(post: string, hook: string, forbidden: string[] = []): CopyProblem[] {
  const problems: CopyProblem[] = [];
  if (EMOJI.test(post)) problems.push({ code: "emoji", detail: "emoji байна" });
  if (hook.length > MAX_HOOK_CHARS) {
    problems.push({ code: "hook-long", detail: `hook ${hook.length} тэмдэгт (${MAX_HOOK_CHARS}-аас урт)` });
  }
  if (/["«»“”]/.test(post)) problems.push({ code: "quotes", detail: "хашилт байна" });
  const shouts = [...post.replace(/#\S+/g, "").matchAll(SHOUT_WORD)].map((m) => m[1]!);
  if (shouts.length >= 2 || shouts.some((w) => w.length >= 8)) {
    problems.push({ code: "shouting", detail: `том үсгээр: ${shouts.join(", ")}` });
  }
  if (AI_AUTHOR.test(post)) problems.push({ code: "ai-author", detail: "AI бичсэн тухай дурдсан" });
  for (const name of forbidden) {
    const n = name.trim();
    if (n.length >= 4 && post.toLowerCase().includes(n.toLowerCase())) {
      problems.push({ code: "source-name", detail: `эх сурвалжийн нэр: ${n}` });
    }
  }
  if (post.length < MIN_POST_CHARS) problems.push({ code: "too-short", detail: `${post.length} тэмдэгт` });
  if (post.length > MAX_POST_CHARS) problems.push({ code: "too-long", detail: `${post.length} тэмдэгт` });
  return problems;
}

/** Засаж болох зөрчлийг механикаар арилгана (LLM дахин оролдсоны дараа ч үлдвэл) */
export function sanitizeVariant(v: CopyVariant): CopyVariant {
  const clean = (s: string) =>
    s.replace(EMOJI_ALL, "").replace(/["«»“”]/g, "").replace(/\s+/g, " ").trim();
  let hook = clean(v.hook);
  if (hook.length > MAX_HOOK_CHARS) {
    const cut = hook.slice(0, MAX_HOOK_CHARS - 1);
    const space = cut.lastIndexOf(" ");
    hook = `${(space > MAX_HOOK_CHARS * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:—-]+$/, "")}…`;
  }
  return { ...v, hook, body: clean(v.body) };
}
