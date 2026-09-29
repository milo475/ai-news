/**
 * Өдрийн LLM зардлын задаргаа ба нийт хязгаар (цэвэр хэсэг).
 *
 * 2026-09-28: OpenRouter-ийн үлдэгдэл 24 цагт ~$3.1 буурсан атал agent-ийн
 * төсөв ердөө $1.5 байв — зардал нь ОЛОН алхамд тархсан бөгөөд хаана хэдэн
 * доллар зарцуулагдсаныг харах газар байгаагүй. Одоо алхам бүрээр харагдана
 * ба нийт өдрийн хязгаар (DAILY_LLM_USD) нэмэгдсэн.
 */

/** Алхмын монгол нэр — /admin дээр харагдана */
export const STEP_LABEL: Record<string, string> = {
  agent: "Мэдээ боловсруулах",
  improve: "Бэлтгэх (текст, карт)",
  publish: "Нийтлэх (FB текст, карт)",
  digest: "Долоо хоногийн тойм",
  bench: "Бенчмарк",
  studio: "Промпт студи",
  "studio-promo": "Долоо хоногийн промпт",
  local: "Дотоодын мэдээ",
  instagram: "Instagram",
  newsletter: "Мэйл",
  insights: "Хүрэлтийн тоо",
  report: "Долоо хоногийн тайлан",
  rss: "RSS цуглуулах",
  openrouter: "Жагсаалт татах",
  arena: "Arena татах",
  html: "HTML татах",
  fbstats: "FB статистик",
  pipeline: "Pipeline (бүрхүүл)",
};

/** LLM зарцуулдаг алхмууд — бусад нь $0 байх ёстой */
export const LLM_STEPS = new Set([
  "agent", "improve", "publish", "digest", "bench", "studio", "studio-promo", "local",
]);

/**
 * ӨДРИЙН хязгаарт ОРОХГҮЙ алхмууд.
 *
 * Бенчмарк нь сард НЭГ удаа ~$4.20 зарцуулдаг тул $2.5-ын өдрийн хязгаарт
 * оруулбал 10/1-нд хязгаар хүрмэгц agent, improve, digest бүгд зогсож мэдээний
 * бэлтгэл тасарна. Дараа өдөр нь үлдсэнээ түрүүлж зарцуулж дахин тасална.
 *
 * Бенчмарк нь өөрийн ХОЁР хамгаалалттай тул давхар хязгаар шаардлагагүй:
 *   · BENCH_BUDGET_USD (анхдагч $15) — run дундуур зогсооно;
 *   · эхлэхийн өмнө «үлдэгдэл ≥ тооцоолсон зардлын 1.5 дахин» шалгалт.
 */
export const UNCAPPED_STEPS = new Set(["bench"]);

export function stepLabel(job: string): string {
  return STEP_LABEL[job] ?? job;
}

export interface StepCost {
  job: string;
  label: string;
  usd: number;
  runs: number;
  /** LLM зарцуулах ёстой алхам мөн үү */
  llm: boolean;
}

export interface DayCost {
  /** УБ огноо */
  day: string;
  /**
   * UTC өдрийн (00:00–24:00 UTC) нийлбэр — ЗӨВХӨН JobRun.
   *
   * OpenRouter-ийн `usage_daily` нь UTC өдрөөр тоологддог тул харьцуулалтад
   * үүнийг ашиглана. УБ өдрийн нийлбэртэй тулгавал 8 цагийн зөрүүнээс ХУДАЛ ⚠
   * гарна. `StudioUsage` нь цагийн тэмдэггүй (зөвхөн УБ огноо) тул энд орохгүй —
   * харьцуулалт нь студийн зардлаар дутуу гарахыг дуудагч мэдэж байх ёстой.
   */
  utcTotal: number;
  /** Бүх алхмын нийлбэр */
  total: number;
  /** ӨДРИЙН ХЯЗГААРТ тооцогдох нийлбэр (бенчмаркгүй) */
  capped: number;
  steps: StepCost[];
}

/** Өдрийн хязгаарт тооцогдох нийлбэр */
export function cappedTotal(steps: StepCost[]): number {
  return steps.filter((s) => !UNCAPPED_STEPS.has(s.job)).reduce((n, s) => n + s.usd, 0);
}

/** Зардлаар буурахаар эрэмбэлж, тэг зардалтайг ард нь */
export function sortSteps(steps: StepCost[]): StepCost[] {
  return [...steps].sort((a, b) => b.usd - a.usd || a.job.localeCompare(b.job));
}

/**
 * Зардал бүртгэгддэггүй LLM алхам — «$0.00» гэж харагдвал бүртгэл дутуу гэсэн үг.
 * Ажилласан ч тэг зардалтай алхмуудыг буцаана.
 */
export function unrecorded(steps: StepCost[]): string[] {
  return steps.filter((s) => s.llm && s.runs > 0 && s.usd === 0).map((s) => s.job);
}

// ---------- Өдрийн хязгаар ----------

/** DAILY_LLM_USD — бүх алхмын нийлбэр дээд хязгаар */
export const DEFAULT_DAILY_LLM_USD = 2.5;

export function dailyLlmBudget(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.DAILY_LLM_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_LLM_USD;
}

/** Өнөөдрийн нийт зардал хязгаарт хүрсэн үү */
export function overDailyLimit(spentUsd: number, budget: number): boolean {
  return spentUsd >= budget;
}

/** Хязгаарын ойролцоо байгааг анхааруулах босго (80%) */
export const WARN_RATIO = 0.8;

export function nearDailyLimit(spentUsd: number, budget: number): boolean {
  return !overDailyLimit(spentUsd, budget) && spentUsd >= budget * WARN_RATIO;
}

export function limitMessage(spentUsd: number, budget: number): string | null {
  if (overDailyLimit(spentUsd, budget)) {
    return `Өдрийн LLM хязгаар дүүрлээ: $${spentUsd.toFixed(2)}/$${budget.toFixed(2)} — ` +
      "маргааш хүртэл нийтлэхээс бусад LLM алхам зогсоно (бенчмарк хамаарахгүй).";
  }
  if (nearDailyLimit(spentUsd, budget)) {
    return `Өдрийн LLM зардал $${spentUsd.toFixed(2)}/$${budget.toFixed(2)} — хязгаарт ойрхон.`;
  }
  return null;
}


// ---------- Харьцуулалтын цонх, шошго ----------

/**
 * OpenRouter-ийн `/api/v1/key` талбаруудын утга (баримтаас шалгасан):
 *   usage_daily   — одоогийн UTC ӨДӨР
 *   usage_weekly  — одоогийн UTC долоо хоног, ДАВААГААС эхэлнэ
 *   usage_monthly — одоогийн UTC САР
 */
export const USAGE_LABEL = {
  daily: "өнөөдөр (UTC)",
  weekly: "энэ долоо хоног (даваагаас, UTC)",
  monthly: "энэ сар (UTC)",
} as const;

/**
 * Локал хөгжүүлэлтийн DB мөн үү.
 *
 * Локал DB нь production-ийн ажлуудыг агуулдаггүй тул OpenRouter-ийн бодит
 * зарцуулалттай харьцуулах нь утгагүй — ямагт 100% зөрүү гарна.
 */
export function isLocalDb(url = process.env.DATABASE_URL ?? ""): boolean {
  return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || url.startsWith("file:");
}
