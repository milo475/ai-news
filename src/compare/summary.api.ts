/**
 * Харьцуулалтын LLM дүгнэлт — prompt, схем, шалгуур (цэвэр).
 */
import { BENCH_CATEGORY_LABEL } from "../bench/task.api";
import { USE_CASE_LABEL, type CompareStats, type Recommendation } from "./pair.api";

export const SUMMARY_SYSTEM = `Чи монгол хэлээр бичдэг технологийн тоймч. Хоёр AI моделийн
ХЭМЖСЭН ӨГӨГДЛИЙГ уншаад «аль нь дээр вэ» гэсэн товч дүгнэлт бич.

ХАТУУ ДҮРЭМ
- ЯГ 3 өгүүлбэр. Илүү ч биш, дутуу ч биш.
- ЗӨВХӨН өгсөн тоонд тулгуурла. Байхгүй тоо, шинж чанар бүү зохио.
- Аль нэгийг нь хэт өргөмжлөхгүй. «Юунд аль нь» гэдгийг хэл — «X бүх зүйлд дээр» гэж бичихгүй.
- Өгөгдөл дутуу байвал үүнийг шулуун хэл («монгол хэлний хэмжилт хоёуланд байхгүй»).
- Emoji хэрэглэхгүй. Загварын нэрийг нэрээр нь бич.
- Уншигч нь техникийн бус монгол хүн — «latency», «context» гэх мэт үгийг монголоор тайлбарла.

БҮТЭЦ (3 өгүүлбэр)
1. Хамгийн чухал ялгаа — монгол хэлний оноо эсвэл байхгүй бол Arena/үнэ.
2. Үнэ, хурдны ялгаа — практик талаас.
3. Хэнд аль нь тохирохыг нэг өгүүлбэрээр.`;

export const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summaryMn: { type: "string", description: "Яг 3 өгүүлбэр" },
  },
  required: ["summaryMn"],
  additionalProperties: false,
};

export interface SummaryOutput {
  summaryMn: string;
}

function row(label: string, a: string, b: string): string {
  return `- ${label}: ${a} | ${b}`;
}

function n(v: number | null, suffix = "", digits = 2): string {
  return v === null ? "мэдэгдэхгүй" : `${digits === 0 ? Math.round(v) : v.toFixed(digits)}${suffix}`;
}

/** LLM-д өгөх өгөгдөл — хүснэгт хэлбэрээр */
export function summaryUser(a: CompareStats, b: CompareStats, recs: Recommendation[]): string {
  const cats = new Set([...Object.keys(a.mnByCategory), ...Object.keys(b.mnByCategory)]);

  return [
    `A = ${a.name} (${a.company})`,
    `B = ${b.name} (${b.company})`,
    "",
    "ХЭМЖСЭН ӨГӨГДӨЛ (A | B):",
    row("Монгол хэлний нийт оноо (0–10)", n(a.mnScore, "", 2), n(b.mnScore, "", 2)),
    ...[...cats].map((c) =>
      row(
        `  ${BENCH_CATEGORY_LABEL[c as keyof typeof BENCH_CATEGORY_LABEL] ?? c}`,
        n(a.mnByCategory[c] ?? null, "", 1),
        n(b.mnByCategory[c] ?? null, "", 1),
      ),
    ),
    row("Arena Elo", n(a.arenaElo, "", 0), n(b.arenaElo, "", 0)),
    row("Хэрэглээний байр", a.usageRank === null ? "жагсаалтад байхгүй" : `#${a.usageRank}`,
      b.usageRank === null ? "жагсаалтад байхгүй" : `#${b.usageRank}`),
    row("Context (токен)", n(a.contextLength, "", 0), n(b.contextLength, "", 0)),
    row("Оролт $/1M токен", n(a.inputPricePerM, "", 3), n(b.inputPricePerM, "", 3)),
    row("Гаралт $/1M токен", n(a.outputPricePerM, "", 3), n(b.outputPricePerM, "", 3)),
    row("Монгол 1000 үгийн үнэ, USD", n(a.mnCostPer1k, "", 3), n(b.mnCostPer1k, "", 3)),
    row("Хариу өгөх хугацаа (сек)", a.latencyMs === null ? "мэдэгдэхгүй" : (a.latencyMs / 1000).toFixed(1),
      b.latencyMs === null ? "мэдэгдэхгүй" : (b.latencyMs / 1000).toFixed(1)),
    row("Оролтын төрөл", a.inputModalities.join(", ") || "мэдэгдэхгүй", b.inputModalities.join(", ") || "мэдэгдэхгүй"),
    "",
    "ДҮРМЭЭР ГАРСАН ДҮГНЭЛТ (зөрчихгүй):",
    ...recs.map((r) => {
      const who = r.winner === "a" ? a.name : r.winner === "b" ? b.name : "тэнцүү/мэдэгдэхгүй";
      return `- ${USE_CASE_LABEL[r.useCase]}: ${who} (${r.reason})`;
    }),
  ].join("\n");
}

export interface SummaryProblem {
  code: "empty" | "too-short" | "sentences" | "emoji";
  detail: string;
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;

/** Өгүүлбэрийн тоо — монгол текстэд ".", "!", "?"-оор тоолно */
export function sentenceCount(text: string): number {
  return text.split(/[.!?]+(?:\s|$)/u).filter((s) => s.trim().length > 0).length;
}

export function checkSummary(text: string): SummaryProblem[] {
  const p: SummaryProblem[] = [];
  const t = (text ?? "").trim();
  if (!t) {
    p.push({ code: "empty", detail: "хоосон" });
    return p;
  }
  if (t.length < 120) p.push({ code: "too-short", detail: `${t.length} тэмдэгт` });
  const sentences = sentenceCount(t);
  if (sentences < 2 || sentences > 4) p.push({ code: "sentences", detail: `${sentences} өгүүлбэр` });
  if (EMOJI.test(t)) p.push({ code: "emoji", detail: "emoji байна" });
  return p;
}

export function sanitizeSummary(text: string): string {
  return (text ?? "")
    .replace(/[\p{Extended_Pictographic}️]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
