/**
 * Pipeline-ийн алхмуудын ангилал, давталтын хамгаалалт — цэвэр логик (DB-гүй, тесттэй).
 *
 * `src/pipeline.ts` нь импортлоход main() ажилладаг тул эдгээрийг тусад нь гаргав.
 */

/**
 * Гол алхмууд: эдгээр унавал сайт дээр шинэ мэдээ гарахгүй, пост тавигдахгүй.
 * Зөвхөн эдгээр унасан үед pipeline нь exit 1 өгнө (Railway улаан болно).
 */
export const CORE_STEPS = ["rss", "agent", "publish", "facebook", "instagram"] as const;

export function isCoreStep(name: string): boolean {
  return (CORE_STEPS as readonly string[]).includes(name);
}

/**
 * Өдөрт нэг удаагийн алхам ийм удаа унавал тэр өдөртөө дахин оролдохгүй.
 *
 * 2026-09-27: digest нь max_tokens-д багтахгүй болж, цаг тутмын PREPARE run бүрт
 * дахин унаж LLM-ийн зардлыг дэмий үрж байв. Гэмтэл нь өөрөө заслагдахгүй төрлийнх
 * бол дахин оролдох нь зөвхөн мөнгө, лог үрнэ.
 */
export const MAX_FAILURES_PER_DAY = 2;

/** Өнөөдөр хэдэн удаа унасны дараа болих вэ */
export function shouldGiveUpToday(failuresToday: number, max = MAX_FAILURES_PER_DAY): boolean {
  return failuresToday >= max;
}

/** Алхмуудын үр дүнгээс exit code гаргана: зөвхөн гол алхам унавал 1 */
export function exitCodeFor(failedSteps: string[]): 0 | 1 {
  return failedSteps.some(isCoreStep) ? 1 : 0;
}
