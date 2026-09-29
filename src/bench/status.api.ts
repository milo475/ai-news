/**
 * Бенчмаркийн төлөв — «хэмжигдсэн» гэж үзэх дүрэм (цэвэр, тесттэй).
 *
 * 2026-09-28-ны алдаа: pipeline-ийн bench алхам `status !== "RUNNING"` гэж
 * шалгадаг болсноос **FAILED** run-ыг ч «аль хэдийн хэмжигдсэн» гэж үзэж байв.
 * Тиймээс cron бүр алгасаж, /benchmark нь хоосон хэвээр үлдсэн (FAILED run-д
 * дүгнэлт байхгүй, нийтийн query нь DONE/BUDGET шаарддаг).
 */

export type BenchStatus = "RUNNING" | "DONE" | "BUDGET" | "FAILED";

/** Хэмжилт БҮРЭН дууссан гэж үзэх төлвүүд — зөвхөн эдгээр нь дахин ажиллуулахыг хориглоно */
export const MEASURED: BenchStatus[] = ["DONE", "BUDGET"];

export function isMeasured(status: string | null | undefined): boolean {
  return MEASURED.includes(status as BenchStatus);
}

/** Унасан run-ыг хэдэн цагийн дараа дахин оролдох вэ */
export const RETRY_AFTER_HOURS = 6;

export type SkipReason =
  | "хэмжигдсэн"
  | "унасан — хүлээж байна"
  | "сарын 1 биш"
  | "өглөөний цаг болоогүй"
  | null;

export interface StartDecision {
  /** Ажиллуулах уу */
  go: boolean;
  /** Дуусаагүй run-ыг үргэлжлүүлж байна уу */
  resume: boolean;
  skip: SkipReason;
  detail: string;
}

/**
 * Bench эхлэх/үргэлжлэх эсэх.
 *
 * · RUNNING  → үргэлжлүүлнэ (өдөр, цагаас үл хамааран — хэсэгчилсэн run).
 * · DONE/BUDGET → энэ сар хэмжигдсэн, алгасна.
 * · FAILED   → 6 цагийн дараа дахин оролдоно (cron бүр давтахгүй).
 * · Run байхгүй → сарын 1-нд, өглөөний цагаас хойш эхэлнэ.
 */
export function decideStart(a: {
  status: string | null;
  finishedAt: Date | null;
  now: Date;
  /** УБ сарын өдөр */
  day: number;
  ubHour: number;
  dailyHour: number;
  /** `--only bench` гэж гараар дуудсан эсэх */
  manual?: boolean;
  retryHours?: number;
}): StartDecision {
  if (a.status === "RUNNING") {
    return { go: true, resume: true, skip: null, detail: "дуусаагүй run үргэлжилнэ" };
  }
  if (isMeasured(a.status)) {
    return { go: false, resume: false, skip: "хэмжигдсэн", detail: `төлөв ${a.status}` };
  }

  if (a.status === "FAILED") {
    const hours = a.retryHours ?? RETRY_AFTER_HOURS;
    const since = a.finishedAt ? (a.now.getTime() - a.finishedAt.getTime()) / 3_600_000 : Infinity;
    if (!a.manual && since < hours) {
      return {
        go: false, resume: false, skip: "унасан — хүлээж байна",
        detail: `${Math.round(since * 10) / 10}ц өмнө унасан, ${hours}ц-ийн дараа дахин оролдоно`,
      };
    }
    // Хугацаа өнгөрсөн — дахин оролдоно (сарын 1-ийн шалгалт хамаарахгүй:
    // унасан хэмжилтийг сар дуустал орхих нь /benchmark-ыг хоосон үлдээнэ)
    return { go: true, resume: false, skip: null, detail: "унасан run-ыг дахин эхлүүлнэ" };
  }

  if (a.manual) return { go: true, resume: false, skip: null, detail: "гараар дуудсан" };
  if (a.day !== 1) {
    return { go: false, resume: false, skip: "сарын 1 биш", detail: `өнөөдөр ${a.day}` };
  }
  if (a.ubHour < a.dailyHour) {
    return {
      go: false, resume: false, skip: "өглөөний цаг болоогүй",
      detail: `УБ ${a.ubHour}:00 < ${a.dailyHour}:00`,
    };
  }
  return { go: true, resume: false, skip: null, detail: "сарын шинэ хэмжилт" };
}
