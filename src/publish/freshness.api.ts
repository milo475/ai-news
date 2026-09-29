/**
 * Нийтлэгдэх үеийн НАСНЫ тархалт — цэвэр хэсэг (DB-гүй, тесттэй).
 *
 * «Хуучирсан мэдээ» гэдэг нь босгын асуудал биш, ДАРААЛЛЫН асуудал: буферт
 * хуримтлагдсан өндөр оноотой хуучин ноорог шинэ мэдээг үргэлж хөөж байв.
 * Энэ модуль нь шинэ дүрмийг хуучин өгөгдөл дээр тоогоор харьцуулахад хэрэглэгдэнэ.
 */

/** Эрэмбэлэгдээгүй жагсаалтын p-квантиль (0–100). Хоосон бол null. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  // Хамгийн ойрын доод индекс — жижиг түүврт тайлбарлахад ойлгомжтой
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[i]! * 10) / 10;
}

export interface AgeStats {
  n: number;
  p50: number | null;
  p90: number | null;
  max: number | null;
  /** Хугацаа хамаарахгүй (HOWTO/FACT) тул наснаас хамаарахгүй нийтлэлийн тоо */
  timeless: number;
}

export function ageStats(hours: number[], timeless = 0): AgeStats {
  return {
    n: hours.length,
    p50: percentile(hours, 50),
    p90: percentile(hours, 90),
    max: hours.length ? Math.round(Math.max(...hours) * 10) / 10 : null,
    timeless,
  };
}

/** Зорилт: p50 < 24ц, p90 < 72ц */
export const TARGET_P50_H = 24;
export const TARGET_P90_H = 72;

export interface TargetVerdict {
  met: boolean;
  /** Зорилтод хүрсэн бол NEWS_MAX_AGE_H-ийг үүн рүү буулгаж болно */
  recommendedMaxAgeH: number | null;
  detail: string;
}

/**
 * Зорилтод хүрсэн эсэх.
 *
 * Хүрсэн бол л `NEWS_MAX_AGE_H`-ийг 72 болгоно: босгыг эхлээд буулгаад дараалал
 * нь хэвээр байвал гаралтын 30–47 хувь нь шууд хаагдана — уншигчид мэдээ
 * багасахаас өөр өөрчлөлт мэдрэгдэхгүй.
 */
export function checkTarget(s: AgeStats): TargetVerdict {
  if (s.p50 === null || s.p90 === null) {
    return { met: false, recommendedMaxAgeH: null, detail: "өгөгдөл хүрэлцэхгүй" };
  }
  const met = s.p50 < TARGET_P50_H && s.p90 < TARGET_P90_H;
  return {
    met,
    recommendedMaxAgeH: met ? TARGET_P90_H : null,
    detail: met
      ? `p50 ${s.p50}ц < ${TARGET_P50_H}ц, p90 ${s.p90}ц < ${TARGET_P90_H}ц — NEWS_MAX_AGE_H=${TARGET_P90_H} болгож болно`
      : `p50 ${s.p50}ц (зорилт <${TARGET_P50_H}), p90 ${s.p90}ц (зорилт <${TARGET_P90_H}) — босгыг хэвээр үлдээнэ`,
  };
}
