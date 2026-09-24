/**
 * Agent ямар RAW нийтлэлүүдийг авах вэ — цэвэр логик (DB-гүй, тесттэй).
 *
 * Нэг жин өндөртэй эх сурвалж (OpenAI Blog, TechCrunch ...) ээлжээ бүхэлд нь эзэлдэг байсан тул
 * багцыг хоёр хуваана:
 *   (а) жин өндөртэй эх сурвалжууд — салбарын гол мэдээ,
 *   (б) PROJECT/BUSINESS/FACT/HOWTO анхдагч ангилалтай эх сурвалжууд — төсөл, бизнес, баримт,
 *       заавар (эдгээр нь ихэвчлэн жин багатай тул хуучин дараалалд ар талд гацдаг байв).
 * Аль нэг бүлэг хүрэлцэхгүй бол нөгөөгөөр нөхнө.
 */
import type { ArticleCategory } from "../generated/prisma/enums";

/** Эндээс дээш жинтэй эх сурвалжийг «өндөр жинтэй» гэж үзнэ */
export const HIGH_WEIGHT_MIN = 7;

/** Хоёр дахь бүлгийг бүрдүүлэх эх сурвалжийн анхдагч ангилал */
export const DIVERSE_CATEGORIES: ArticleCategory[] = ["PROJECT", "BUSINESS", "FACT", "HOWTO"];

/** Үүнээс хуучин RAW нийтлэлийг агент рүү оруулахгүй (SKIPPED) */
export const STALE_RAW_DAYS = 7;

/** Багцын хагасыг тал бүрээс — сондгой тоонд өндөр жинтэй нь нэгээр илүү авна */
export function splitSizes(limit: number): { high: number; diverse: number } {
  const diverse = Math.floor(limit / 2);
  return { high: limit - diverse, diverse };
}

/**
 * Хоёр бүлгийг нэгтгэнэ: тус бүрээс ногдох хэмжээгээр, дутсаныг нөгөөгөөр нөхнө.
 * Давхардсан нийтлэлийг (жин өндөртэй БӨГӨӨД ангилал нь олон талт эх сурвалж) нэг л удаа авна.
 */
export function mixRawBatch<T extends { id: string }>(high: T[], diverse: T[], limit: number): T[] {
  if (limit <= 0) return [];
  const size = splitSizes(limit);
  const picked: T[] = [];
  const seen = new Set<string>();

  const take = (list: T[], n: number) => {
    for (const item of list) {
      if (picked.length >= limit || n <= 0) break;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      picked.push(item);
      n--;
    }
  };

  take(high, size.high);
  take(diverse, size.diverse);
  // Нэг бүлэг дутсан бол нөгөөгөөр дүүргэнэ
  take(high, limit - picked.length);
  take(diverse, limit - picked.length);

  return picked;
}

/** Хоцрогдсон гэж үзэх хилийн огноо */
export function staleBefore(now: Date, days = STALE_RAW_DAYS): Date {
  return new Date(now.getTime() - days * 86_400_000);
}
