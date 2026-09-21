/**
 * Монгол гарчгаас URL slug — цэвэр функц (DB-гүй).
 */

/** Кирилл → латин галиглал. "е" нь байрлалаас хамаарна (доор үз). */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", ж: "j", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "",
  ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const MAX_LEN = 60;

/** 60 тэмдэгтэд багтаана — үгийн дунд таслахгүй, сүүлийн "-"-ээр тасална */
function cut(slug: string): string {
  if (slug.length <= MAX_LEN) return slug;
  const head = slug.slice(0, MAX_LEN);
  const dash = head.lastIndexOf("-");
  return (dash > 0 ? head.slice(0, dash) : head).replace(/-+$/, "");
}

/** "OpenAI шинэ модель гаргалаа" → "openai-shine-model-gargalaa" */
export function slugify(titleMn: string): string {
  const lower = titleMn.toLowerCase();
  let latin = "";
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]!;
    if (ch === "е") {
      // Үгийн эхэнд "ye", үгийн дунд "e": "ерөнхийлөгч" → "yeronkhiilogch", "модель" → "model"
      const prev = lower[i - 1];
      latin += prev && /[\p{L}\p{N}]/u.test(prev) ? "e" : "ye";
      continue;
    }
    latin += TRANSLIT[ch] ?? ch;
  }
  return cut(latin.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
}
