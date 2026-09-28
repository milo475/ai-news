/**
 * Эцсийн гаргалтын схем, prompt ба шалгалт (цэвэр хэсэг).
 *
 * Гаргалт нь «промпт өгөөд болоо» биш: промпт + параметр + МОНГОЛ ТАЙЛБАР +
 * алхам + сэрэмжлүүлэг + нэмэлт санаа. Энэ нь ChatGPT-д шууд асуухаас ялгарах гол зүйл.
 */
import type { StudioFormat, StudioTool } from "./studio.api";
import { FORMAT_LABEL } from "./studio.api";
import { briefText, DIRECTION_LABEL, type StudioBrief, type StudioDirection } from "./prompts.api";

export interface PromptPart {
  /** Промптын хэсэг, англиар — промптоос шууд хуулсан */
  part: string;
  /** Яагаад энэ хэсэг байгаа вэ — монголоор нэг өгүүлбэр */
  why: string;
}

export interface ToolParam {
  name: string;
  value: string;
  why: string;
}

export interface ToolOutput {
  tool: string;
  /** Хуулж тавих бэлэн промпт — АНГЛИАР */
  prompt: string;
  params: ToolParam[];
  parts: PromptPart[];
  /** 3–5 алхам, монголоор */
  steps: string[];
  /**
   * БИЧВЭР ба СЛАЙД-д: шууд ашиглаж болох бэлэн эх бичвэр (албан бичиг, пост,
   * имэйл, слайдын текст). Промпт нь үүнийг ЗАСАХ, өөр хувилбар гаргуулахад
   * хэрэглэгдэнэ — хэрэглэгч хоосон гараар үлдэхгүй.
   */
  draft?: string;
}

export interface Shot {
  /** 1-ээс эхэлсэн дугаар */
  n: number;
  seconds: number;
  /** Кадарын промпт, англиар */
  prompt: string;
  /** Юу болж байгааг монголоор */
  mn: string;
}

export interface StudioOutput {
  tools: ToolOutput[];
  /** Видеод: 4–8 кадар */
  storyboard: Shot[];
  /** Дүрийг кадар бүрт ижил байлгах зөвлөгөө — монголоор */
  consistency: string;
  /** Suno-д тавих хөгжмийн промпт (англи) ба тайлбар */
  music: { prompt: string; mn: string } | null;
  /** CapCut дээр угсрах алхмууд — монголоор */
  assembly: string[];
  /** 2–3 нэмэлт санаа — монголоор */
  ideas: string[];
}

export const MIN_SHOTS = 4;
export const MAX_SHOTS = 8;
export const MIN_IDEAS = 2;
export const MAX_IDEAS = 3;

/**
 * Промпт ямар хэлээр байх вэ.
 *
 * Зураг, видео, хөгжмийн загварууд англиар хамгийн сайн ойлгодог. Харин БИЧВЭР ба
 * СЛАЙД-ын промптыг ChatGPT/Gemini-д тавихад гаралт нь монгол байх ёстой — тэр
 * промптыг англиар бичвэл хэрэглэгч дахин орчуулж сууна (2026-09-27-ны eval-д
 * шүүгч үүнийг гол сул тал гэж дүгнэсэн).
 */
export const PROMPT_LANG: Record<StudioFormat, "en" | "mn"> = {
  IMAGE: "en",
  VIDEO: "en",
  AUDIO: "en",
  TEXT: "mn",
  SLIDES: "mn",
};

const LANG_RULE: Record<"en" | "mn", string> = {
  en: `1. "prompt" талбар бүр АНГЛИАР. Зураг, видео, хөгжмийн загварууд англиар
   хамгийн сайн ойлгодог.`,
  mn: `1. "prompt" талбар бүр МОНГОЛООР. Энэ промптыг ChatGPT/Gemini-д тавихад гаралт нь
   монгол байх ёстой тул промптыг монголоор бичнэ. Промптод «Монгол хэлээр бич» гэдгийг
   тодорхой хэл.`,
};

export const OUTPUT_SYSTEM = `Чи монгол хэрэглэгчид зориулсан AI бүтээлч захирал.
Даалгавар (brief) ба сонгосон чиглэлийн дагуу БЭЛЭН АЖЛЫН БАГЦ гаргана.

ХАМГИЙН ЧУХАЛ ДҮРЭМ:
{{LANG}}
2. Тайлбар, алхам, санаа бүр МОНГОЛООР, энгийн үгээр. Техникийн үг хэрэглэвэл
   хажууд нь монголоор тайлбарла ("dolly in — камер урагш ойртох").
3. "parts" хэсэгт промптоо 4–7 хэсэгт хувааж, хэсэг бүр ЯАГААД байгааг монголоор
   нэг өгүүлбэрээр тайлбарла. Хэрэглэгч дараа нь өөрөө засах боломжтой болно.
4. Зураг/видеон дээр КИРИЛЛ ТЕКСТ бүү бичүүл. Промптод "no text, no letters" нэм.
   Монгол текстийг дараа нь Canva/CapCut дээр нэмнэ гэж алхамдаа бич.
4а. Үнэгүй хэрэгсэл бол алхамдаа үнэгүй хязгаарыг ТООГООР бич (лавлахад байгаа тоог
   ашигла, жишээ нь «Kling — өдөрт 66 кредит, 5 секундын клип 25 кредит»). Мөн Монголоос
   хандахад карт шаардах эсэхийг хэл.
5. Бодит хүний царай, брэндийн лого, кино/дууны хуулбарыг промптод бүү нэрлэ.
6. Алхмууд нь ГАР ДЭЭР БАРИХААР байна: юу дарах, хаана бичих. "Промптыг хуул" гэж
   бичээд орхихгүй — хаана тавихыг нь хэл.
7. Хэрэглэгчийн brief-д байхгүй зүйлийг өөрөө нэмж болно, гэхдээ гол зурвасыг бүү өөрчил.

ВИДЕО бол:
- storyboard-д 4–8 кадар. Кадар бүр 2–5 секунд, нийлбэр нь brief-ийн урттай ойролцоо.
- Кадар бүрийн промпт бие даан ажиллахаар бүтэн байна (дүр, орчин, гэрэл, камер).
- consistency-д дүрийг кадар бүрт ижил байлгах ТУСГАЙ арга бич (лавлагаа зураг,
  ижил тайлбарыг үг үсгээр нь давтах, seed).
- music-д Suno-гийн Style промпт (англи) бич. Монгол дуу үг гажих магадлалтай тул
  ихэвчлэн instrumental санал болго.
- assembly-д CapCut дээр угсрах 4–6 алхам бич.

ЗУРАГ/БИЧВЭР/СЛАЙД бол storyboard хоосон массив, music null, assembly-д эцсийн
угсралтын алхмууд (Canva).

ideas-д хэрэглэгчийн ОГТ БОДООГҮЙ 2–3 нэмэлт санаа: энэ материалыг өөр юунд
ашиглаж болох, ямар хувилбар хийж болох.`;

/** Хэлбэрт тохирсон system prompt */
export function outputSystem(format: StudioFormat): string {
  return OUTPUT_SYSTEM.replace("{{LANG}}", LANG_RULE[PROMPT_LANG[format]]);
}

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    tools: {
      type: "array", minItems: 1,
      items: {
        type: "object",
        properties: {
          tool: { type: "string", description: "Хэрэгслийн id" },
          prompt: { type: "string", description: "Хуулж тавих бэлэн промпт — АНГЛИАР" },
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
                part: { type: "string", description: "Промптоос хуулсан хэсэг, англиар" },
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
        },
        required: ["tool", "prompt", "params", "parts", "steps"],
        additionalProperties: false,
      },
    },
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
    consistency: { type: "string", description: "Дүрийг ижил байлгах зөвлөгөө, монголоор. Видео биш бол хоосон" },
    music: {
      type: ["object", "null"],
      properties: {
        prompt: { type: "string", description: "Suno-гийн Style промпт, англиар" },
        mn: { type: "string", description: "Юу гэсэн үг болохыг монголоор" },
      },
      required: ["prompt", "mn"],
      additionalProperties: false,
    },
    assembly: {
      type: "array", items: { type: "string" },
      description: "Эцсийн угсралтын алхмууд — монголоор",
    },
    ideas: {
      type: "array", minItems: MIN_IDEAS, maxItems: MAX_IDEAS, items: { type: "string" },
      description: "Нэмэлт санаа — монголоор",
    },
  },
  required: ["tools", "storyboard", "consistency", "music", "assembly", "ideas"],
  additionalProperties: false,
};

/**
 * Эцсийн дуудлагын user мессеж.
 *
 * `docs` нь ЗӨВХӨН сонгосон хэрэгслийн мэдлэгийн файлууд — бүгдийг оруулбал
 * токен дэмий зарцуулна.
 */
export function outputUser(a: {
  brief: StudioBrief;
  format: StudioFormat;
  aspect: string;
  direction: StudioDirection;
  tools: StudioTool[];
  /** tool id → markdown агуулга */
  docs: Record<string, string>;
  /** craft.md + mongol.md */
  craft: string;
  mongol: string;
}): string {
  const toolList = a.tools.map((t) => `- ${t.id} (${t.name}): ${t.note}`).join("\n");
  const docs = a.tools
    .map((t) => a.docs[t.id])
    .filter((d): d is string => Boolean(d))
    .join("\n\n---\n\n");

  return [
    `ХЭЛБЭР: ${FORMAT_LABEL[a.format]}`,
    a.aspect ? `ХАРЬЦАА: ${a.aspect}` : "",
    "",
    "ДААЛГАВАР:",
    briefText(a.brief),
    "",
    `СОНГОСОН ЧИГЛЭЛ — ${DIRECTION_LABEL[a.direction.key]}: ${a.direction.title}`,
    a.direction.idea,
    "",
    "ХЭРЭГСЛҮҮД (эдгээрт тус бүрд нь гаргалт өг, tool талбарт id-г нь бич):",
    toolList,
    "",
    "=== ХЭРЭГСЛИЙН ЛАВЛАХ ===",
    docs,
    "",
    "=== ПРОМПТ БИЧИХ ЛАВЛАХ ===",
    a.craft,
    "",
    "=== МОНГОЛ ОРЧНЫ ЛАВЛАХ ===",
    a.mongol,
  ].filter((x) => x !== "").join("\n");
}

// ---------- Шалгалт ----------

/**
 * Алхамд дуусгаагүй тэмдэглэгээ үлдсэн эсэх — «[...]», «[энд нэрээ бич]» гэх мэт.
 * Хэрэглэгч заавраа дагаж чадахгүй болно (2026-09-27-ны eval-д илэрсэн).
 */
const PLACEHOLDER = /\[\s*(\.{3}|…|\s*)\s*\]|\{\s*\}/u;

export function hasPlaceholder(s: string): boolean {
  return PLACEHOLDER.test(s);
}

/** Кирилл үсэг агуулсан эсэх — англи байх ёстой промптыг шалгана */
const CYRILLIC = /[Ѐ-ӿ]/u;

export function hasCyrillic(s: string): boolean {
  return CYRILLIC.test(s);
}

export type OutputIssue =
  | "prompt-cyrillic"
  | "prompt-not-mn"
  | "unknown-tool"
  | "shots-too-few"
  | "shots-too-many"
  | "no-tools"
  | "explanation-not-mn"
  | "placeholder"
  | "draft-missing";

/**
 * Гаргалтыг шалгана. Алдаа олдвол дахин нэг удаа бичүүлнэ (feedback болгож өгнө).
 * Энэ нь LLM-ийн хамгийн түгээмэл хоёр алдааг барина: промптыг монголоор бичих,
 * тайлбарыг англиар бичих.
 */
export function checkOutput(
  out: StudioOutput,
  a: { format: StudioFormat; toolIds: string[] },
): OutputIssue[] {
  const issues: OutputIssue[] = [];
  if (out.tools.length === 0) issues.push("no-tools");

  const wantMn = PROMPT_LANG[a.format] === "mn";
  const badLang = (prompt: string): OutputIssue | null => {
    if (!prompt.trim()) return null;
    if (wantMn) return hasCyrillic(prompt) ? null : "prompt-not-mn";
    return hasCyrillic(prompt) ? "prompt-cyrillic" : null;
  };

  for (const t of out.tools) {
    if (!a.toolIds.includes(t.tool)) issues.push("unknown-tool");
    const bad = badLang(t.prompt);
    if (bad) issues.push(bad);
    if (t.steps.some((s) => s.trim() && !hasCyrillic(s))) issues.push("explanation-not-mn");
    if (t.steps.some(hasPlaceholder)) issues.push("placeholder");
    // Бичвэр, слайдад хэрэглэгч промпт биш, БЭЛЭН бичвэр хүсдэг
    if (wantMn && (t.draft ?? "").trim().length < 80) issues.push("draft-missing");
  }
  // Кадарын промпт нь үргэлж дүрс үүсгэгчид явдаг тул англиар
  for (const s of out.storyboard) if (hasCyrillic(s.prompt)) issues.push("prompt-cyrillic");

  if (a.format === "VIDEO") {
    if (out.storyboard.length < MIN_SHOTS) issues.push("shots-too-few");
    if (out.storyboard.length > MAX_SHOTS) issues.push("shots-too-many");
  }
  return [...new Set(issues)];
}

export const ISSUE_FEEDBACK: Record<OutputIssue, string> = {
  "prompt-cyrillic": "Промптыг АНГЛИАР бич — кирилл үсэг байж болохгүй.",
  "prompt-not-mn": "Бичвэр/слайдын промптыг МОНГОЛООР бич — гаралт нь монгол байх ёстой.",
  "unknown-tool": "tool талбарт зөвхөн өгөгдсөн хэрэгслийн id-г бич.",
  "shots-too-few": `Видеонд дор хаяж ${MIN_SHOTS} кадар хэрэгтэй.`,
  "shots-too-many": `Кадар ${MAX_SHOTS}-аас олон байж болохгүй.`,
  "no-tools": "Дор хаяж нэг хэрэгсэлд гаргалт өг.",
  "explanation-not-mn": "Алхам, тайлбарыг МОНГОЛООР бич.",
  "draft-missing": "Бичвэр/слайдад ШУУД ашиглаж болох бэлэн эх бичвэрийг («draft») бүтнээр бич.",
  placeholder: "Алхамд «[...]» гэх мэт дуусгаагүй тэмдэглэгээ үлдээж болохгүй — бүтнээр бич.",
};

// ---------- Сэрэмжлүүлэг ----------

export const WARN_CYRILLIC =
  "AI зураг/видео дээр кирилл үсэг гажина. Текстгүй гаргаад монгол бичвэрээ Canva эсвэл CapCut дээр нэм.";
export const WARN_REAL_FACE =
  "Бодит хүний царайг зөвшөөрөлгүй үүсгэхгүй. Ажилтнаа гаргах бол өөрийнх нь зургийг лавлагаа болгон, зөвшөөрөл аваарай.";
export const WARN_BRAND =
  "Бусдын лого, брэндийн тэмдгийг промптод бүү нэрлэ — эрх зүйн эрсдэлтэй.";
export const WARN_COPYRIGHT =
  "Алдартай кино, дуу, зураачийн нэрийг хуулбарлахаар нэрлэвэл зохиогчийн эрхийн асуудал үүсэж болно.";
export const WARN_FREE_LIMIT =
  "Сонгосон хэрэгслийн үнэгүй хязгаар хурдан дуусдаг. Эхлээд богино хувилбараар турш.";
export const WARN_VOICE =
  "Монгол ярианы AI хоолой дуудлага алдаж болзошгүй. Чухал видеонд өөрийн хоолойгоо бичих нь найдвартай.";

/** Хэлбэр, хэрэгсэл, хүсэлтээс хамаарсан сэрэмжлүүлгүүд */
export function warningsFor(a: {
  format: StudioFormat;
  tools: StudioTool[];
  request: string;
  brief?: Partial<StudioBrief>;
}): string[] {
  const out: string[] = [];
  const visual = a.format === "IMAGE" || a.format === "VIDEO" || a.format === "SLIDES";
  if (visual) out.push(WARN_CYRILLIC);

  const text = `${a.request} ${Object.values(a.brief ?? {}).join(" ")}`;
  // Кирилл нь тийн ялгалаар өөрчлөгддөг (захирал → захирлынхаа) тул үндсээр нь барина
  if (/(царай|нүүр зураг|хүний зураг|ажилт|захирал|захирл|жүжигчин|дуучин|танилцуулж буй хүн|өөрийн зураг|миний зураг)/iu.test(text)) {
    out.push(WARN_REAL_FACE);
  }
  if (/(лого|брэнд|logo|тэмдэг|пепси|coca|apple|nike|adidas)/iu.test(text)) out.push(WARN_BRAND);
  if (/(кино|дуу|зураач|стил|марвел|дисней|аниме|ghibli|гибли)/iu.test(text)) out.push(WARN_COPYRIGHT);
  if (a.tools.some((t) => t.id === "heygen")) out.push(WARN_VOICE);
  if (a.tools.some((t) => t.free)) out.push(WARN_FREE_LIMIT);

  return [...new Set(out)];
}
