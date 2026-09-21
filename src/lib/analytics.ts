/**
 * Umami (self-hosted) руу custom event илгээх туслах.
 *
 * Аналитик хэзээ ч хуудсыг унагаах ёсгүй — script ачаалаагүй, хэрэглэгч блоклосон,
 * эсвэл dev орчинд env тохируулаагүй бол бүх дуудлага чимээгүй no-op болно.
 */

export type EventData = Record<string, string | number | boolean | undefined>;

interface UmamiApi {
  track: (event: string, data?: EventData) => void;
}

declare global {
  interface Window {
    umami?: UmamiApi;
  }
}

/** Tracker нь afterInteractive-аар ачаалдаг тул React mount-оос хоцорч магадгүй */
const RETRY_MS = 300;
const MAX_TRIES = 20; // ~6 секунд хүлээгээд орхино

/**
 * Event илгээнэ. window.umami байхгүй бол богино хугацаанд дахин оролдож,
 * ачаалахгүй бол чимээгүй орхино (сервер талд шууд гарна).
 */
export function track(event: string, data?: EventData, tries = 0): void {
  if (typeof window === "undefined") return;
  const umami = window.umami;
  if (umami) {
    try {
      umami.track(event, data);
    } catch {
      // Tracker-ийн дотоод алдаа хэрэглэгчид хамаагүй
    }
    return;
  }
  if (tries >= MAX_TRIES) return;
  window.setTimeout(() => track(event, data, tries + 1), RETRY_MS);
}

/** Сайтын хэмжих event-үүд — нэрийг нэг газар барина */
export const analytics = {
  /** Баталсан хайлт (dropdown-оос сонгосон эсвэл /hailt хуудас) */
  search: (query: string, resultCount: number) => track("search", { query, resultCount }),
  newsletterSubscribe: () => track("newsletter_subscribe"),
  newsletterConfirm: () => track("newsletter_confirm"),
  rankingTab: (tab: "usage" | "quality") => track("ranking_tab", { tab }),
  shareFacebook: (slug: string) => track("share_facebook", { slug }),
  modelView: (slug: string) => track("model_view", { slug }),
  useCaseView: (slug: string) => track("usecase_view", { slug }),
};

export interface UmamiConfig {
  /** Tracker script-ийн бүтэн хаяг */
  src: string;
  websiteId: string;
}

/**
 * Хоёр env хоёул байвал л tracker-ийг рендэрлэнэ. Нэг нь дутуу бол null —
 * локал dev дээр юу ч ачаалахгүй, консол бохирдохгүй.
 *
 * `process.env`-ийг бүтнээр нь дамжуулдаг учир Next үүнийг build үед inline хийхгүй,
 * Railway дээр runtime-ийн утгыг уншина (дахин build хийх шаардлагагүй).
 */
export function umamiConfig(env: Record<string, string | undefined>): UmamiConfig | null {
  const url = env.NEXT_PUBLIC_UMAMI_URL?.trim().replace(/\/+$/, "");
  const websiteId = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!url || !websiteId) return null;
  return { src: `${url}/script.js`, websiteId };
}
