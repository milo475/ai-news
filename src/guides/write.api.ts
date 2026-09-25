/**
 * Заавар бичүүлэх LLM-ийн prompt, схем, шалгуур — цэвэр хэсэг (DB, сүлжээгүй).
 *
 * ЧУХАЛ: мэдээний FB текстэд «хиймэл оюуны загварын нэр бүү дурд» гэсэн дүрэм байдаг.
 * Энд тэр дүрэм ХАМААРАХГҮЙ — заавар нь ChatGPT, Gemini, Canva-г нэрээр нь заах ёстой.
 */
import type { GuideLevel } from "../generated/prisma/enums";

export const LEVELS: GuideLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

export const LEVEL_LABEL: Record<GuideLevel, string> = {
  BEGINNER: "Анхан шат",
  INTERMEDIATE: "Дунд шат",
  ADVANCED: "Ахисан шат",
};

/** Хэнд зориулсан — шүүлтүүрийн тогтмол жагсаалт */
export const AUDIENCES = ["оюутан", "ажилтан", "бизнес эрхлэгч", "багш", "эцэг эх"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const MIN_STEPS = 5;
export const MAX_STEPS = 8;
export const MIN_FAQ = 3;
export const MAX_FAQ = 5;
/** Алхам бүрийн үгийн дээд хязгаар */
export const MAX_STEP_WORDS = 120;
export const MAX_LEAD_CHARS = 300;

export const GUIDE_SYSTEM = `Чи монгол хэлээр практик гарын авлага бичдэг редактор. Уншигч нь
техникийн бус энгийн хүн — түүнд алхам алхмаар заана.

ХЭЛЛЭГ
- «Та» гэж хүндэтгэлээр хандана.
- Энгийн, ойлгомжтой. Техникийн үгийг заавал хэрэглэх бол хажууд нь нэг өгүүлбэрээр тайлбарла.
- Монгол жишээ ашигла: ХХК-ийн санхүүч, СЭЗИС-ийн оюутан, Улаанбаатарын жижиг дэлгүүр гэх мэт.
- Emoji ХЭРЭГЛЭХГҮЙ. Хашилтаар хашиж хашгирахгүй.
- «AI бичсэн», «би хиймэл оюун» гэх мэт өөрийгөө дурдахгүй.

ХЭРЭГСЛИЙН НЭР
- ChatGPT, Gemini, Claude, Canva, Copilot гэх мэт бодит хэрэгслийг НЭРЭЭР НЬ заа. Бүрхэг
  «нэгэн хэрэгсэл» гэж бичихийг хориглоно.
- Үнэгүй эсэх, утсан дээр ажилладаг эсэхийг мэдэж байвал хэл. Мэдэхгүй бол бүү зохио.

БҮТЭЦ (JSON-оор буцаана)
- title: ≤60 тэмдэгт. Хайлтад ойлгогдохоор — юу хийхийг шууд хэл.
- lead: ЯГ 2 өгүүлбэр, нийт ≤${MAX_LEAD_CHARS} тэмдэгт. Уншигч юу сурахыг хэлнэ.
- steps: ${MIN_STEPS}–${MAX_STEPS} алхам. Алхам бүр:
  - heading: үйлдлийг заасан богино гарчиг (тоогоор эхлүүлэхгүй — дугаарлалтыг систем хийнэ).
  - body: ≤${MAX_STEP_WORDS} үг. Яг юу дарах, юу бичихийг тодорхой хэл.
  - prompt: (заавал биш) уншигчийн ХУУЛЖ БОЛОХ бэлэн prompt. Монголоор, тухайн алхамд
    яг тохирсон, ≥15 үг. Хэрэггүй бол хоосон орхи.
- mistakes: 3–5 ширхэг түгээмэл алдаа. Алдаа бүр нэг өгүүлбэр + яаж засахыг нэг өгүүлбэрээр.
- faq: ${MIN_FAQ}–${MAX_FAQ} асуулт хариулт. Асуулт нь хүмүүсийн Google-д бичдэг байдлаар
  ("ChatGPT үнэгүй юу?"), хариулт 2–4 өгүүлбэр.
- tools: дурдсан хэрэгслүүдийн нэр (2–6).
- audience: дараахаас сонго — ${AUDIENCES.join(", ")}.`;

export const GUIDE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "≤60 тэмдэгт, юу хийхийг шууд хэлсэн гарчиг" },
    lead: { type: "string", description: "Яг 2 өгүүлбэр" },
    steps: {
      type: "array", minItems: MIN_STEPS, maxItems: MAX_STEPS,
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string", description: `≤${MAX_STEP_WORDS} үг` },
          prompt: { type: "string", description: "Хуулж болох prompt эсвэл хоосон" },
        },
        required: ["heading", "body", "prompt"],
        additionalProperties: false,
      },
    },
    mistakes: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    faq: {
      type: "array", minItems: MIN_FAQ, maxItems: MAX_FAQ,
      items: {
        type: "object",
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
        additionalProperties: false,
      },
    },
    tools: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
    audience: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", enum: [...AUDIENCES] } },
  },
  required: ["title", "lead", "steps", "mistakes", "faq", "tools", "audience"],
  additionalProperties: false,
};

export interface GuideStepDraft {
  heading: string;
  body: string;
  prompt: string;
}

export interface GuideDraft {
  title: string;
  lead: string;
  steps: GuideStepDraft[];
  mistakes: string[];
  faq: { q: string; a: string }[];
  tools: string[];
  audience: string[];
}

export const MISTAKES_HEADING = "Түгээмэл алдаа";

/** LLM-ийн гаргалтыг bodyMd болгоно (## алхам + ```prompt блок) */
export function toMarkdown(d: GuideDraft): string {
  const blocks: string[] = [];
  d.steps.forEach((s, i) => {
    blocks.push(`## ${i + 1}. ${s.heading.replace(/^\d+[.)]\s*/, "").trim()}`);
    blocks.push(s.body.trim());
    const prompt = s.prompt?.trim();
    if (prompt) blocks.push(["```prompt", prompt, "```"].join("\n"));
  });
  if (d.mistakes.length > 0) {
    blocks.push(`## ${MISTAKES_HEADING}`);
    blocks.push(d.mistakes.map((m) => `- ${m.trim()}`).join("\n"));
  }
  return blocks.join("\n\n");
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;
/** "AI бичсэн" маягийн илчлэлт — зааварт хэрэгслийн нэр зөвшөөрөгдөнө, өөрийгөө дурдах нь үгүй */
const SELF_REFERENCE =
  /(би|энэ гарын авлагыг|энэ зааврыг)[^.!?\n]{0,30}(хиймэл оюун|AI|хэлний загвар)[^.!?\n]{0,30}(бичсэн|бэлтгэсэн|үүсгэсэн)/iu;

export interface GuideProblem {
  code:
    | "title-empty" | "title-long" | "lead-short" | "lead-long" | "few-steps" | "many-steps"
    | "step-empty" | "step-long" | "few-faq" | "many-faq" | "faq-empty" | "emoji" | "self-reference"
    | "no-tools" | "bad-audience" | "short-prompt";
  detail: string;
}

export const MAX_TITLE_CHARS = 60;
const MIN_PROMPT_WORDS = 15;

function words(s: string): number {
  return s.split(/\s+/u).filter(Boolean).length;
}

/** Бичигдсэн зааврыг шалгана. Хоосон массив = зүгээр. */
export function checkGuide(d: GuideDraft): GuideProblem[] {
  const p: GuideProblem[] = [];
  const title = d.title?.trim() ?? "";
  if (!title) p.push({ code: "title-empty", detail: "гарчиг хоосон" });
  else if (title.length > MAX_TITLE_CHARS) p.push({ code: "title-long", detail: `${title.length} тэмдэгт` });

  const lead = d.lead?.trim() ?? "";
  if (lead.length < 40) p.push({ code: "lead-short", detail: `${lead.length} тэмдэгт` });
  if (lead.length > MAX_LEAD_CHARS) p.push({ code: "lead-long", detail: `${lead.length} тэмдэгт` });

  const steps = d.steps ?? [];
  if (steps.length < MIN_STEPS) p.push({ code: "few-steps", detail: `${steps.length} алхам` });
  if (steps.length > MAX_STEPS) p.push({ code: "many-steps", detail: `${steps.length} алхам` });
  for (const [i, s] of steps.entries()) {
    if (!s.heading?.trim() || !s.body?.trim()) {
      p.push({ code: "step-empty", detail: `${i + 1}-р алхам дутуу` });
      continue;
    }
    if (words(s.body) > MAX_STEP_WORDS) {
      p.push({ code: "step-long", detail: `${i + 1}-р алхам ${words(s.body)} үг` });
    }
    const prompt = s.prompt?.trim() ?? "";
    if (prompt && words(prompt) < MIN_PROMPT_WORDS) {
      p.push({ code: "short-prompt", detail: `${i + 1}-р алхмын prompt ${words(prompt)} үг` });
    }
  }

  const faq = d.faq ?? [];
  if (faq.length < MIN_FAQ) p.push({ code: "few-faq", detail: `${faq.length} асуулт` });
  if (faq.length > MAX_FAQ) p.push({ code: "many-faq", detail: `${faq.length} асуулт` });
  if (faq.some((f) => !f.q?.trim() || !f.a?.trim())) p.push({ code: "faq-empty", detail: "хоосон FAQ" });

  if (!d.tools?.some((t) => t.trim())) p.push({ code: "no-tools", detail: "хэрэгсэл дурдаагүй" });
  const audience = (d.audience ?? []).filter((a) => (AUDIENCES as readonly string[]).includes(a));
  if (audience.length === 0) p.push({ code: "bad-audience", detail: "зорилтот уншигч танигдсангүй" });

  const all = [title, lead, ...steps.flatMap((s) => [s.heading ?? "", s.body ?? "", s.prompt ?? ""]),
    ...(d.mistakes ?? []), ...faq.flatMap((f) => [f.q ?? "", f.a ?? ""])].join("\n");
  if (EMOJI.test(all)) p.push({ code: "emoji", detail: "emoji байна" });
  if (SELF_REFERENCE.test(all)) p.push({ code: "self-reference", detail: "AI бичсэн тухай дурдсан" });
  return p;
}

/** Засаж болох зөрчлийг механикаар арилгана */
export function sanitizeDraft(d: GuideDraft): GuideDraft {
  const clean = (s: string) => (s ?? "").replace(/[\p{Extended_Pictographic}️]/gu, "").replace(/[ \t]+/g, " ").trim();
  return {
    title: clean(d.title),
    lead: clean(d.lead),
    steps: (d.steps ?? []).map((s) => ({
      heading: clean(s.heading),
      body: clean(s.body),
      // Prompt дотор мөр таслалт утга учиртай тул зөвхөн emoji арилгана
      prompt: (s.prompt ?? "").replace(/[\p{Extended_Pictographic}️]/gu, "").trim(),
    })),
    mistakes: (d.mistakes ?? []).map(clean).filter(Boolean),
    faq: (d.faq ?? []).map((f) => ({ q: clean(f.q), a: clean(f.a) })).filter((f) => f.q && f.a),
    tools: (d.tools ?? []).map(clean).filter(Boolean),
    audience: (d.audience ?? []).map(clean).filter((a) => (AUDIENCES as readonly string[]).includes(a)),
  };
}

/** Сэдэв, уншигч, түвшнээс LLM-д өгөх хэрэглэгчийн мессеж */
export function guidePrompt(topic: string, audience: string, level: GuideLevel): string {
  return [
    `Сэдэв: ${topic}`,
    `Зорилтот уншигч: ${audience}`,
    `Түвшин: ${LEVEL_LABEL[level]}`,
    level === "BEGINNER"
      ? "Уншигч энэ хэрэгслийг огт ашиглаж байгаагүй гэж үз — бүртгүүлэхээс эхэл."
      : level === "INTERMEDIATE"
        ? "Уншигч үндсийг нь мэднэ — цаг хэмнэх, чанар сайжруулах аргад төвлөр."
        : "Уншигч туршлагатай — автоматжуулалт, нарийн тохиргоо, хязгаарлалтыг яри.",
  ].join("\n");
}
