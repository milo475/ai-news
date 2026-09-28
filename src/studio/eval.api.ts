/**
 * Студийн чанарын үнэлгээ — цэвэр хэсэг (LLM шүүгчийн prompt, схем, оноо бодох).
 */

export interface EvalRequest {
  id: string;
  persona: string;
  format: string;
  request: string;
}

export const CRITERIA = ["clarity", "toolFit", "completeness", "mongolian", "beyond"] as const;

/** Зорилтууд — П.2 */
export const TARGET_AVG = 8.5;
export const TARGET_SECONDS = 30;
export const TARGET_P90_SECONDS = 45;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERION_LABEL: Record<Criterion, string> = {
  clarity: "Ойлгомжтой эсэх",
  toolFit: "Хэрэгсэл тохирсон эсэх",
  completeness: "Бүрэн эсэх",
  mongolian: "Монгол тайлбар",
  beyond: "Хүссэнээс илүү",
};

export type Scores = Record<Criterion, number>;

export interface EvalVerdict extends Scores {
  /** Хамгийн том сул тал — нэг өгүүлбэр монголоор */
  weakness: string;
}

export const JUDGE_SYSTEM = `Чи монгол хэрэглэгчийн туршлагыг үнэлэгч. Хэрэглэгч AI-аар
зураг/видео/бичвэр хийхийг хүссэн ба манай үйлчилгээ бэлэн промптын багц гаргасан.
Багцыг 5 шалгуураар 1–10 оноогоор үнэл.

- clarity: Технологи мэддэггүй хүн уншаад ГАР ДЭЭРЭЭ ХИЙЖ ЧАДАХ уу? Алхам тодорхой юу?
- toolFit: Сонгосон хэрэгсэл энэ ажилд ҮНЭХЭЭР тохирсон уу? Монголоос хандахад
  боломжтой (үнэгүй хувилбартай) юу?
- completeness: Промпт, параметр, алхам, сэрэмжлүүлэг бүрэн үү? Дутуу зүйл үлдсэн үү?
- mongolian: Тайлбар нь БАЙГАЛИЙН монгол хэл үү? Орчуулга шиг, эсвэл англи үг холилдсон
  бол оноо бууруул.
- beyond: Хэрэглэгчийн хүссэнээс ИЛҮҮ зүйл өгсөн үү (нэмэлт санаа, анхааруулга,
  бодоогүй алхам)? Зүгээр л асуултыг давтсан бол 3-аас доош.

ТООН МЭДЭЭЛЭЛ:
Тоо (кредит, хязгаар, урт, үнэ) нь манай мэдлэгийн сантай МЕХАНИКААР тулгагддаг —
чи түүнийг шалгах шаардлагагүй бөгөөд шалгах ч боломжгүй. Тиймээс ЗӨВХӨН тоо
байгаа гэдэг шалтгаанаар оноо бүү бууруул.

Торгуул: тоо нь ӨӨРТЭЙГӨӨ ЗӨРЧИЛДСӨН үед (нэг газар «5 секунд», нөгөө газар
«2 минут»), эсвэл илт боломжгүй үед («өдөрт 100 000 үнэгүй видео»).

«(одоогийн хязгаарыг албан ёсны сайтаас шалгана уу)» гэсэн хэллэг нь тоог
зохиохын оронд үнэнээ хэлж байгаа хэрэг — ЭНЭ НЬ ДАВУУ ТАЛ, дутагдал биш.
Үүнийг «мэдээлэл дутуу» гэж бүү торго.

Хатуу үнэл. 10 бол төгс, 7 бол сайн, 5 бол дунд, 3-аас доош бол ашиглах боломжгүй.
weakness талбарт хамгийн том сул талыг МОНГОЛООР нэг өгүүлбэрээр бич.`;

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    ...Object.fromEntries(
      CRITERIA.map((c) => [c, { type: "integer", description: `${CRITERION_LABEL[c]}, 1–10` }]),
    ),
    weakness: { type: "string", description: "Хамгийн том сул тал, монголоор нэг өгүүлбэр" },
  },
  required: [...CRITERIA, "weakness"],
  additionalProperties: false,
};

export function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(10, Math.max(1, v));
}

export function normalizeVerdict(raw: Partial<EvalVerdict> | null): EvalVerdict {
  const out = Object.fromEntries(CRITERIA.map((c) => [c, clampScore(raw?.[c])])) as Scores;
  return { ...out, weakness: (raw?.weakness ?? "").trim() || "—" };
}

/** Нэг кейсийн дундаж оноо */
export function average(s: Scores): number {
  const sum = CRITERIA.reduce((n, c) => n + s[c], 0);
  return Math.round((sum / CRITERIA.length) * 10) / 10;
}

export interface EvalRow extends EvalRequest {
  scores: Scores;
  /** Мэдлэгийн сангаас баталгаажаагүй тул хасагдсан тооны тоо */
  stripped: number;
  /**
   * Алхам бүрийн хугацаа, секундээр.
   *
   * `seconds` нь БҮХ урсгалын хугацаа (асуулт + бриф + чиглэл + гаргалт +
   * шүүгч). Зорилт «эцсийн гаргалт ≤ 30с» нь зөвхөн `output`-д хамаарна.
   */
  stepSeconds: { questions: number; brief: number; directions: number; output: number; judge: number };
  avg: number;
  weakness: string;
  costUsd: number;
  seconds: number;
  /** Гаргалтын автомат шалгалтын үлдсэн алдаа */
  issues: string[];
}

export interface EvalSummary {
  rows: number;
  /** p90 хугацаа, секундээр (бүх урсгал) */
  p90Seconds: number;
  /** ЗӨВХӨН эцсийн гаргалтын хугацаа — зорилт нь үүнд хамаарна */
  outputAvg: number;
  outputP90: number;
  /** Нийт зохиомол тоо — зорилт 0 */
  stripped: number;
  /** Шалгуур тус бүрийн дундаж */
  byCriterion: Record<Criterion, number>;
  avg: number;
  costUsd: number;
  /** Нэг бүтээлийн дундаж зардал ба хугацаа */
  avgCost: number;
  avgSeconds: number;
  /** Хамгийн муу 3 */
  worst: EvalRow[];
}

function pct(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function summarize(rows: EvalRow[], worstCount = 3): EvalSummary {
  const byCriterion = Object.fromEntries(
    CRITERIA.map((c) => [c, mean(rows.map((r) => r.scores[c]))]),
  ) as Record<Criterion, number>;

  const cost = rows.reduce((n, r) => n + r.costUsd, 0);
  const secs = [...rows.map((r) => r.seconds)].sort((a, b) => a - b);
  const p90 = secs.length ? secs[Math.min(secs.length - 1, Math.floor(0.9 * secs.length))]! : 0;
  return {
    rows: rows.length,
    p90Seconds: p90,
    outputAvg: mean(rows.map((r) => r.stepSeconds.output)),
    outputP90: pct(rows.map((r) => r.stepSeconds.output), 90),
    stripped: rows.reduce((n, r) => n + r.stripped, 0),
    byCriterion,
    avg: mean(rows.map((r) => r.avg)),
    costUsd: cost,
    avgCost: rows.length ? cost / rows.length : 0,
    avgSeconds: mean(rows.map((r) => r.seconds)),
    worst: [...rows].sort((a, b) => a.avg - b.avg).slice(0, worstCount),
  };
}

/** Хариултыг автоматаар сонгох — хамгийн эхний бодит сонголт (эсвэл «Та шийд») */
export function autoAnswer(options: string[], decide: string): string {
  const real = options.find((o) => o !== decide && !o.startsWith("Өөрөө"));
  return real ?? decide;
}

/**
 * Хэлбэр тус бүрээс нэгийг сонгоно — бага төсвөөр бүх хэлбэрийг хамруулах.
 * Дараалал нь requests.json-ы дараалал: тохирох эхнийхийг авна.
 */
export function spread(list: EvalRequest[]): EvalRequest[] {
  const seen = new Set<string>();
  const out: EvalRequest[] = [];
  for (const r of list) {
    if (seen.has(r.format)) continue;
    seen.add(r.format);
    out.push(r);
  }
  return out;
}
