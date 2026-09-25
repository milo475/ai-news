/**
 * Бенчмаркийн нийтлэлийн prompt, схем, бие угсрах — цэвэр хэсэг.
 */
import { BENCH_CATEGORY_LABEL } from "./task.api";
import { monthLabel } from "./summary.api";
import type { BenchCategory } from "../generated/prisma/enums";

export const ARTICLE_SYSTEM = `Чи монгол хэлээр бичдэг технологийн сэтгүүлч. AI News сар бүр
хиймэл оюуны моделиудыг МОНГОЛ ХЭЛНИЙ бодит даалгавраар тестэлдэг. Тестийн үр дүнгээс
уншигчдад зориулсан нийтлэл бич.

ХЭЛЛЭГ
- Тайван, баримтад суурилсан. Хэтрүүлэхгүй, зар шиг бичихгүй.
- Тоо баримтыг өгсөн өгөгдлөөс л ав. Байхгүй зүйл бүү нэм.
- Emoji хэрэглэхгүй.
- Уншигч нь техникийн бус монгол хүн — "benchmark", "latency" гэх мэт үгийг тайлбарлаж хэл.

БУЦААХ
- titleMn: ≤70 тэмдэгт. Сарыг нь заасан байх.
- leadMn: 2 өгүүлбэр — хэн түрүүлсэн, юу гайхалтай байсан.
- surprise: 1–2 өгүүлбэр — хамгийн гэнэтийн үр дүн (жишээ нь хямд модель үнэтэйгээ гүйцсэн).
- byCategory: ангилал тус бүрийн шилдгийн тухай нэг өгүүлбэр (өгсөн ангиллуудаар).
- caveat: 1–2 өгүүлбэр — энэ тестийн хязгаарлалт (цөөн даалгавар, LLM шүүгч гэх мэт).`;

export const ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string" },
    leadMn: { type: "string" },
    surprise: { type: "string" },
    byCategory: {
      type: "array",
      items: {
        type: "object",
        properties: { category: { type: "string" }, text: { type: "string" } },
        required: ["category", "text"],
        additionalProperties: false,
      },
    },
    caveat: { type: "string" },
  },
  required: ["titleMn", "leadMn", "surprise", "byCategory", "caveat"],
  additionalProperties: false,
};

export interface ArticleOut {
  titleMn: string;
  leadMn: string;
  surprise: string;
  byCategory: { category: string; text: string }[];
  caveat: string;
}

export interface TopRow {
  rank: number;
  modelSlug: string;
  name: string;
  company: string;
  avgScore: number;
  avgLatency: number;
  costPer1kMn: number;
}

/** LLM-д өгөх өгөгдөл */
export function articleUser(
  month: string,
  top: TopRow[],
  bestByCategory: { category: BenchCategory; modelName: string; score: number }[],
  tasks: number,
): string {
  return [
    `Сар: ${monthLabel(month)}`,
    `Даалгаврын тоо: ${tasks}`,
    "",
    "ЭРЭМБЭ (оноо 0–10):",
    ...top.map(
      (t) =>
        `${t.rank}. ${t.name} (${t.company}) — ${t.avgScore.toFixed(2)} оноо, ` +
        `${(t.avgLatency / 1000).toFixed(1)}с, монгол 1000 үг $${t.costPer1kMn.toFixed(3)}`,
    ),
    "",
    "АНГИЛАЛ БҮРИЙН ШИЛДЭГ:",
    ...bestByCategory.map(
      (b) => `- ${BENCH_CATEGORY_LABEL[b.category]}: ${b.modelName} (${b.score.toFixed(1)})`,
    ),
  ].join("\n");
}

/** Нийтлэлийн бие — markdown */
export function assembleArticle(
  data: ArticleOut,
  month: string,
  top: TopRow[],
  siteUrl: string,
): string {
  const table = [
    "| # | Модель | Оноо | Хурд | 1000 үгийн үнэ |",
    "|---|---|---|---|---|",
    ...top.map(
      (t) =>
        `| ${t.rank} | ${t.name} | ${t.avgScore.toFixed(2)} | ${(t.avgLatency / 1000).toFixed(1)}с | ` +
        `$${t.costPer1kMn.toFixed(3)} |`,
    ),
  ].join("\n");

  return [
    // "2026 оны 9-р сар" дээр "-ийн" залгах нь монгол хэлэнд эвгүй — зураасаар тусгаарлана
    `## Эрэмбэ — ${monthLabel(month)}`,
    table,
    "",
    "## Хамгийн гэнэтийн үр дүн",
    data.surprise.trim(),
    "",
    "## Ангилал бүрийн шилдэг",
    ...data.byCategory.map((c) => `- **${c.category}** — ${c.text.trim()}`),
    "",
    "## Хэрхэн хэмжсэн бэ",
    data.caveat.trim(),
    "",
    `Аргачлал, даалгаврын ангиллыг [${siteUrl}/benchmark/argachlal](${siteUrl}/benchmark/argachlal) ` +
    `хуудаснаас, бүтэн эрэмбийг [${siteUrl}/benchmark](${siteUrl}/benchmark) хуудаснаас үзнэ үү.`,
  ].join("\n");
}
