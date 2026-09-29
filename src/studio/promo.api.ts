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

export type Network = "facebook" | "instagram";

/**
 * utm-тэй мэргэжлийн хуудасны холбоос — ЗӨВХӨН FB-д.
 *
 * IG дээр коммент дарагддаг тул тэнд холбоос тавихгүй: хэрэглэгч bio-гийн
 * /ig хуудсаар дамжина.
 */
export function promoLink(siteUrl: string, personaSlug: string, network: Network): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/prompt/studio/m/${personaSlug}?utm_source=${network}&utm_campaign=weekly_prompt`;
}

/** IG постын текст, картад URL байж БОЛОХГҮЙ */
const URL_RE = /https?:\/\/|www\.|[a-z0-9-]+\.(mn|com|net|org|io|app)\b/i;

export function hasUrl(text: string): boolean {
  return URL_RE.test(text);
}

/** Сүлжээ бүрийн CTA — IG-д коммент дарагддаг тул bio руу чиглүүлнэ */
export const CTA: Record<Network, string> = {
  facebook: "Өөрийн хүсэлтээр туршаад үзээрэй — холбоос коммент дээр.",
  instagram: "Өөрийн хүсэлтээр туршаад үзээрэй — холбоос bio-д.",
};

/** Картын доод мөр */
export const CARD_FOOTER: Record<Network, string> = {
  facebook: `${EXAMPLE_LABEL} · холбоос коммент дээр`,
  instagram: `${EXAMPLE_LABEL} · холбоос bio-д`,
};

/**
 * ЗАГВАРЫН бичсэн хэсгүүд — тооны баталгаажуулалт зөвхөн эдгээрт хамаарна.
 *
 * Hook, хүсэлт (personas.json), CTA, эргэлтийн өгүүлбэр бүгд ГАРААР бичигдэж,
 * хянагдсан текст. Тэднийг мэдлэгийн сангийн тоотой тулгах нь утгагүй: «20
 * секундын бичлэг», «30 секунд» гэсэн бодит амьдралын хэллэг Kling/Runway-н
 * баримтад байхгүй тул шалгалт унаж, сурталчилгааны slot чимээгүй мэдээ рүү
 * буцдаг байв (2026-09-29-нд 24 hook-оос 3 нь ингэж унасан).
 */
export function machineWritten(a: { promptSnippet: string }): string {
  return a.promptSnippet;
}

/** Промптын хэсэг — хэдэн үгээр харуулах вэ */
export const SNIPPET_WORDS = 12;

/** Эхний N үгийг л авна — пост богино байх ёстой */
export function snippetWords(prompt: string, words = SNIPPET_WORDS): string {
  const parts = prompt.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length <= words) return parts.join(" ");
  return `${parts.slice(0, words).join(" ")}…`;
}

/**
 * Постын бие: hook → эргэлт → жишээ промпт → CTA.
 *
 * Бүтэц нь ideas.md-ийн зарчмаар: хүний insight-аас эхэлж (бүтээгдэхүүнээс биш),
 * гэнэтийн эргэлт өгөөд («видео хийж үзээгүй ч болно»), нэг л санааг хүргэнэ.
 * Зохиомол хэрэглэгч, сэтгэгдэл ХЭЗЭЭ Ч үгүй — «Жишээ» гэж тодорхой.
 */
export function promoBody(a: {
  network: Network;
  personaName: string;
  hook: string;
  request: string;
  promptSnippet: string;
  toolNames: string[];
}): string {
  const tools = a.toolNames.slice(0, 2).join(", ");
  return [
    a.hook,
    "",
    `Өөрөө хийж үзээгүй ч болно: хүсэлтээ монголоор бич — Промпт студи ${
      tools ? `${tools}-д ` : ""
    }шууд хуулах промптыг гаргаж өгнө.`,
    "",
    `${EXAMPLE_LABEL} — ${a.personaName}: «${a.request}»`,
    `Жишээ промптын эхлэл: ${a.promptSnippet}`,
    "",
    CTA[a.network],
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

/**
 * Дараагийн N сурталчилгааны slot — `--next`-д.
 *
 * Одоогийн агшны slot нь аль хэдийн өнгөрсөн (эсвэл яг одоо) бол дараагийнхаас
 * эхэлнэ: 19:30-ын постыг мэдээгээр явуулсан бол дараагийнх нь баасан болно.
 */
export function nextSlots(now: Date, slots: PromoSlot[], count = 3): { at: Date; slot: PromoSlot }[] {
  if (slots.length === 0) return [];
  const UB = 8 * 3_600_000;
  const ub = new Date(now.getTime() + UB);
  const out: { at: Date; slot: PromoSlot }[] = [];

  // 8 долоо хоног хүртэл урагш хайна — 3 slot олоход хангалттай
  for (let d = 0; d <= 56 && out.length < count; d++) {
    const day = new Date(Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate() + d));
    const weekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    for (const slot of slots.filter((s) => s.weekday === weekday).sort((a, b) =>
      a.time.hour * 60 + a.time.minute - (b.time.hour * 60 + b.time.minute))) {
      const atUb = Date.UTC(
        day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), slot.time.hour, slot.time.minute,
      );
      const at = new Date(atUb - UB);
      // ЯГ ОДОО эсвэл өнгөрсөн slot-ыг тоохгүй — тэр нь аль хэдийн шийдэгдсэн
      if (at.getTime() <= now.getTime()) continue;
      if (out.length < count) out.push({ at, slot });
    }
  }
  return out;
}

/** УБ цагаар «10/02 баасан 19:30» */
export function slotLabel(at: Date): string {
  const ub = new Date(at.getTime() + 8 * 3_600_000);
  const days = ["ням", "даваа", "мягмар", "лхагва", "пүрэв", "баасан", "бямба"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(ub.getUTCMonth() + 1)}/${p(ub.getUTCDate())} ${days[ub.getUTCDay()]} ` +
    `${p(ub.getUTCHours())}:${p(ub.getUTCMinutes())}`;
}
