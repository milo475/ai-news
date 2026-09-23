/**
 * Өдрийн нийтлэлийн квот — DRAFT-уудаас хэдийг нь нийтлэхийг сонгох цэвэр логик (DB-гүй, тесттэй).
 *
 * Дүрэм:
 *   1. Оноо өндөрөөс нь эхэлнэ (тэнцвэл эх сурвалжийн шинэ мэдээ түрүүлнэ).
 *   2. Нэг эх сурвалжаас өдөрт 2-оос илүүг авахгүй — нэг сайтын эгнээ болохгүйн тулд.
 *   3. Ижил сэдэв/модель давхардуулахгүй — өмнө нь сонгосон (эсвэл өнөөдөр нийтлэгдсэн)
 *      мэдээтэй ижил модель дурдсан, эсвэл ижил компани + ижил шошготой бол алгасна.
 */

/** Нэг эх сурвалжаас өдөрт авах дээд тоо */
export const MAX_PER_SOURCE = 2;

/** Өдөрт нийтлэх анхдагч тоо */
export const DEFAULT_DAILY_LIMIT = 3;

/** Авто нийтлэхэд шаардах анхдагч доод оноо */
export const DEFAULT_MIN_SCORE = 7;

/** Сонголтод хэрэгтэй талбарууд — Article-ийн дэд хэсэг */
export interface PublishCandidate {
  id: string;
  relevance: number;
  sourceId: string;
  /** Холбогдсон моделийн slug-ууд */
  modelSlugs: string[];
  /** Холбогдсон компанийн slug-ууд */
  companySlugs: string[];
  tags: string[];
  publishedAtSource: Date | null;
  createdAt: Date;
}

/** process.env-ийн дэд хэсэг — тестэд энгийн объект дамжуулна */
type Env = Record<string, string | undefined>;

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = raw?.trim();
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** DAILY_PUBLISH_LIMIT — 0 бол авто нийтлэх унтраалттай */
export function dailyPublishLimit(env: Env = process.env): number {
  return positiveInt(env.DAILY_PUBLISH_LIMIT, DEFAULT_DAILY_LIMIT);
}

/** AUTO_PUBLISH_MIN_SCORE — үүнээс доош оноотой нийтлэл авто нийтлэгдэхгүй */
export function autoPublishMinScore(env: Env = process.env): number {
  return positiveInt(env.AUTO_PUBLISH_MIN_SCORE, DEFAULT_MIN_SCORE);
}

function overlaps(a: string[], b: string[]): boolean {
  return a.some((x) => b.includes(x));
}

/** Ижил сэдэв үү: нэг моделийн тухай, эсвэл нэг компанийн ижил шошготой мэдээ */
export function sameTopic(a: PublishCandidate, b: PublishCandidate): boolean {
  if (overlaps(a.modelSlugs, b.modelSlugs)) return true;
  return overlaps(a.companySlugs, b.companySlugs) && overlaps(a.tags, b.tags);
}

/** Оноо буурахаар, тэнцвэл шинэ мэдээ түрүүлнэ */
function byScore(a: PublishCandidate, b: PublishCandidate): number {
  if (a.relevance !== b.relevance) return b.relevance - a.relevance;
  const at = (a.publishedAtSource ?? a.createdAt).getTime();
  const bt = (b.publishedAtSource ?? b.createdAt).getTime();
  return bt - at;
}

/**
 * Квотын үлдэгдэлд багтаах нийтлэлүүдийг сонгоно.
 *
 * @param candidates  DRAFT нийтлэлүүд (ямар ч дараалалтай байж болно)
 * @param quota       өнөөдөр нийтлэх боломжтой үлдсэн тоо
 * @param alreadyToday өнөөдөр аль хэдийн нийтлэгдсэн мэдээ — эх сурвалж/сэдвийн
 *                     хязгаарыг өдрийн турш барихад хэрэглэнэ
 */
export function selectForPublish(
  candidates: PublishCandidate[],
  quota: number,
  alreadyToday: PublishCandidate[] = [],
): PublishCandidate[] {
  if (quota <= 0) return [];

  const perSource = new Map<string, number>();
  for (const a of alreadyToday) perSource.set(a.sourceId, (perSource.get(a.sourceId) ?? 0) + 1);

  const taken = [...alreadyToday];
  const picked: PublishCandidate[] = [];

  for (const c of [...candidates].sort(byScore)) {
    if (picked.length >= quota) break;
    if ((perSource.get(c.sourceId) ?? 0) >= MAX_PER_SOURCE) continue;
    if (taken.some((t) => sameTopic(c, t))) continue;

    picked.push(c);
    taken.push(c);
    perSource.set(c.sourceId, (perSource.get(c.sourceId) ?? 0) + 1);
  }

  return picked;
}
