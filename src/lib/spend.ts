/**
 * Процессын LLM зардлын бүртгэл — `llm.ts` дуудлага бүрээс автоматаар нэмнэ.
 *
 * Энэ нь процессын дотоод тоолуур: алхам эхлэхдээ `mark()` аваад, дуусахдаа
 * `spentSince(mark)` гэж асууна. Ингэснээр алхам нь зардлаа «мартах» боломжгүй —
 * унасан үед ч тоолуур нь хэвээр байна.
 */
import { addCall, emptyLedger, since, type Ledger } from "./spend.api";

let ledger: Ledger = emptyLedger();

/** `llm.ts` дуудлага бүрийн дараа дууддаг */
export function recordCall(usd: number): void {
  ledger = addCall(ledger, usd);
}

/** Одоогийн байдал — алхмын эхэнд авна */
export function mark(): Ledger {
  return ledger;
}

/** Тэмдэглэснээс хойшхи зарцуулалт */
export function spentSince(m: Ledger): Ledger {
  return since(m, ledger);
}

/** Процессын нийт */
export function total(): Ledger {
  return ledger;
}

/** Тестэд */
export function resetLedger(): void {
  ledger = emptyLedger();
}
