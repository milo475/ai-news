/**
 * Шүүгчийн prompt, схем, оноо нэгтгэх цэвэр логик.
 *
 * Шүүгч өөрийн компанийн моделийг өөдрөгөөр үнэлэх эрсдэлтэй тул тухайн моделиудыг
 * хоёр дахь шүүгчээр давхар үнэлж дунджална (BENCH_JUDGE_MODEL_2).
 */
import type { RubricItem } from "./task.api";

export const JUDGE_SYSTEM = `Чи монгол хэлний шинжээч. Хиймэл оюуны моделийн хариултыг
даалгавар, лавлах хариулт, шалгуурын дагуу 0–10 оноогоор үнэлнэ.

ОНООНЫ УТГА
- 9–10: алдаагүй, байгалийн монгол хэл, даалгаврыг бүрэн гүйцэтгэсэн.
- 7–8: гол зүйлийг зөв хийсэн, жижиг алдаа эсвэл эвгүй хэллэгтэй.
- 5–6: хэсэгчлэн зөв, мэдэгдэхүйц алдаа эсвэл дутуу.
- 3–4: даалгавраас хазайсан, олон алдаатай.
- 0–2: буруу, хариулаагүй, эсвэл монгол хэл биш.

ЧУХАЛ
- Лавлах хариулт нь ЦОРЫН ГАНЦ зөв хувилбар БИШ. Өөр найруулгаар зөв гүйцэтгэсэн бол
  өндөр оноо өг.
- Урт байх нь чанар биш. Даалгавар товч гэсэн бол товчийг нь үнэл.
- Кирилл биш үсгээр бичсэн, орос/англи руу шилжсэн бол оноог эрс бууруул.
- Өөрийгөө болон аль нэг компанийг тал засахгүй. Зөвхөн текстийг үнэл.

Тайлбараа МОНГОЛООР, нэг өгүүлбэрээр бич.`;

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", description: "0–10 оноо" },
    note: { type: "string", description: "Монголоор нэг өгүүлбэр" },
  },
  required: ["score", "note"],
  additionalProperties: false,
};

export interface JudgeOutput {
  score: number;
  note: string;
}

/** Шүүгчид өгөх хэрэглэгчийн мессеж */
export function judgeUser(input: {
  taskTitle: string;
  prompt: string;
  reference: string | null;
  rubric: RubricItem[];
  output: string;
}): string {
  const rubric = input.rubric.length
    ? input.rubric.map((r) => `- ${r.name} (жин ${r.weight}): ${r.hint}`).join("\n")
    : "- Даалгаврын гүйцэтгэл, монгол хэлний чанар";

  return [
    `ДААЛГАВАР: ${input.taskTitle}`,
    "",
    input.prompt,
    "",
    ...(input.reference ? ["ЛАВЛАХ ХАРИУЛТ (жишиг, цорын ганц зөв биш):", input.reference, ""] : []),
    "ШАЛГУУР:",
    rubric,
    "",
    "МОДЕЛИЙН ХАРИУЛТ:",
    input.output.slice(0, 6_000),
  ].join("\n");
}

/**
 * 0–10 хооронд барина. Буруу утга ирвэл null.
 *
 * null/undefined/хоосон мөрийг Number() нь 0 болгодог тул тусад нь шүүнэ —
 * «оноо алга» ба «оноо 0» хоёр өөр утгатай.
 */
export function parseScore(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  if (typeof raw === "boolean") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

/** "anthropic/claude-sonnet-5" → "anthropic" */
export function vendorOf(modelSlug: string): string {
  return modelSlug.split("/")[0]?.toLowerCase() ?? "";
}

/**
 * Шүүгч өөрийн компанийн моделийг үнэлж байна уу.
 * Тийм бол хоёр дахь шүүгчээр давхар үнэлж дунджална.
 */
export function needsSecondJudge(judgeModel: string, targetModel: string): boolean {
  const judge = vendorOf(judgeModel);
  return judge !== "" && judge === vendorOf(targetModel);
}

/** Нэг буюу хоёр шүүгчийн оноог нэгтгэнэ */
export function combineScores(first: number | null, second: number | null): number | null {
  if (first === null) return second;
  if (second === null) return first;
  return Math.round(((first + second) / 2) * 10) / 10;
}

/**
 * Даалгаврын эцсийн оноо.
 *
 * Дараалал: гараар өгсөн оноо → тодорхой шалгалт унасан бол 0 → шүүгчийн оноо.
 * Модель хариу өгөөгүй бол 0 (алгасвал унасан модель давуу байдал олно).
 */
export function finalScore(r: {
  humanScore?: number | null;
  checkerPass?: boolean | null;
  judgeScore?: number | null;
  error?: string | null;
}): number {
  if (typeof r.humanScore === "number") return r.humanScore;
  if (r.error) return 0;
  if (r.checkerPass === false) return 0;
  return r.judgeScore ?? 0;
}
