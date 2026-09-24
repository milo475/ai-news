/**
 * Нийтлэлийн ангилал — зөвхөн моделийн мэдээ биш, уншигчид хэрэгтэй өргөн хүрээ.
 *
 * Цэвэр файл (DB, LLM-гүй): agent-ийн prompt, квотын дүрэм, /admin, FB текст бүгд эндээс уншина.
 */
import type { ArticleCategory } from "../generated/prisma/enums";

export const CATEGORIES: ArticleCategory[] = ["NEWS", "PROJECT", "BUSINESS", "FACT", "RISK", "HOWTO"];

/** /admin, хуудсанд харуулах монгол нэр */
export const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  NEWS: "Мэдээ",
  PROJECT: "Төсөл",
  BUSINESS: "Бизнес",
  FACT: "Баримт",
  RISK: "Эрсдэл",
  HOWTO: "Хэрэглээ",
};

/** Үнэлгээний prompt-д өгөх тодорхойлолт */
export const CATEGORY_HINT: Record<ArticleCategory, string> = {
  NEWS: "салбарын мэдээ: шинэ модель, компанийн шийдвэр, хөрөнгө оруулалт",
  PROJECT: "AI-аар хийсэн төсөл, бүтээгдэхүүн, нээлттэй эх — хэн нэгэн юу хийснийг харуулсан",
  BUSINESS: "бизнес санаа, орлого, мөнгө олсон жишээ, зах зээлийн боломж",
  FACT: "сонирхолтой баримт, судалгааны үр дүн, тоо баримт, гайхалтай нээлт",
  RISK: "аюул, хууран мэхлэлт, алдаа, хувийн мэдээлэл, зохицуулалт, хууль",
  HOWTO: "хэрэглээ, заавар, зөвлөгөө — уншигч өөрөө давтаж хийх боломжтой",
};

/** LLM-ийн буцаасан утгыг шалгаж, танигдахгүй бол эх сурвалжийн анхдагчийг авна */
export function toCategory(raw: unknown, fallback: ArticleCategory = "NEWS"): ArticleCategory {
  const key = String(raw ?? "").trim().toUpperCase();
  return (CATEGORIES as string[]).includes(key) ? (key as ArticleCategory) : fallback;
}

/** Үнэлгээний prompt-д тавих ангиллын жагсаалт */
export function categoryPromptBlock(): string {
  return CATEGORIES.map((c) => `- ${c}: ${CATEGORY_HINT[c]}`).join("\n");
}
