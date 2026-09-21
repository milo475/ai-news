/**
 * LMArena-ийн нэрийг OpenRouter каталогийн slug-тай гараар тааруулах хүснэгт.
 *
 * `normalizeModelName()` автоматаар таарахгүй нэрсийг л энд бичнэ. Энд бичээгүй нэр
 * `arenaOnly` модель болж каталогт шинээр үүснэ — өөрөөр хэлбэл alias нь "давхардлаас
 * сэргийлэх" зориулалттай.
 *
 * Түлхүүр нь **normalize хийсэн** Arena нэр (`npm run fetch:arena` логоос хуулж авна),
 * утга нь OpenRouter-ийн бүтэн slug.
 */
export const MODEL_ALIASES: Record<string, string> = {
  // "-medium" нь бодох хүчийг заасан суффикс, загварын нэрийн хэсэг биш
  gemini35flashmedium: "google/gemini-3.5-flash",
  // Arena "mistral-medium-2508" = 2025-08 хувилбар → каталогийн Medium 3.1 (2025-08-13)
  mistralmedium: "mistralai/mistral-medium-3.1",
};

/**
 * Arena-гийн `organization` → каталогийн `Company.slug`.
 * OpenRouter компанийн slug-ийг моделийн id-гийн угтвараас авдаг тул Arena-гийнхаас
 * ялгаатай байдаг ("xai" vs "x-ai"). Энд бичихгүй бол компани давхардаж үүснэ.
 */
export const COMPANY_ALIASES: Record<string, string> = {
  xai: "x-ai",
  mistral: "mistralai",
  alibaba: "qwen",
};
