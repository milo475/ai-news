/**
 * LLM зардлын бүртгэл — ажил бүр ЗӨВХӨН өөрийн дуудлагыг тоолно.
 *
 * Модуль түвшний нэг тоолуур байсан нь зэрэг ажиллаж буй ажлуудыг холиж байв:
 * вэб процесст студийн дуудлага явж байхад `withJob`-оор ороосон ажил түүнийг
 * өөрийн зардал гэж тоолж, StudioUsage ба JobRun-д ДАВХАР бичигдэж, DAILY_LLM_USD
 * эрт тасалдаг байсан. `AsyncLocalStorage` нь дуудлагыг эхлүүлсэн ажлынх нь
 * хүрээнд л бүртгэнэ.
 *
 * Бүртгэл нь ХЭЗЭЭ Ч throw хийхгүй — зардал тоолох нь ажлыг унагаах шалтгаан биш.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { addCall, emptyLedger, since, type Ledger } from "./spend.api";

interface Scope {
  ledger: Ledger;
}

const storage = new AsyncLocalStorage<Scope>();

/** Процессын нийт — хүрээнээс гадуурх дуудлага ч энд орно */
let processTotal: Ledger = emptyLedger();

/**
 * `llm.ts` дуудлага бүрийн дараа дууддаг.
 * Хүрээ (ажил) идэвхтэй бол түүнд, мөн процессын нийтэд нэмнэ.
 */
export function recordCall(usd: number): void {
  try {
    processTotal = addCall(processTotal, usd);
    const scope = storage.getStore();
    if (scope) scope.ledger = addCall(scope.ledger, usd);
  } catch {
    // Бүртгэл унах нь дуудлагыг унагаах ёсгүй
  }
}

/**
 * Ажлыг өөрийн хүрээнд ажиллуулна. Дотор нь гарсан LLM дуудлагууд ЗӨВХӨН энэ
 * ажлын тоолуурт орно — зэрэг явж буй өөр ажлын дуудлага холилдохгүй.
 */
export async function withScope<T>(fn: (spent: () => Ledger) => Promise<T>): Promise<T> {
  const scope: Scope = { ledger: emptyLedger() };
  return storage.run(scope, () => fn(() => scope.ledger));
}

/** Хүрээгүй дуудагчдад — процессын тоолуурын тэмдэг */
export function mark(): Ledger {
  return processTotal;
}

export function spentSince(m: Ledger): Ledger {
  return since(m, processTotal);
}

export function total(): Ledger {
  return processTotal;
}

/** Тестэд */
export function resetLedger(): void {
  processTotal = emptyLedger();
}
