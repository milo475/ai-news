/**
 * Өдрийн 3 постын slot — pipeline ажилласан цагаас (УБ) тодорхойлно.
 *
 *   09:00  morning  — хамгийн өндөр оноотой NEWS / RISK
 *   13:00  noon     — Мягмар/Пүрэв/Ням гаригт жагсаалтын карт, бусад өдөр FACT / BUSINESS
 *   19:00  evening  — PROJECT / HOWTO / BUSINESS
 *
 * Cron яг цагтаа ажиллахгүй байж болно (саатал, гараар ажиллуулах) тул цагийн мужаар шийднэ.
 */
import type { ArticleCategory } from "../generated/prisma/enums";
import { UB_OFFSET_MS } from "../jobs/day";

export type Slot = "morning" | "noon" | "evening";

/** Slot бүрийн эхний сонголт — эдгээрээс олдохгүй бол дараалалын дараагийнхыг авна */
export const SLOT_CATEGORIES: Record<Slot, ArticleCategory[]> = {
  morning: ["NEWS", "RISK"],
  noon: ["FACT", "BUSINESS"],
  evening: ["PROJECT", "HOWTO", "BUSINESS"],
};

/** Жагсаалтын карт тавих гаригууд: Мягмар (2), Пүрэв (4), Ням (0) */
export const RANKING_WEEKDAYS = [2, 4, 0];

/** УБ цагийн цаг (0–23) */
export function ubHour(now: Date): number {
  return new Date(now.getTime() + UB_OFFSET_MS).getUTCHours();
}

/** УБ цагийн гараг (0 = Ням) */
export function ubWeekday(now: Date): number {
  return new Date(now.getTime() + UB_OFFSET_MS).getUTCDay();
}

/** Цагийн мужаар slot: 11:00 хүртэл өглөө, 16:00 хүртэл өдөр, дараа нь орой */
export function slotOf(now: Date): Slot {
  const h = ubHour(now);
  if (h < 11) return "morning";
  if (h < 16) return "noon";
  return "evening";
}

export interface SlotPlan {
  slot: Slot;
  /** Жагсаалтын карт тавих уу (нийтлэлийн оронд) */
  ranking: boolean;
  /** Ямар ангиллын нийтлэлийг эхэнд нь үзэх вэ */
  categories: ArticleCategory[];
}

/** Тухайн агшинд ямар пост тавих вэ */
export function slotPlan(now: Date): SlotPlan {
  const slot = slotOf(now);
  return {
    slot,
    ranking: slot === "noon" && RANKING_WEEKDAYS.includes(ubWeekday(now)),
    categories: SLOT_CATEGORIES[slot],
  };
}
