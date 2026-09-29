/**
 * Мэргэжлийн загваруудыг диск дээрээс уншина (LLM дуудлагагүй).
 *
 * `src/studio/personas.json` нь репо дотор байдаг тул build-ийн үед ч, ажиллах
 * үед ч уншигдана — SSG-д тохиромжтой.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Persona } from "./personas.api";

let cache: Persona[] | null = null;

export function personas(): Persona[] {
  if (cache) return cache;
  try {
    const text = readFileSync(join(process.cwd(), "src", "studio", "personas.json"), "utf8");
    cache = JSON.parse(text) as Persona[];
  } catch (e) {
    console.warn(`  ⚠ мэргэжлийн загвар уншигдсангүй: ${(e as Error).message.slice(0, 100)}`);
    cache = [];
  }
  return cache;
}

/** Тестэд */
export function clearPersonaCache(): void {
  cache = null;
}
