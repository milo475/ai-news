/**
 * Agent-ийн нэг run-ийн багц ба өдрийн зардлын хязгаар — цэвэр логик (тесттэй).
 *
 * Pipeline цаг бүр ажилладаг болсон тул нэг run-д бага багаар үнэлж, өдрийн нийт зардлыг
 * тогтмол барина.
 */

/** Нэг run-д үнэлэх RAW нийтлэлийн анхдагч тоо */
export const DEFAULT_AGENT_BATCH = 8;

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

/** Төсөв дүүрсэн үү (0 = хязгааргүй) */
export function budgetExhausted(spentUsd: number, budgetUsd: number): boolean {
  return budgetUsd > 0 && spentUsd >= budgetUsd;
}
