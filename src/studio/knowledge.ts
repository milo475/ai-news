/**
 * Мэдлэгийн сан унших — src/studio/*.md.
 *
 * Файлууд нь репо дотор байдаг (standalone build биш, `next start` нь репог хэвээр
 * ажиллуулна). Нэг уншаад санах ойд хадгална — хуудас бүрт дискнээс уншихгүй.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkedDate } from "./numbers.api";
import { TOOLS } from "./studio.api";

const cache = new Map<string, string>();

function read(rel: string): string {
  const hit = cache.get(rel);
  if (hit !== undefined) return hit;
  try {
    const text = readFileSync(join(process.cwd(), "src", "studio", rel), "utf8");
    cache.set(rel, text);
    return text;
  } catch {
    // Файл алга бол студи унтрахгүй — тухайн лавлах л дутна
    console.warn(`  ⚠ студийн лавлах уншигдсангүй: ${rel}`);
    cache.set(rel, "");
    return "";
  }
}

/** Промпт бичих ерөнхий лавлах */
export function craftDoc(): string {
  return read("craft.md");
}

/** Монгол орчны лавлах */
export function mongolDoc(): string {
  return read("mongol.md");
}

/**
 * Бүтээлч зарчим — ЗӨВХӨН зар, маркетинг, брэндийн хүсэлтэд.
 * Бусад хүсэлтэд оруулбал токен дэмий зарцуулна.
 */
export function ideasDoc(): string {
  return read("ideas.md");
}

/** Хүсэлт нь маркетингийнх мөн үү */
const MARKETING = /(зар\b|зар\s|сурталчилга|маркетинг|брэнд|борлуулалт|кампанит|хямдрал|урамшуулал|худалдан авалт|хэрэглэгч татах|ad\b|ads\b|campaign)/iu;

export function isMarketing(text: string): boolean {
  return MARKETING.test(text);
}

/**
 * Сонгосон хэрэгслүүдийн лавлах — ЗӨВХӨН сонгосныг нь.
 * Бүх 13 файлыг оруулбал нэг дуудлагад ~8000 токен дэмий зарцуулна.
 */
export function toolDocs(docs: string[]): Record<string, string> {
  return Object.fromEntries(docs.map((d) => [d, read(join("tools", `${d}.md`))]));
}

/** Тест, скриптэд */
export function clearDocCache(): void {
  cache.clear();
}

/** Хэрэгслийн лавлах хэзээ шалгагдсан — UI-д «Мэдээлэл шалгасан: …» */
export function docCheckedDate(toolId: string): string | null {
  const tool = TOOLS.find((t) => t.id === toolId);
  if (!tool) return null;
  return checkedDate(read(join("tools", `${tool.doc}.md`)));
}
