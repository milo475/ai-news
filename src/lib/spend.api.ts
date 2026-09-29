/**
 * LLM зардлын ТӨВ бүртгэл (цэвэр хэсэг).
 *
 * Яагаад: зардлыг дуудлага бүрийн газраас гараар цуглуулж JobRun-д бичдэг
 * байсан нь найдваргүй байв — 2026-09-28-ны бенчмарк 195 үр дүн бичсэн атал
 * $0.029 гэж бүртгэгдсэн (унасан замд `costUsd` огт бичигдээгүй), cost:report
 * «50 удаа ажилласан ч $0» гэж барьсан. Бүртгэл дутуу бол DAILY_LLM_USD ба
 * BENCH_BUDGET_USD хоёулаа утгагүй болно.
 *
 * Одоо зардлыг `llm.ts` дотор, дуудлага бүрээс АВТОМАТААР бүртгэнэ. Алхам нь
 * зөвхөн «эндээс эхлээд хэд зарцуулав» гэж асууна.
 */

export interface Ledger {
  /** Нийт зарцуулсан, USD */
  usd: number;
  /** Хэдэн дуудлага */
  calls: number;
  /** Зардал нь тэг ирсэн дуудлага — provider тайлагнаагүй байж болно */
  zeroCost: number;
}

export function emptyLedger(): Ledger {
  return { usd: 0, calls: 0, zeroCost: 0 };
}

export function addCall(l: Ledger, usd: number): Ledger {
  return {
    usd: l.usd + (Number.isFinite(usd) && usd > 0 ? usd : 0),
    calls: l.calls + 1,
    zeroCost: l.zeroCost + (usd > 0 ? 0 : 1),
  };
}

/** Хоёр агшны зөрүү — «энэ алхам хэд зарцуулав» */
export function since(before: Ledger, after: Ledger): Ledger {
  return {
    usd: Math.round((after.usd - before.usd) * 1e6) / 1e6,
    calls: after.calls - before.calls,
    zeroCost: after.zeroCost - before.zeroCost,
  };
}

// ---------- Бүртгэгдсэнийг бодиттой харьцуулах ----------

/** Зөрүү үүнээс их бол ⚠ — бүртгэл дутуу гэсэн үг */
export const DRIFT_WARN_RATIO = 0.2;

export interface Drift {
  recorded: number;
  actual: number;
  /** actual − recorded */
  diff: number;
  /** Зөрүүний харьцаа (бодитой харьцуулсан) */
  ratio: number;
  ok: boolean;
}

/**
 * Бүртгэгдсэн ба бодит зарцуулалтын зөрүү.
 *
 * `actual` нь OpenRouter-ийн `/api/v1/key` → `usage_daily` — тухайн түлхүүрийн
 * өнөөдрийн бодит зарцуулалт. Үлдэгдлийн бууралтаас найдвартай: цэнэглэлт,
 * буцаалт нь үлдэгдлийг хөдөлгөдөг ч зарцуулалтыг хөдөлгөхгүй.
 */
export function drift(recorded: number, actual: number | null): Drift | null {
  if (actual === null || actual <= 0) return null;
  const diff = Math.round((actual - recorded) * 1e6) / 1e6;
  const ratio = Math.abs(diff) / actual;
  return {
    recorded: Math.round(recorded * 1e6) / 1e6,
    actual,
    diff,
    ratio: Math.round(ratio * 1000) / 1000,
    ok: ratio <= DRIFT_WARN_RATIO,
  };
}

export function driftMessage(d: Drift | null): string | null {
  if (!d || d.ok) return null;
  const pct = Math.round(d.ratio * 100);
  return d.diff > 0
    ? `Зардлын бүртгэл дутуу: бүртгэгдсэн $${d.recorded.toFixed(3)}, бодит $${d.actual.toFixed(3)} ` +
      `(${pct}% зөрүү) — зарим алхам зардлаа бүртгэхгүй байна.`
    : `Зардлын бүртгэл ИЛҮҮ: бүртгэгдсэн $${d.recorded.toFixed(3)}, бодит $${d.actual.toFixed(3)} ` +
      `(${pct}% зөрүү) — давхар тоолж байж магадгүй.`;
}
