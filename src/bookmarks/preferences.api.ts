/**
 * Сонирхлын цэвэр логик (DB-гүй тул тесттэй).
 */
import type { ArticleCategory } from "../generated/prisma/enums";

/** Нүүрэнд "Таны сонирхол" блок харуулах эсэх */
export function showInterestBlock(
  user: { id: string } | null,
  categories: ArticleCategory[],
  itemCount: number,
): boolean {
  return user !== null && categories.length > 0 && itemCount > 0;
}

/** Form-оос ирсэн ангиллуудыг шалгаж цэвэрлэнэ (давхардалгүй, зөвхөн танигдах утга) */
export function cleanCategories(raw: string[], allowed: readonly string[]): ArticleCategory[] {
  const seen = new Set<string>();
  for (const value of raw) {
    const key = value.trim().toUpperCase();
    if (allowed.includes(key)) seen.add(key);
  }
  return [...seen] as ArticleCategory[];
}

/** Хэрэглээний slug-ууд — зөвхөн одоо идэвхтэй ангиллуудаас */
export function cleanUsecases(raw: string[], allowed: readonly string[]): string[] {
  const set = new Set(allowed);
  return [...new Set(raw.map((s) => s.trim()).filter((s) => set.has(s)))];
}
