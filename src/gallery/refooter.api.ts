/**
 * Картын ХӨЛИЙГ дахин зурах — цэвэр хэсэг.
 *
 * Яагаад тусдаа урсгал вэ: 2026-09-25-аас 09-27 хооронд бүх карт доод зүүн буландаа
 * «_дагаарай» гэсэн дуусгаагүй тэмдэглэгээтэй үүссэн. Гарчиг, зураг нь ЗӨВ тул
 * бүтнээр дахин үүсгэх нь LLM ба зургийн квотыг дэмий иднэ. Хадгалсан текстгүй суурь
 * зураг (`heroImageData`) дээр давхаргыг л дахин зурна — зардал ТЭГ.
 */

/** `buildCard` эх сурвалжийн зураг хэрэглэсэн үед `fbImagePrompt`-д бичдэг утга */
export const SOURCE_IMAGE_PROMPT = "эх сурвалжийн зураг";

/** Хөл засах шаардлагатай картууд хэзээнээс үүссэн бэ (УБ огноо) */
export const BROKEN_FOOTER_SINCE = "2026-09-25";

/**
 * Эх сурвалжийн зураг хэрэглэсэн эсэхийг хадгалсан prompt-оос таана — credit-ийг
 * дахин зурахад хэрэгтэй. Шинээр үүсгэсэн зурагт credit байхгүй.
 */
export function usedSourceImage(fbImagePrompt: string | null): boolean {
  return (fbImagePrompt ?? "").trim() === SOURCE_IMAGE_PROMPT;
}

export type SkipReason = "суурь зураг алга" | "гарчиг алга" | "карт алга";

export interface FooterRow {
  id: string;
  slug: string;
  fbHook: string | null;
  fbImagePrompt: string | null;
  hasHero: boolean;
  hasCard: boolean;
}

/** Дахин зурж болох эсэх — болохгүй бол шалтгаан */
export function skipReasonFor(a: FooterRow): SkipReason | null {
  if (!a.hasCard) return "карт алга";
  if (!a.hasHero) return "суурь зураг алга";
  if (!(a.fbHook ?? "").trim()) return "гарчиг алга";
  return null;
}

export interface FooterPlan {
  redraw: FooterRow[];
  skipped: { slug: string; reason: SkipReason }[];
}

export function planFooters(rows: FooterRow[]): FooterPlan {
  const plan: FooterPlan = { redraw: [], skipped: [] };
  for (const a of rows) {
    const reason = skipReasonFor(a);
    if (reason) plan.skipped.push({ slug: a.slug, reason });
    else plan.redraw.push(a);
  }
  return plan;
}
