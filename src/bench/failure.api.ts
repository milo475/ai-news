/**
 * Бенчмаркийн алдааны ангилал — «модель муу» ба «дэд бүтэц унасан»-ыг ялгана.
 *
 * 2026-09-27-ны production: run дундуур OpenRouter-ийн кредит дуусахад 402-ууд
 * «модель хариу өгсөнгүй» гэж бүртгэгдэж, 0 оноо болж дундажид орсон. /benchmark
 * дээр Claude Opus 5 0.26, DeepSeek V4.1 Flash 0.23, GLM 5.3 Flash 0.27 гэсэн
 * ХУУРАМЧ оноо нийтэд гарсан. Дэд бүтцийн алдааг моделийн буруу гэж бичих ёсгүй.
 */

export type ErrorKind = "infra" | "model";

/** Дэд бүтцийн алдааны шинжүүд — HTTP статус болон сүлжээний алдаа */
const INFRA_PATTERNS: RegExp[] = [
  /\b(401|402|403|429)\b/,
  /\b5\d\d\b/,
  /insufficient credits|in-?flight|can only afford|rate limit|quota/i,
  /timeout|timed out|aborted|abort|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed/i,
  /данс дууссан|үлдэгдэл хүрэлцэхгүй|түлхүүр буруу/,
];

/**
 * Алдааны бичвэрээс ангиллыг таана.
 *
 * Эргэлзээтэй бол **infra** — моделийг шударга бусаар 0 оноо өгөхөөс, оноогүй
 * үлдээх нь дээр. Буруу 0 нь нийтэд гарч, буруу оноогүй нь зөвхөн дутуу мэдээлэл.
 */
export function classifyError(message: string | null | undefined): ErrorKind {
  const m = (message ?? "").trim();
  if (!m) return "model";
  return INFRA_PATTERNS.some((re) => re.test(m)) ? "infra" : "model";
}

export function isInfraError(message: string | null | undefined): boolean {
  return classifyError(message) === "infra";
}

/** Дэд бүтцийн алдааг хэдэн удаа дахин оролдох вэ */
export const INFRA_RETRIES = 1;

// ---------- Бүрэн бүтэн байдал ----------

/**
 * BenchModelSummary бичигдэхэд шаардагдах хамгийн бага хувь.
 *
 * Даалгаврын 90%-д хариу БА оноо байх ёстой. Үүнээс доош бол дундаж нь тухайн
 * моделийг төлөөлөхгүй — «дутуу» гэж тэмдэглээд нийтэд харуулахгүй.
 */
export const MIN_COMPLETE_RATIO = 0.9;

export interface Completeness {
  /** Нийт даалгавар */
  total: number;
  /** Хариу ирсэн (моделийн бодит алдаагүй, infra-гүй) */
  answered: number;
  /** Оноо гарсан (шүүгч ажилласан эсвэл checker шийдсэн) */
  scored: number;
  /** Дэд бүтцийн алдаанаас болж хасагдсан */
  infra: number;
  /** Шүүгч ажиллаагүйгээс оноогүй үлдсэн */
  unjudged: number;
  ratio: number;
  ok: boolean;
}

export interface CountableResult {
  error?: string | null;
  errorKind?: string | null;
  /** null = оноогүй (шүүгч унасан эсвэл infra) */
  score?: number | null;
}

/**
 * Нэг моделийн бүрэн бүтэн байдлыг тоолно.
 *
 * `infra` нь хуваарийн ХАСАГДАНА: сүлжээ унасан нь моделийн буруу биш тул
 * түүнийг «дутуу» гэж буруутгах нь бас шударга бус. Хэрэв бүгд infra бол
 * ratio = 0 болж дүгнэлт бичигдэхгүй (өгөгдөл огт байхгүй).
 */
export function completeness(rows: CountableResult[]): Completeness {
  const total = rows.length;
  const infra = rows.filter((r) => r.errorKind === "infra").length;
  const usable = rows.filter((r) => r.errorKind !== "infra");
  const answered = usable.filter((r) => !r.error).length;
  const scored = usable.filter((r) => typeof r.score === "number").length;
  const unjudged = usable.filter((r) => !r.error && r.score === null).length;

  const denom = total - infra;
  // ХАРИУ БА ОНОО хоёулаа 90%-д хүрэх ёстой. Зөвхөн оноогоор шалгавал бүх
  // даалгавартаа унасан модель «бүгд 0 оноотой» гэж бүтэн тооцогдоно.
  const ratio = denom > 0 ? Math.min(answered, scored) / denom : 0;
  return {
    total, answered, scored, infra, unjudged,
    ratio: Math.round(ratio * 1000) / 1000,
    // Дэд бүтэц бүх даалгаврыг идсэн бол дүгнэх өгөгдөл алга
    ok: denom > 0 && ratio >= MIN_COMPLETE_RATIO,
  };
}

/** Логд нэг мөрөөр */
export function completenessLabel(c: Completeness): string {
  const parts = [`${c.scored}/${c.total - c.infra} оноотой`];
  if (c.infra) parts.push(`${c.infra} дэд бүтцийн алдаа`);
  if (c.unjudged) parts.push(`${c.unjudged} шүүгчгүй`);
  return parts.join(", ");
}
