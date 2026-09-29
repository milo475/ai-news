/**
 * «Долоо хоногийн промпт» — FB/IG-д долоо хоногт 2 удаа.
 *
 * Мэргэжлийн хуудаснаас жишээг ээлжлэн авч студиор ажиллуулаад «Хүсэлт → юу
 * гарах» гэсэн карт болгоно. Зохиомол хэрэглэгч, сэтгэгдэл ХЭЗЭЭ Ч үгүй —
 * «Жишээ» гэж тодорхой хэлнэ.
 */
import type { PublishTime } from "../jobs/mode.api";

/** Анхдагч: мягмар (2) ба баасан (5) гарагийн 19:30 */
export const DEFAULT_PROMO_SLOTS = "2@19:30,5@19:30";

export interface PromoSlot {
  /** ISO 7 хоногийн дугаар: 1 = даваа … 7 = ням */
  weekday: number;
  time: PublishTime;
}

/**
 * `STUDIO_PROMO_SLOTS` уншина: «2@19:30,5@19:30».
 * Хоосон мөр бол сурталчилгаа УНТАРНА (хоосон массив).
 */
export function promoSlots(env: NodeJS.ProcessEnv = process.env): PromoSlot[] {
  const raw = env.STUDIO_PROMO_SLOTS;
  // Тодорхой хоосон утга = унтраасан
  if (raw !== undefined && raw.trim() === "") return [];

  return (raw ?? DEFAULT_PROMO_SLOTS)
    .split(",")
    .flatMap((part) => {
      const m = /^\s*([1-7])\s*@\s*(\d{1,2}):(\d{2})\s*$/.exec(part);
      if (!m) return [];
      const hour = Number(m[2]);
      const minute = Number(m[3]);
      if (hour > 23 || minute > 59) return [];
      return [{ weekday: Number(m[1]), time: { hour, minute } }];
    });
}

/** УБ цагийн 7 хоногийн дугаар (1 = даваа) */
export function ubWeekday(now: Date, offsetMs = 8 * 3_600_000): number {
  const ub = new Date(now.getTime() + offsetMs);
  return ub.getUTCDay() === 0 ? 7 : ub.getUTCDay();
}

/** Энэ slot нь сурталчилгааны slot мөн үү */
export function isPromoSlot(now: Date, slots: PromoSlot[], windowMin = 30): boolean {
  const ub = new Date(now.getTime() + 8 * 3_600_000);
  const minutes = ub.getUTCHours() * 60 + ub.getUTCMinutes();
  const day = ubWeekday(now);

  return slots.some((s) => {
    if (s.weekday !== day) return false;
    const slotMin = s.time.hour * 60 + s.time.minute;
    return Math.floor(minutes / windowMin) === Math.floor(slotMin / windowMin);
  });
}

/** Долоо хоногийн дугаар — жишээг ээлжлэн сонгоход */
export function weekIndex(now: Date): number {
  const ub = new Date(now.getTime() + 8 * 3_600_000);
  const start = Date.UTC(2026, 0, 1);
  return Math.floor((ub.getTime() - start) / (7 * 86_400_000));
}

/**
 * Жишээний ээлжийн дугаар: долоо хоног бүрт 2 пост тул 2 алхамаар урагшилна.
 * `slotIndex` нь тухайн долоо хоногийн хэддэх пост вэ (0 эсвэл 1).
 */
export function exampleIndex(now: Date, slots: PromoSlot[]): number {
  const day = ubWeekday(now);
  const sorted = [...slots].sort((a, b) => a.weekday - b.weekday);
  const slotIndex = Math.max(0, sorted.findIndex((s) => s.weekday === day));
  return weekIndex(now) * Math.max(1, slots.length) + slotIndex;
}

// ---------- Постын текст ----------

export const PROMO_TAG = "Промпт студи";
export const EXAMPLE_LABEL = "Жишээ";

/** Хориотой — зохиомол нийгмийн баталгаа */
export const FAKE_SOCIAL_PROOF = [
  "манай хэрэглэгч",
  "хэрэглэгчид маань",
  "нэг хэрэглэгч",
  "сэтгэгдэл бичсэн",
  "гэж бичжээ",
  "олон хүн",
  "хүмүүс хэлж байна",
];

export function hasFakeProof(text: string): string | null {
  const t = text.toLowerCase();
  return FAKE_SOCIAL_PROOF.find((p) => t.includes(p)) ?? null;
}

export interface PromoCopy {
  /** Картын дээд мөр — хүсэлт */
  request: string;
  /** Картын доод мөр — юу гарах */
  outcome: string;
  /** FB/IG постын бие */
  body: string;
  /** Эхний комментод тавих холбоос */
  link: string;
}

/** utm-тэй мэргэжлийн хуудасны холбоос */
export function promoLink(siteUrl: string, personaSlug: string, network: "facebook" | "instagram"): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/prompt/studio/m/${personaSlug}?utm_source=${network}&utm_campaign=weekly_prompt`;
}

/** Постын бие — зохиомол нийгмийн баталгаагүй, «Жишээ» гэж тодорхой */
export function promoBody(a: {
  personaName: string;
  request: string;
  promptSnippet: string;
  toolNames: string[];
}): string {
  const tools = a.toolNames.slice(0, 2).join(" + ");
  return [
    `${EXAMPLE_LABEL}: ${a.personaName} — «${a.request}»`,
    "",
    `Промпт студи ${tools ? `${tools} хоёрт зориулсан ` : ""}бэлэн промпт, параметр, алхам бүрийн тайлбарыг монголоор гаргаж өгнө.`,
    "",
    `Промптын эхлэл: ${a.promptSnippet}`,
  ].join("\n");
}

/** Промптоос картад багтах богино хэсэг */
export const SNIPPET_CHARS = 120;

export function promptSnippet(prompt: string, max = SNIPPET_CHARS): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}
