/**
 * Эцсийн гаргалтыг ХЭРЭГСЭЛ ТУС БҮРЭЭР салгаж зэрэг үүсгэх схем, prompt.
 *
 * П.1-д бүх хэрэгслийг НЭГ дуудлагаар бичүүлдэг байсан: 12 000 токен, бүх
 * хэрэгслийн лавлах нэг prompt-д, дунджаар 100 секунд (хамгийн муу нь 187с).
 * Одоо хэрэгсэл бүр өөрийн жижиг дуудлагатай (зөвхөн ӨӨРИЙН лавлах) ба бүгд
 * зэрэг явна — нийт хугацаа нь ХАМГИЙН УДААН дуудлагын хугацаа болно.
 */
import { FORMAT_LABEL, type StudioFormat, type StudioTool } from "./studio.api";
import { briefText, DIRECTION_LABEL, type StudioBrief, type StudioDirection } from "./prompts.api";
import { MAX_IDEAS, MAX_SHOTS, MIN_IDEAS, MIN_SHOTS, PROMPT_LANG } from "./output.api";

// ---------- Нэг хэрэгслийн гаргалт ----------

const LANG_RULE: Record<"en" | "mn", string> = {
  en: `"prompt" талбарыг АНГЛИАР бич — зураг, видео, хөгжмийн загварууд англиар
   хамгийн сайн ойлгодог.`,
  mn: `"prompt" талбарыг МОНГОЛООР бич. Энэ промптыг ChatGPT/Gemini-д тавихад
   гаралт нь монгол байх ёстой.`,
};

const DRAFT_RULE = `
"draft" талбарт ШУУД АШИГЛАЖ БОЛОХ бэлэн эх бичвэрийг бүтнээр нь бич (албан
бичиг, пост, имэйл, слайдын текст). Хэрэглэгч үүнийг хуулж аваад ашиглана;
промпт нь зөвхөн ЗАСАХ, өөр хувилбар гаргуулахад хэрэгтэй. Бичвэр нь бүтэн,
дутуугүй, монголоор, brief-ийн өнгө аястай байна. Тэмдэглэгээ («[нэр]» гэх мэт)
үлдээхгүй — brief-д байхгүй бол ойлгомжтой жишээ утга тавь.`;

export function toolSystem(format: StudioFormat, tool: StudioTool): string {
  const wantsDraft = format === "TEXT" || format === "SLIDES";
  return `Чи монгол хэрэглэгчид зориулсан AI бүтээлч захирал. ЗӨВХӨН «${tool.name}» хэрэгсэлд
зориулсан гаргалт бич.

ДҮРЭМ:
1. ${LANG_RULE[PROMPT_LANG[format]]}
2. Тайлбар, алхам бүр МОНГОЛООР, энгийн үгээр. Техникийн үг хэрэглэвэл хажууд нь
   монголоор тайлбарла ("dolly in — камер урагш ойртох").
3. "parts"-д промптоо 4–7 хэсэгт хувааж, хэсэг бүр ЯАГААД байгааг монголоор нэг
   өгүүлбэрээр тайлбарла.
4. Зураг/видеон дээр КИРИЛЛ ТЕКСТ бүү бичүүл. Промптод "no text, no letters" нэм.
5. Бодит хүний царай, брэндийн лого, кино/дууны хуулбарыг промптод бүү нэрлэ.
6. Алхмууд ГАР ДЭЭР БАРИХААР: юу дарах, хаана бичих.

ТООН МЭДЭЭЛЭЛ (хамгийн чухал):
Кредит, үнэгүй хязгаар, клипийн урт, нарийвчлал, үнэ зэрэг ямар ч ТООГ зөвхөн
доорх «ХЭРЭГСЛИЙН ЛАВЛАХ»-аас ав. Лавлахад байхгүй тоог БҮҮ ЗОХИО. Тоо мэдэхгүй
бол «Одоогийн хязгаарыг албан ёсны сайтаас шалгана уу» гэж бич.${wantsDraft ? `\n${DRAFT_RULE}` : ""}`;
}

export function toolSchema(format: StudioFormat) {
  const wantsDraft = format === "TEXT" || format === "SLIDES";
  const properties: Record<string, unknown> = {
    prompt: { type: "string", description: "Хуулж тавих бэлэн промпт" },
    params: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Параметрийн нэр, жишээ нь --ar" },
          value: { type: "string" },
          why: { type: "string", description: "Юунд хэрэгтэйг монголоор" },
        },
        required: ["name", "value", "why"],
        additionalProperties: false,
      },
    },
    parts: {
      type: "array", minItems: 3, maxItems: 8,
      items: {
        type: "object",
        properties: {
          part: { type: "string", description: "Промптоос хуулсан хэсэг" },
          why: { type: "string", description: "Яагаад энэ хэсэг байна вэ — монголоор" },
        },
        required: ["part", "why"],
        additionalProperties: false,
      },
    },
    steps: {
      type: "array", minItems: 3, maxItems: 5, items: { type: "string" },
      description: "Монголоор алхмууд — юу дарах, хаана бичих",
    },
  };
  const required = ["prompt", "params", "parts", "steps"];

  if (wantsDraft) {
    properties.draft = {
      type: "string",
      description: "Шууд ашиглаж болох бэлэн эх бичвэр, монголоор, бүтнээр",
    };
    required.push("draft");
  }
  return { type: "object", properties, required, additionalProperties: false };
}

export function toolUser(a: {
  brief: StudioBrief;
  format: StudioFormat;
  aspect: string;
  direction: StudioDirection;
  tool: StudioTool;
  doc: string;
  craft: string;
  mongol: string;
  ideas?: string;
}): string {
  return [
    `ХЭРЭГСЭЛ: ${a.tool.name} (${a.tool.id})`,
    `ХЭЛБЭР: ${FORMAT_LABEL[a.format]}`,
    a.aspect ? `ХАРЬЦАА: ${a.aspect}` : "",
    "",
    "ДААЛГАВАР:",
    briefText(a.brief),
    "",
    `СОНГОСОН ЧИГЛЭЛ — ${DIRECTION_LABEL[a.direction.key]}: ${a.direction.title}`,
    a.direction.idea,
    "",
    "=== ХЭРЭГСЛИЙН ЛАВЛАХ (тоог ЗӨВХӨН эндээс ав) ===",
    a.doc,
    "",
    "=== ПРОМПТ БИЧИХ ЛАВЛАХ ===",
    a.craft,
    "",
    "=== МОНГОЛ ОРЧНЫ ЛАВЛАХ ===",
    a.mongol,
    a.ideas ? `\n=== БҮТЭЭЛЧ ЗАРЧИМ ===\n${a.ideas}` : "",
  ].filter((x) => x !== "").join("\n");
}

// ---------- Ерөнхий төлөвлөгөө (кадар, хөгжим, угсралт, санаа) ----------

export const PLAN_SYSTEM = `Чи монгол хэрэглэгчид зориулсан AI бүтээлч захирал. Даалгаврын
ЕРӨНХИЙ төлөвлөгөөг гарга — тодорхой хэрэгслийн промптыг НЭ бич (тэдгээрийг тусад нь бэлдэж байна).

ВИДЕО бол:
- storyboard-д ${MIN_SHOTS}–${MAX_SHOTS} кадар. Кадар бүр 2–5 секунд, нийлбэр нь brief-ийн урттай ойролцоо.
- Кадар бүрийн промпт бие даан ажиллахаар бүтэн байна (дүр, орчин, гэрэл, камер), АНГЛИАР.
- consistency-д дүрийг кадар бүрт ижил байлгах ТУСГАЙ арга бич (лавлагаа зураг, ижил
  тайлбарыг үг үсгээр нь давтах, seed).
- music-д Suno-гийн Style промпт (англи). Монгол дуу үг гажих магадлалтай тул ихэвчлэн
  instrumental санал болго.
- assembly-д CapCut дээр угсрах 4–6 алхам, монголоор.

ЗУРАГ/БИЧВЭР/СЛАЙД бол storyboard хоосон массив, consistency хоосон, music null,
assembly-д эцсийн угсралтын алхмууд (Canva).

ideas-д хэрэглэгчийн ОГТ БОДООГҮЙ ${MIN_IDEAS}–${MAX_IDEAS} нэмэлт санаа.

ТОО: кредит, хязгаар, үнэ зэрэг тоог БҮҮ ЗОХИО — тэдгээрийг хэрэгслийн картууд дээр бичнэ.`;

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    storyboard: {
      type: "array", maxItems: MAX_SHOTS,
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          seconds: { type: "integer", description: "2–5" },
          prompt: { type: "string", description: "Кадарын промпт, англиар" },
          mn: { type: "string", description: "Юу болж байгааг монголоор" },
        },
        required: ["n", "seconds", "prompt", "mn"],
        additionalProperties: false,
      },
    },
    consistency: { type: "string", description: "Дүрийг ижил байлгах зөвлөгөө, монголоор" },
    music: {
      type: ["object", "null"],
      properties: {
        prompt: { type: "string", description: "Suno-гийн Style промпт, англиар" },
        mn: { type: "string", description: "Юу гэсэн үг болохыг монголоор" },
      },
      required: ["prompt", "mn"],
      additionalProperties: false,
    },
    assembly: { type: "array", items: { type: "string" }, description: "Угсралтын алхмууд, монголоор" },
    ideas: {
      type: "array", minItems: MIN_IDEAS, maxItems: MAX_IDEAS, items: { type: "string" },
      description: "Нэмэлт санаа, монголоор",
    },
  },
  required: ["storyboard", "consistency", "music", "assembly", "ideas"],
  additionalProperties: false,
};

export function planUser(a: {
  brief: StudioBrief;
  format: StudioFormat;
  aspect: string;
  direction: StudioDirection;
  tools: StudioTool[];
  craft: string;
  mongol: string;
  ideas?: string;
}): string {
  return [
    `ХЭЛБЭР: ${FORMAT_LABEL[a.format]}`,
    a.aspect ? `ХАРЬЦАА: ${a.aspect}` : "",
    `ХЭРЭГСЛҮҮД: ${a.tools.map((t) => t.name).join(", ")}`,
    "",
    "ДААЛГАВАР:",
    briefText(a.brief),
    "",
    `СОНГОСОН ЧИГЛЭЛ — ${DIRECTION_LABEL[a.direction.key]}: ${a.direction.title}`,
    a.direction.idea,
    "",
    "=== ПРОМПТ БИЧИХ ЛАВЛАХ ===",
    a.craft,
    "",
    "=== МОНГОЛ ОРЧНЫ ЛАВЛАХ ===",
    a.mongol,
    a.ideas ? `\n=== БҮТЭЭЛЧ ЗАРЧИМ ===\n${a.ideas}` : "",
  ].filter((x) => x !== "").join("\n");
}

// ---------- Хугацааны хэмжилт ----------

export interface StepTimings {
  questions?: number;
  brief?: number;
  directions?: number;
  output?: number;
  revision?: number;
  total?: number;
}

/** Зорилтот хугацаа, миллисекундээр */
export const TARGET_MS = { questions: 8_000, brief: 10_000, output: 30_000 } as const;

export function overTarget(step: keyof typeof TARGET_MS, ms: number): boolean {
  return ms > TARGET_MS[step];
}

/** p50 / p90 — /admin дээр харуулна */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}
