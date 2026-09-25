/**
 * Зааврын markdown-ыг задлах цэвэр функцууд (DB, React-гүй тул тесттэй).
 *
 * bodyMd-ийн гэрээ:
 *   ## <алхам>          — TOC-д орох гарчиг, JSON-LD HowTo-ийн алхам
 *   ```prompt … ```     — хуулж болох prompt (вэб дээр <PromptBox> болж рендерлэгдэнэ)
 */
import { slugify } from "../agent/slug";

export interface TocItem {
  /** Гарчиг дээрх id — # холбоос */
  id: string;
  text: string;
}

export interface HowToStep extends TocItem {
  /** Тухайн h2-ын доорх текст, prompt блокгүй */
  text: string;
  body: string;
}

/** Гарчгаас тогтвортой id — Markdown ба TOC хоёр ижил дүрмээр тооцно */
export function headingId(text: string): string {
  return slugify(text.trim()) || "alkham";
}

/** ```-ээр хашсан блокуудыг алгасч мөр бүрийг дамжуулна */
function eachLineOutsideFence(md: string, fn: (line: string) => void): void {
  let inFence = false;
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) fn(line);
  }
}

/** h2-уудаас агуулга (TOC). Давхардсан гарчигт -2, -3 залгана. */
export function tocFromMarkdown(md: string): TocItem[] {
  const items: TocItem[] = [];
  const used = new Map<string, number>();
  eachLineOutsideFence(md, (line) => {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) return;
    const text = m[1]!.replace(/[*_`]/g, "").trim();
    if (!text) return;
    const base = headingId(text);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    items.push({ id: n === 1 ? base : `${base}-${n}`, text });
  });
  return items;
}

/** ```prompt ... ``` блокуудын агуулга */
export function promptBlocks(md: string): string[] {
  const out: string[] = [];
  const re = /^[ \t]*```[ \t]*prompt[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gmu;
  for (const m of md.matchAll(re)) {
    const body = m[1]!.replace(/\s+$/, "");
    if (body.trim()) out.push(body);
  }
  return out;
}

/** JSON-LD HowTo-д зориулж алхам бүрийн гарчиг + текст */
export function howToSteps(md: string): HowToStep[] {
  const toc = tocFromMarkdown(md);
  if (toc.length === 0) return [];

  // Гарчиг бүрийн эхлэх мөрийг олоод завсрын текстийг авна
  const lines = md.split("\n");
  const starts: number[] = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    else if (!inFence && /^##\s+\S/.test(line)) starts.push(i);
  });

  return toc.map((item, i) => {
    const from = starts[i]! + 1;
    const to = starts[i + 1] ?? lines.length;
    const body = lines
      .slice(from, to)
      .join("\n")
      // Prompt блокийг алхмын тайлбараас хасна — JSON-LD-д цэвэр өгүүлбэр л хэрэгтэй
      .replace(/^[ \t]*```[\s\S]*?^[ \t]*```[ \t]*$/gmu, "")
      .replace(/[*_`#>]/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return { ...item, body };
  });
}

/** Уншихад ойролцоогоор хэдэн минут (монгол текст ~180 үг/мин) */
export const WORDS_PER_MINUTE = 180;

export function readMinutes(md: string): number {
  const words = md.replace(/```[\s\S]*?```/g, " ").split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
