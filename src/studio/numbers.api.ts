/**
 * Гаргалтад гарсан ТОО бүр мэдлэгийн сангаас гарсан эсэхийг шалгана.
 *
 * Яагаад: студи «Kling өдөрт 120 кредит өгдөг», «Runway 4 секунд хүртэл» гэх мэт
 * ЗОХИОМОЛ тоо бичвэл хэрэглэгч тэр тоонд итгэж ажлаа төлөвлөнө. Мэдлэгийн сан
 * (tools/*.md) нь баримт бичгээс шалгаж бичсэн цорын ганц эх сурвалж — тооны
 * баталгаа зөвхөн тэндээс гарна.
 */

/**
 * Жижиг тоо нь ихэвчлэн зааврын хэсэг («3 алхам», «2 хувилбар») тул шалгахгүй —
 * ГЭХДЭЭ зөвхөн ЗӨӨЛӨН нэгжтэй үед. Кредит, секунд, хувь, доллар зэрэг ХАТУУ
 * нэгжийн ард ямар ч тоо баталгаатай байх ёстой: «4 секундын клип» гэдэг нь
 * Kling дээр буруу (5–10 секунд) бөгөөд хэрэглэгч тэр тоогоор төлөвлөнө.
 */
const SMALL = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

/** Эдгээр нэгжийн ард гарсан тоо ҮРГЭЛЖ баталгаажих ёстой */
const HARD_UNITS = new Set([
  "кредит", "секунд", "сек", "минут", "цаг", "хувь", "%", "$", "доллар",
  "төгрөг", "₮", "px", "p", "фпс", "fps", "мб", "mb", "гб", "gb", "токен",
]);

/** Харьцаа (4:5), огноо (2026-09-27), алхмын дугаар — тоон мэдэгдэл биш */
const SKIP_PATTERNS = [
  /^\d{1,2}:\d{1,2}$/,           // 16:9, 4:5
  /^\d{4}-\d{2}-\d{2}$/,         // огноо
  /^\d{3,4}x\d{3,4}$/i,          // 1080x1350
  /^\d+(\.\d+)?$/,               // цэвэр тоо — доор COMMON-оор шүүнэ
];

/**
 * Текстээс «тоон мэдэгдэл» гаргана.
 *
 * Зөвхөн ХЭМЖЭЭ илэрхийлсэн тоог авна: нэгж дагасан (кредит, секунд, %, $, px, p,
 * МБ) эсвэл хоёроос олон оронтой. Алхмын дугаар, харьцаа, огноог алгасна.
 */
const CLAIM = /(\d[\d\s.,]*)\s*(кредит|секунд|сек\b|минут|цаг\b|хувь|%|\$|доллар|төгрөг|₮|px|p\b|фпс|fps|мб|mb|гб|gb|видео|зураг|клип|токен|удаа)/giu;

export interface NumberClaim {
  /** Тоо, цэвэрлэсэн хэлбэрээр ("66") */
  value: string;
  /** Нэгж ("кредит") */
  unit: string;
  /** Бүтэн хэллэг ("66 кредит") */
  text: string;
}

/** Мөнгөн тэмдэгт нь тооны ӨМНӨ байдаг: «$10», «₮15000» */
const CURRENCY = /([$₮])\s*(\d[\d\s.,]*)/gu;

export function extractClaims(text: string): NumberClaim[] {
  const out: NumberClaim[] = [];
  for (const m of text.matchAll(CURRENCY)) {
    const value = (m[2] ?? "").replace(/[\s,]/g, "").replace(/\.$/, "");
    if (value) out.push({ value, unit: m[1]!, text: `${m[1]}${value}` });
  }
  for (const m of text.matchAll(CLAIM)) {
    const value = (m[1] ?? "").replace(/[\s,]/g, "").replace(/\.$/, "");
    const unit = (m[2] ?? "").toLowerCase();
    if (!value) continue;
    if (SKIP_PATTERNS.some((re) => re.test(m[0].trim()))) continue;
    out.push({ value, unit, text: `${value} ${unit}`.trim() });
  }
  return out;
}

/** Мэдлэгийн сангийн файлд байгаа бүх тоо */
export function docNumbers(doc: string): Set<string> {
  const out = new Set<string>();
  for (const m of doc.matchAll(/\d[\d\s.,]*/g)) {
    const v = m[0].replace(/[\s,]/g, "").replace(/\.$/, "");
    if (v) out.add(v);
  }
  return out;
}

/** Лавлахад байхгүй тоон мэдэгдлүүд */
export function unverifiedClaims(text: string, doc: string): NumberClaim[] {
  const known = docNumbers(doc);
  return extractClaims(text).filter((c) => {
    if (known.has(c.value)) return false;
    // Зөөлөн нэгжтэй жижиг тоог алгасна («3 алхам»), хатуу нэгжтэйг үгүй
    return HARD_UNITS.has(c.unit) || !SMALL.has(c.value);
  });
}

/** Баталгаажаагүй тоог орлуулах хэллэг */
export const CHECK_OFFICIAL = "одоогийн хязгаарыг албан ёсны сайтаас шалгана уу";

/**
 * Баталгаажаагүй тоог хасна.
 *
 * «Өдөрт 120 кредит өгдөг» → «Өдөрт (одоогийн хязгаарыг албан ёсны сайтаас
 * шалгана уу) өгдөг». Хэсгийг бүхэлд нь дахин үүсгэхээс хямд бөгөөд хэрэглэгч
 * юу мэдэхгүй байгааг ил хардаг.
 */
export function stripUnverified(text: string, doc: string): { text: string; removed: NumberClaim[] } {
  const bad = unverifiedClaims(text, doc);
  if (bad.length === 0) return { text, removed: [] };

  let out = text;
  for (const c of bad) {
    const re = new RegExp(`${escapeRe(c.value)}\\s*${escapeRe(c.unit)}`, "giu");
    out = out.replace(re, `(${CHECK_OFFICIAL})`);
  }
  return { text: out, removed: bad };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Хэрэгслийн файлын «сүүлд шалгасан» огноо */
const CHECKED = /Сүүлд шалгасан:\s*(\d{4}-\d{2}-\d{2})/u;

export function checkedDate(doc: string): string | null {
  return CHECKED.exec(doc)?.[1] ?? null;
}

/** Энэ хоногоос хуучин бол /admin-д ⚠ */
export const STALE_DAYS = 60;

export function daysSince(date: string, now: Date): number {
  const then = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export function isStaleDoc(date: string | null, now: Date, days = STALE_DAYS): boolean {
  if (!date) return true;
  return daysSince(date, now) > days;
}
