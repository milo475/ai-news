/**
 * LMArena-ийн нэрийг OpenRouter каталогийн slug-тай гараар тааруулах хүснэгт.
 *
 * `normalizeModelName()` автоматаар таарахгүй нэрсийг л энд бичнэ.
 * Түлхүүр нь **normalize хийсэн** Arena нэр (`npm run fetch:arena` логоос хуулж авна),
 * утга нь OpenRouter-ийн бүтэн slug.
 *
 * Жишээ:
 *   "gemini3pro": "google/gemini-3-pro",
 *   "ernie50": "baidu/ernie-5.0",
 */
export const MODEL_ALIASES: Record<string, string> = {
  // Каталогт байхгүй загваруудыг энд нэмэх шаардлагагүй — таарсан нь л snapshot авна.
};
