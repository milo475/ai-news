/**
 * Хайлтын хуудасны табууд — цэвэр логик (DB-гүй, тесттэй).
 *
 * Таб нь ?t= параметраар илэрхийлэгдэнэ: сервер талд шийдэгдэж, JS-гүй ажиллана.
 */

export const TAB_KEYS = ["all", "medee", "zaavar", "prompt", "hereglel", "model"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_LABELS: Record<TabKey, string> = {
  all: "Бүгд",
  medee: "Мэдээ",
  zaavar: "Заавар",
  prompt: "Prompt",
  hereglel: "Хэрэгсэл",
  model: "Модель",
};

/** Танихгүй утгыг "all" болгоно — хэрэглэгч гараар бичсэн ч эвдрэхгүй */
export function parseTab(raw: string | undefined): TabKey {
  const t = (raw ?? "").trim().toLowerCase();
  return (TAB_KEYS as readonly string[]).includes(t) ? (t as TabKey) : "all";
}

export interface TabCountsInput {
  articles: unknown[];
  guides: unknown[];
  prompts: unknown[];
  catalogTools: unknown[];
  tools: unknown[];
  models: unknown[];
}

/** Таб бүрийн үр дүнгийн тоо. «Хэрэгсэл» нь каталог + хэрэглээний хэрэгслийг нийлүүлнэ. */
export function tabCounts(r: TabCountsInput): Record<TabKey, number> {
  const hereglel = r.catalogTools.length + r.tools.length;
  const all =
    r.articles.length + r.guides.length + r.prompts.length + hereglel + r.models.length;
  return {
    all,
    medee: r.articles.length,
    zaavar: r.guides.length,
    prompt: r.prompts.length,
    hereglel,
    model: r.models.length,
  };
}

/** Тухайн хэсгийг энэ табд үзүүлэх үү */
export function showSection(tab: TabKey, section: Exclude<TabKey, "all">): boolean {
  return tab === "all" || tab === section;
}

/** Хоосон биш табуудыг л үзүүлнэ (+ "Бүгд" үргэлж) */
export function visibleTabs(counts: Record<TabKey, number>): TabKey[] {
  return TAB_KEYS.filter((k) => k === "all" || counts[k] > 0);
}

/** Табын холбоос — хайлтын үгийг хадгална */
export function tabHref(q: string, tab: TabKey): string {
  const p = new URLSearchParams({ q });
  if (tab !== "all") p.set("t", tab);
  return `/hailt?${p.toString()}`;
}
