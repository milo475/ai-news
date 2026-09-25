/**
 * Бенчмаркийн төсөв — урьдчилсан тооцоо ба зогсолт.
 */

/** BENCH_BUDGET_USD — анхдагч $15 */
export function benchBudget(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.BENCH_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

export interface CostEstimate {
  /** Хэдэн LLM дуудлага гарах вэ (модель + шүүгч) */
  calls: number;
  /** Ойролцоо зардал, USD */
  usd: number;
}

/**
 * Урьдчилсан тооцоо. Бодит үнэ моделиос хамаарах тул зөвхөн зэрэг нь —
 * логд хэвлээд хүн шийднэ.
 *
 * Дуудлага бүрт дундаж зардлыг бага, дунд гэж тооцохын оронд нэг дундаж авна:
 * даалгаврын дуудлага ~$0.004 (1200 token гаралт), шүүгчийнх ~$0.002.
 */
export const AVG_TASK_COST = 0.004;
export const AVG_JUDGE_COST = 0.002;

export function estimateCost(
  models: number,
  tasks: number,
  /** Хоёр дахь шүүгчээр дахин үнэлэгдэх моделийн тоо */
  selfJudged = 0,
): CostEstimate {
  const taskCalls = models * tasks;
  const judgeCalls = taskCalls + selfJudged * tasks;
  return {
    calls: taskCalls + judgeCalls,
    usd: Math.round((taskCalls * AVG_TASK_COST + judgeCalls * AVG_JUDGE_COST) * 100) / 100,
  };
}

/** Зарцуулсан нь төсвөөс хэтэрсэн эсэх */
export function overBudget(spent: number, budget: number): boolean {
  return spent >= budget;
}

/**
 * Дараагийн моделийг эхлүүлэх зай байна уу.
 *
 * Модель дундуур тасалбал тухайн моделийн дүн бүрэн бус болно — тиймээс
 * модель эхлэхийн өмнө бүтэн багц багтах эсэхийг шалгана.
 */
export function canStartModel(spent: number, budget: number, tasks: number): boolean {
  const need = tasks * (AVG_TASK_COST + AVG_JUDGE_COST);
  return spent + need <= budget;
}
