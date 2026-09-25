/**
 * Бенчмаркийн даалгаврын цэвэр логик — ангилал, rubric, тодорхой шалгалт (checker).
 *
 * «Тодорхой шалгалт» нь LLM шүүгчээс хамааралгүй, машинаар хэмжигдэх шаардлага:
 * JSON хүчинтэй эсэх, үгийн тоо, кириллийн хувь. Унавал тухайн даалгаврын оноо 0.
 */
import type { BenchCategory } from "../generated/prisma/enums";

export const BENCH_CATEGORIES: BenchCategory[] = [
  "ORCHUULGA_MN_EN", "ORCHUULGA_EN_MN", "TOVCHLOL", "NAIRUULGA", "ALBAN_BICHIG",
  "OILGOLT", "BODLOGO", "SOYOL", "ZAAVAR_DAGAH", "JSON_GARGAH",
];

export const BENCH_CATEGORY_LABEL: Record<BenchCategory, string> = {
  ORCHUULGA_MN_EN: "Орчуулга МН→АН",
  ORCHUULGA_EN_MN: "Орчуулга АН→МН",
  TOVCHLOL: "Товчлол",
  NAIRUULGA: "Найруулга",
  ALBAN_BICHIG: "Албан бичиг",
  OILGOLT: "Унших ойлголт",
  BODLOGO: "Тоон бодлого",
  SOYOL: "Монгол соёл",
  ZAAVAR_DAGAH: "Заавар дагах",
  JSON_GARGAH: "JSON гаргах",
};

/** Жагсаалтын багана нарийн тул богино нэр */
export const BENCH_CATEGORY_SHORT: Record<BenchCategory, string> = {
  ORCHUULGA_MN_EN: "МН→АН",
  ORCHUULGA_EN_MN: "АН→МН",
  TOVCHLOL: "Товч",
  NAIRUULGA: "Найр",
  ALBAN_BICHIG: "Албан",
  OILGOLT: "Ойлг",
  BODLOGO: "Бодл",
  SOYOL: "Соёл",
  ZAAVAR_DAGAH: "Заавар",
  JSON_GARGAH: "JSON",
};

export const BENCH_CATEGORY_HINT: Record<BenchCategory, string> = {
  ORCHUULGA_MN_EN: "Монгол текстийг англи руу — нэр томьёо, өгүүлбэрийн бүтэц",
  ORCHUULGA_EN_MN: "Англи текстийг монгол руу — байгалийн хэллэг, калькгүй",
  TOVCHLOL: "Урт монгол текстийг гол санааг алдалгүй товчлох",
  NAIRUULGA: "Алдаатай монгол өгүүлбэрийг дүрмийн дагуу засах",
  ALBAN_BICHIG: "Монголын албан бичгийн хэв маягаар бичих",
  OILGOLT: "Монгол текстээс баримт олж, дүгнэлт хийх",
  BODLOGO: "Монголоор бичигдсэн тоон бодлого бодох",
  SOYOL: "Монголын түүх, соёл, газар зүйн бодит баримт",
  ZAAVAR_DAGAH: "Өгсөн форматыг яг дагах (үгийн тоо, бүтэц)",
  JSON_GARGAH: "Монгол агуулгыг хүчинтэй JSON болгож гаргах",
};

// ——— Rubric ———

export interface RubricItem {
  name: string;
  /** Шалгуурын жин (нийлбэр нь 1 болох албагүй — хувь тэнцүүлж тооцно) */
  weight: number;
  hint: string;
}

/** Json баганаас rubric-ийг аюулгүй унших */
export function parseRubric(raw: unknown): RubricItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { name, weight, hint } = item as { name?: unknown; weight?: unknown; hint?: unknown };
    if (typeof name !== "string" || !name.trim()) return [];
    return [{
      name: name.trim(),
      weight: typeof weight === "number" && weight > 0 ? weight : 1,
      hint: typeof hint === "string" ? hint.trim() : "",
    }];
  });
}

// ——— Checker ———

export type CheckerSpec =
  | { kind: "json" }
  | { kind: "maxWords"; limit: number }
  | { kind: "cyrillic"; minRatio: number };

export function parseChecker(raw: unknown): CheckerSpec | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { kind, limit, minRatio } = raw as { kind?: unknown; limit?: unknown; minRatio?: unknown };
  if (kind === "json") return { kind: "json" };
  if (kind === "maxWords" && typeof limit === "number" && limit > 0) return { kind: "maxWords", limit };
  if (kind === "cyrillic" && typeof minRatio === "number" && minRatio > 0 && minRatio <= 1) {
    return { kind: "cyrillic", minRatio };
  }
  return null;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * Кирилл үсгийн хувь — зөвхөн ҮСЭГ тооцно (тоо, цэг таслал, зай тооцоонд орохгүй).
 * Латин үсэг хольсон хариултыг барина ("Энэ бол best solution").
 */
export function cyrillicRatio(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  const cyrillic = letters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch)).length;
  return cyrillic / letters.length;
}

/** Модель заримдаа ```json ... ``` дотор буцаадаг */
export function stripCodeFence(text: string): string {
  const t = text.trim();
  const m = /^```[a-z]*\s*\n?([\s\S]*?)\n?```$/i.exec(t);
  return (m ? m[1]! : t).trim();
}

export function isValidJson(text: string): boolean {
  const t = stripCodeFence(text);
  if (!t) return false;
  try {
    const parsed: unknown = JSON.parse(t);
    // Бүтэн JSON баримт байх ёстой — тоо, мөр биш
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

export interface CheckerResult {
  pass: boolean;
  detail: string;
}

/** Даалгаврын тодорхой шалгалт. Checker байхгүй бол шалгах зүйлгүй. */
export function runChecker(spec: CheckerSpec | null, output: string): CheckerResult | null {
  if (!spec) return null;

  if (spec.kind === "json") {
    const ok = isValidJson(output);
    return { pass: ok, detail: ok ? "хүчинтэй JSON" : "JSON биш эсвэл эвдэрсэн" };
  }
  if (spec.kind === "maxWords") {
    const n = wordCount(output);
    return { pass: n <= spec.limit, detail: `${n} үг (дээд тал ${spec.limit})` };
  }
  const ratio = cyrillicRatio(output);
  return {
    pass: ratio >= spec.minRatio,
    detail: `кирилл ${Math.round(ratio * 100)}% (доод тал ${Math.round(spec.minRatio * 100)}%)`,
  };
}
