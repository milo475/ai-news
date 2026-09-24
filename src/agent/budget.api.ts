/**
 * Agent-ийн нэг run-ийн багц ба өдрийн зардлын хязгаар — цэвэр логик (тесттэй).
 *
 * Pipeline цаг бүр ажилладаг болсон тул нэг run-д бага багаар үнэлж, өдрийн нийт зардлыг
 * тогтмол барина.
 */

/** Нэг run-д үнэлэх RAW нийтлэлийн анхдагч тоо */
export const DEFAULT_AGENT_BATCH = 10;

/** RAW дараалал эндээс доош орвол багцаа багасгана — хуримтлал байхгүй бол яарах шаардлагагүй */
export const LOW_QUEUE_THRESHOLD = 50;

/** Дараалал бага үеийн багц */
export const LOW_QUEUE_BATCH = 6;

/** Өдрийн LLM зардлын анхдагч дээд хэмжээ, USD */
export const DEFAULT_AGENT_DAILY_BUDGET = 1.5;

function positive(raw: string | undefined, fallback: number, integer: boolean): number {
  const value = raw?.trim();
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return integer ? Math.floor(n) : n;
}

/** AGENT_BATCH — нэг run-д хэдэн RAW үнэлэх вэ (0 = үнэлгээ унтраалттай) */
export function agentBatch(env: Record<string, string | undefined> = process.env): number {
  return positive(env.AGENT_BATCH, DEFAULT_AGENT_BATCH, true);
}

/** AGENT_DAILY_BUDGET_USD — УБ өдрийн LLM зардлын дээд хэмжээ (0 = хязгааргүй) */
export function agentDailyBudget(env: Record<string, string | undefined> = process.env): number {
  return positive(env.AGENT_DAILY_BUDGET_USD, DEFAULT_AGENT_DAILY_BUDGET, false);
}

/**
 * Дарааллын уртаас хамаарсан багц: RAW 50-аас доош бол 6 болж буурна.
 * Тохируулсан утга 6-аас бага бол түүнийг нь хүндэтгэнэ.
 */
export function adaptiveBatch(batch: number, rawQueue: number): number {
  if (batch === 0) return 0;
  return rawQueue < LOW_QUEUE_THRESHOLD ? Math.min(batch, LOW_QUEUE_BATCH) : batch;
}

/** Төсөв дүүрсэн үү (0 = хязгааргүй) */
export function budgetExhausted(spentUsd: number, budgetUsd: number): boolean {
  return budgetUsd > 0 && spentUsd >= budgetUsd;
}
