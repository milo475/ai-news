/**
 * Монгол текстийг харьцуулах цэвэр туслахууд — гарчгийн давхцал, үгийн хуваалт.
 *
 * Тоймын давхардал (digest) ба нийтлэхийн өмнөх давхардлын шалгалт хоёулаа
 * эндээс уншина: нэг дүрэм, нэг тест.
 */

/** Утга багатай, бараг бүх гарчигт таарах үгс */
export const STOP_WORDS = new Set([
  "болон", "мөн", "гэж", "нь", "юм", "бол", "гэдэг", "тухай", "дээр", "доор", "энэ", "тэр",
  "шинэ", "том", "хэмээн", "байна", "болжээ", "болов", "the", "and", "for", "with", "new",
]);

/**
 * Гарчгийг харьцуулах боломжтой үг болгоно.
 * Монгол нөхцөлийг («Luna-г» → «luna») таслана — ижил нэр өөр үг болж тоологдохгүй.
 */
export function titleTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/-[\p{Script=Cyrillic}]+$/u, "").replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

export function sharedCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/**
 * Монгол үгийн бүдүүвч үндэс — эхний N тэмдэгт.
 *
 * Монгол хэл нөхцөлөөр маш их хувирдаг: «сургалтаа» ба «сургалтыг», «зогсоов» ба
 * «зогсоолоо» нь нэг үг боловч мөр мөрөөрөө таарахгүй. 2026-09-28-нд хоёр нийтлэл
 * ИЛТ нэг үйл явдлын тухай атал Jaccard нь ердөө 0.19 гарсан. Эхний 5 тэмдэгтээр
 * таслахад «сурга», «зогсо» болж таарна.
 */
export const STEM_CHARS = 5;

export function stem(word: string, chars = STEM_CHARS): string {
  return word.length <= chars ? word : word.slice(0, chars);
}

/** Үндэслэсэн үгийн олонлог — өөр нөхцөлтэй ижил үг нэг болж таарна */
export function stemTokens(text: string, chars = STEM_CHARS): Set<string> {
  return new Set([...titleTokens(text)].map((w) => stem(w, chars)));
}
