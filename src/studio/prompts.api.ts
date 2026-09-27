/**
 * Студийн LLM prompt ба схемүүд (цэвэр хэсэг).
 *
 * Урсгал: асуулт → brief → 3 чиглэл → эцсийн гаргалт.
 * Схем бүр `additionalProperties: false` — OpenRouter-ийн strict JSON горимд шаардлагатай.
 */
import { FORMAT_LABEL, type StudioFormat } from "./studio.api";

// ---------- 1. Ухаалаг асуулт ----------

/** Хамгийн ихдээ хэдэн удаа асуух вэ — хүнийг ядраахгүй */
export const MAX_ROUNDS = 2;
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;

export interface StudioQuestion {
  /** brief-ийн аль талбарыг нөхөх вэ */
  field: string;
  question: string;
  options: string[];
}

export const QUESTION_SYSTEM = `Чи монгол хэлээр ажилладаг бүтээлч захирал. Хэрэглэгч юу
хийхийг хүсч байгаагаа товч бичсэн. Чи ГУРВААС ТАВАН тодруулах асуулт асууна.

ДҮРЭМ:
- Асуулт бүр МОНГОЛООР, энгийн үгээр, нэг өгүүлбэр.
- Асуулт бүрт 3–5 БЭЛЭН хариулт санал болго. Хариултууд нь бие биенээсээ ИЛТ ЯЛГААТАЙ
  байх ба хүн уншаад шууд сонгочихоор тодорхой байна ("дулаан, гэр бүлийн" биш
  "гэр бүлийн — ээж аав хүүхэдтэйгээ" гэх мэт).
- Хэрэглэгчийн аль хэдийн хэлсэн зүйлийг ДАХИН БҮҮ АСУУ.
- Техникийн үг бүү хэрэглэ (aspect ratio, LUT, seed). "Хаана тавих вэ?" гэж асуу.
- Хамгийн чухал зүйлийг нь эхэнд асуу: зорилго, хэнд зориулсан, ямар мэдрэмж.
- Асуулт бүр нэг л зүйл асууна.

ТАЛБАРУУД (field): goal, audience, tone, message, subject, setting, style, placement,
length, brand, avoid.`;

export const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: MIN_QUESTIONS,
      maxItems: MAX_QUESTIONS,
      items: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["goal", "audience", "tone", "message", "subject", "setting", "style", "placement", "length", "brand", "avoid"],
          },
          question: { type: "string", description: "Монголоор нэг өгүүлбэр" },
          options: {
            type: "array", minItems: 3, maxItems: 5, items: { type: "string" },
            description: "Богино, ялгаатай хариултууд. Монголоор",
          },
        },
        required: ["field", "question", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

/** Бэлэн хариултын хажууд үргэлж нэмэгдэх сонголтууд */
export const FREE_OPTION = "Өөрөө бичих";
export const DECIDE_OPTION = "Та шийд";

export function withExtras(options: string[]): string[] {
  const clean = options.map((o) => o.trim()).filter(Boolean);
  return [...new Set([...clean, DECIDE_OPTION, FREE_OPTION])];
}

/** Хариулт нь «Та шийд» бол brief-д бичихгүй — LLM өөрөө шийднэ */
export function isDecide(answer: string): boolean {
  return answer.trim() === DECIDE_OPTION;
}

/**
 * Асуусан ба хариулсан талбаруудыг цэвэрлэнэ.
 * «Та шийд» гэсэн хариултыг мэдэгдсэн гэж тооцохгүй — тэр талбарыг LLM бөглөнө,
 * гэхдээ ДАХИН АСУУХГҮЙ (хүн аль хэдийн сонголтоо хийсэн).
 */
export function answeredFields(answers: Record<string, string>): string[] {
  return Object.entries(answers)
    .filter(([, v]) => v.trim().length > 0)
    .map(([k]) => k);
}

/** Дараагийн раундад асуухыг хориглох талбарууд */
export function askedAlready(rounds: StudioQuestion[][], answers: Record<string, string>): string[] {
  return [...new Set([...rounds.flat().map((q) => q.field), ...answeredFields(answers)])];
}

export function questionUser(a: {
  request: string;
  format: StudioFormat;
  known: string[];
  round: number;
}): string {
  const lines = [
    `Хүсэлт: ${a.request}`,
    `Хэлбэр: ${FORMAT_LABEL[a.format]}`,
    `Раунд: ${a.round + 1}/${MAX_ROUNDS}`,
  ];
  if (a.known.length) lines.push(`Аль хэдийн мэдэгдсэн (БҮҮ АСУУ): ${a.known.join(", ")}`);
  return lines.join("\n");
}

// ---------- 2. Brief ----------

export interface StudioBrief {
  /** Юу хийх вэ — нэг өгүүлбэр */
  goal: string;
  /** Хэнд зориулсан */
  audience: string;
  /** Гол зурвас — үзэгч юу ойлгох ёстой */
  message: string;
  /** Өнгө аяс */
  tone: string;
  /** Гол дүр / бүтээгдэхүүн */
  subject: string;
  /** Орчин, газар */
  setting: string;
  /** Харагдах хэв маяг */
  style: string;
  /** Хаана тавих */
  placement: string;
  /** Урт, хэмжээ */
  length: string;
  /** Брэнд, лого, өнгө */
  brand: string;
  /** Юу байх ЁСГҮЙ */
  avoid: string;
}

export const BRIEF_FIELDS: (keyof StudioBrief)[] = [
  "goal", "audience", "message", "tone", "subject", "setting", "style", "placement", "length", "brand", "avoid",
];

export const BRIEF_LABEL: Record<keyof StudioBrief, string> = {
  goal: "Зорилго",
  audience: "Хэнд зориулсан",
  message: "Гол зурвас",
  tone: "Өнгө аяс",
  subject: "Гол дүр / бүтээгдэхүүн",
  setting: "Орчин",
  style: "Харагдах хэв маяг",
  placement: "Хаана тавих",
  length: "Урт, хэмжээ",
  brand: "Брэнд, лого, өнгө",
  avoid: "Байх ёсгүй зүйл",
};

export const BRIEF_SYSTEM = `Чи бүтээлч захирал. Хэрэглэгчийн хүсэлт ба хариултуудаас
БҮТЭЦТЭЙ даалгавар (brief) гаргана.

ДҮРЭМ:
- Бүх талбарыг МОНГОЛООР, товч (1–2 өгүүлбэр) бөглө.
- Хэрэглэгч хэлээгүй зүйлийг ОЙЛГОМЖТОЙ, ЭНГИЙН таамгаар нөх — хоосон бүү үлдээ.
  Таамаглахдаа Монголын нөхцөлд тохируул (жишээ нь албан байгууллага = 10–30 хүн).
- "avoid" талбарт заавал бич: зураг/видео дээр КИРИЛЛ ТЕКСТ гаргахгүй
  (AI загварууд кирилл үсгийг гажуудуулдаг — текстийг дараа нь Canva/CapCut дээр нэмнэ).
- Хэрэглэгчийн хэлснийг БҮҮ ГУЙВУУЛ. Хэлээгүйг нь хэлсэн мэт бүү бич.`;

export const BRIEF_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(
    BRIEF_FIELDS.map((f) => [f, { type: "string", description: `${BRIEF_LABEL[f]} — монголоор, товч` }]),
  ),
  required: BRIEF_FIELDS,
  additionalProperties: false,
};

export function briefUser(a: {
  request: string;
  format: StudioFormat;
  answers: Record<string, string>;
  aspect: string;
}): string {
  const answered = Object.entries(a.answers)
    .filter(([, v]) => v.trim() && !isDecide(v))
    .map(([k, v]) => `- ${BRIEF_LABEL[k as keyof StudioBrief] ?? k}: ${v}`);
  return [
    `Хүсэлт: ${a.request}`,
    `Хэлбэр: ${FORMAT_LABEL[a.format]}`,
    a.aspect ? `Харьцаа: ${a.aspect}` : "",
    answered.length ? `Хэрэглэгчийн хариулт:\n${answered.join("\n")}` : "Нэмэлт хариулт өгөөгүй.",
  ].filter(Boolean).join("\n");
}

/** Хоосон талбарыг илрүүлнэ — UI-д анхааруулга харуулна */
export function emptyFields(brief: Partial<StudioBrief>): (keyof StudioBrief)[] {
  return BRIEF_FIELDS.filter((f) => !(brief[f] ?? "").trim());
}

// ---------- 3. Гурван чиглэл ----------

export const DIRECTION_KEYS = ["safe", "creative", "bold"] as const;
export type DirectionKey = (typeof DIRECTION_KEYS)[number];

export const DIRECTION_LABEL: Record<DirectionKey, string> = {
  safe: "Аюулгүй",
  creative: "Бүтээлч",
  bold: "Зоримог",
};

export const DIRECTION_HINT: Record<DirectionKey, string> = {
  safe: "Батлагдсан, эрсдэлгүй. Дарга, харилцагчид харуулахад тохиромжтой.",
  creative: "Нэг шинэлэг санаа нэмсэн. Анхаарал татна, гэхдээ ойлгомжтой хэвээр.",
  bold: "Эрсдэлтэй ч санагдах. Зарим хүнд таалагдахгүй байж магадгүй.",
};

export interface StudioDirection {
  key: DirectionKey;
  /** Монгол нэр — 3–6 үг */
  title: string;
  /** Санаа нь юу вэ — 2–3 өгүүлбэр монголоор */
  idea: string;
  /** Яагаад энэ ажиллах вэ — 1 өгүүлбэр */
  why: string;
}

export const DIRECTIONS_SYSTEM = `Чи бүтээлч захирал. Нэг brief дээр ГУРВАН өөр
бүтээлч чиглэл гаргана.

- safe (Аюулгүй): батлагдсан, эрсдэлгүй арга. Анхдагч сонголт.
- creative (Бүтээлч): нэг шинэлэг санаа нэмсэн, гэхдээ ойлгомжтой.
- bold (Зоримог): анхаарал татах эрсдэлтэй санаа.

ДҮРЭМ:
- Гурав нь ИЛТ ӨӨР байх. Нэг санааг гурван янзаар бичсэн бол буруу.
- Бүгд МОНГОЛООР. Техникийн үг бүү хэрэглэ.
- Гурвуулаа brief-ийн гол зурвасыг хүргэнэ — "зоримог" гэдэг нь сэдвээс гажих биш.
- Монголын үзэгчийн хувьд ойлгомжтой байх. Гадны соёлын шууд хуулбар бүү хий.`;

export const DIRECTIONS_SCHEMA = {
  type: "object",
  properties: {
    directions: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: [...DIRECTION_KEYS] },
          title: { type: "string", description: "Монгол нэр, 3–6 үг" },
          idea: { type: "string", description: "2–3 өгүүлбэр монголоор" },
          why: { type: "string", description: "Яагаад ажиллах вэ — 1 өгүүлбэр" },
        },
        required: ["key", "title", "idea", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["directions"],
  additionalProperties: false,
};

/** Гурван чиглэл дутуу/давхардсан ирвэл засна; safe үргэлж эхэнд */
export function orderDirections(list: StudioDirection[]): StudioDirection[] {
  const byKey = new Map(list.map((d) => [d.key, d]));
  return DIRECTION_KEYS.map((k) => byKey.get(k)).filter((d): d is StudioDirection => Boolean(d));
}

export function briefText(brief: StudioBrief): string {
  return BRIEF_FIELDS.map((f) => `- ${BRIEF_LABEL[f]}: ${brief[f]}`).join("\n");
}
