/**
 * Өдрийн нийтлэлийн квот — DRAFT-уудаас хэдийг нь нийтлэхийг сонгох цэвэр логик (DB-гүй, тесттэй).
 *
 * Дүрэм:
 *   1. Оноо өндөрөөс нь эхэлнэ (тэнцвэл эх сурвалжийн шинэ мэдээ түрүүлнэ).
 *   2. Нэг эх сурвалжаас өдөрт 2-оос илүүг авахгүй — нэг сайтын эгнээ болохгүйн тулд.
 *   3. Нэг ангиллаас (NEWS, PROJECT ...) өдөрт 2-оос илүүг авахгүй — өдрийн 3 пост
 *      бүгд ижил төрлийн болохгүйн тулд. Боломжтой бол өдрийн сонголтод дор хаяж нэг
 *      NEWS-ээс бусад ангилал орно (зөвхөн моделийн мэдээний хуудас болохгүйн тулд).
 *   4. Ижил сэдэв/модель давхардуулахгүй — sameTopic-ийг үз.
 */
import type { ArticleCategory } from "../generated/prisma/enums";

/** Нэг эх сурвалжаас өдөрт авах дээд тоо */
export const MAX_PER_SOURCE = 2;

/** Нэг ангиллаас өдөрт авах дээд тоо */
export const MAX_PER_CATEGORY = 2;

/** Өдрийн сонголтод NEWS-ээс бусад ангилал хэдээс багагүй байх вэ (боломжтой бол) */
export const MIN_NON_NEWS = 1;

/** Өдөрт нийтлэх анхдагч тоо */
export const DEFAULT_DAILY_LIMIT = 3;

/** Авто нийтлэхэд шаардах анхдагч доод оноо */
export const DEFAULT_MIN_SCORE = 7;

/** Сонголтод хэрэгтэй талбарууд — Article-ийн дэд хэсэг */
export interface PublishCandidate {
  id: string;
  relevance: number;
  sourceId: string;
  category: ArticleCategory;
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

/** Ижил компанийн мэдээг нэг сэдэв гэж үзэхэд хэдэн шошго давхцсан байх вэ */
export const MIN_SHARED_TAGS = 2;

function sharedCount(a: string[], b: string[]): number {
  return a.filter((x) => b.includes(x)).length;
}

/**
 * Ижил сэдэв үү:
 *   - нэг моделийн тухай бол үргэлж тийм;
 *   - ижил компанийн мэдээ бол 2-оос доошгүй шошго давхцсан үед;
 *   - хоёулаа RISK ангилалтай бол ижил компанид нэг шошго давхцахад л хангалттай —
 *     нэг өдөр нэг компанийн хоёр аюулын мэдээ гаргахгүй.
 */
export function sameTopic(a: PublishCandidate, b: PublishCandidate): boolean {
  if (overlaps(a.modelSlugs, b.modelSlugs)) return true;
  if (!overlaps(a.companySlugs, b.companySlugs)) return false;

  const shared = sharedCount(a.tags, b.tags);
  const bothRisk = a.category === "RISK" && b.category === "RISK";
  return shared >= (bothRisk ? 1 : MIN_SHARED_TAGS);
}

/** Оноо буурахаар, тэнцвэл шинэ мэдээ түрүүлнэ */
function byScore(a: PublishCandidate, b: PublishCandidate): number {
  if (a.relevance !== b.relevance) return b.relevance - a.relevance;
  const at = (a.publishedAtSource ?? a.createdAt).getTime();
  const bt = (b.publishedAtSource ?? b.createdAt).getTime();
  return bt - at;
}

/** Slot-ын ангилалтай нийтлэл түрүүлнэ, дотроо оноогоор */
function bySlotThenScore(prefer: ArticleCategory[]) {
  return (a: PublishCandidate, b: PublishCandidate): number => {
    const pa = prefer.includes(a.category) ? 0 : 1;
    const pb = prefer.includes(b.category) ? 0 : 1;
    return pa !== pb ? pa - pb : byScore(a, b);
  };
}

/**
 * Квотын үлдэгдэлд багтаах нийтлэлүүдийг сонгоно.
 *
 * @param candidates  DRAFT нийтлэлүүд (ямар ч дараалалтай байж болно)
 * @param quota       өнөөдөр нийтлэх боломжтой үлдсэн тоо
 * @param alreadyToday өнөөдөр аль хэдийн нийтлэгдсэн мэдээ — эх сурвалж/сэдвийн
 *                     хязгаарыг өдрийн турш барихад хэрэглэнэ
 * @param prefer       тухайн slot-ын ангилал (morning: NEWS/RISK ...) — оноо багатай ч түрүүлнэ
 */
export function selectForPublish(
  candidates: PublishCandidate[],
  quota: number,
  alreadyToday: PublishCandidate[] = [],
  /** Slot-ын ангилал — эдгээр нь оноо багатай ч түрүүлнэ */
  prefer: ArticleCategory[] = [],
  opts: {
    /**
     * Сэдвийн давхардлыг л шалгах жагсаалт (эх сурвалж/ангиллын тоололд орохгүй).
     * БЭЛТГЭХ горимд: буфер нь ирээдүйн өдрийнх тул өнөөдөр нийтлэгдсэн нь ангиллын
     * хязгаарыг идэх ёсгүй, гэхдээ ижил үйл явдлыг дахин бэлдэх ч хэрэггүй.
     */
    avoidTopics?: PublishCandidate[];
  } = {},
): PublishCandidate[] {
  if (quota <= 0) return [];

  const count = (list: PublishCandidate[], key: (c: PublishCandidate) => string) => {
    const m = new Map<string, number>();
    for (const c of list) m.set(key(c), (m.get(key(c)) ?? 0) + 1);
    return m;
  };
  const bySource = count(alreadyToday, (c) => c.sourceId);
  const byCategory = count(alreadyToday, (c) => c.category);

  const taken = [...alreadyToday, ...(opts.avoidTopics ?? [])];
  const picked: PublishCandidate[] = [];

  const fits = (c: PublishCandidate) =>
    (bySource.get(c.sourceId) ?? 0) < MAX_PER_SOURCE &&
    (byCategory.get(c.category) ?? 0) < MAX_PER_CATEGORY &&
    !taken.some((t) => sameTopic(c, t));

  const add = (c: PublishCandidate) => {
    picked.push(c);
    taken.push(c);
    bySource.set(c.sourceId, (bySource.get(c.sourceId) ?? 0) + 1);
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
  };

  const sorted = [...candidates].sort(prefer.length ? bySlotThenScore(prefer) : byScore);
  for (const c of sorted) {
    if (picked.length >= quota) break;
    if (!fits(c)) continue;

    // Сүүлийн суудлыг NEWS-ээр дүүргэхийн өмнө: өдөр бүхэлдээ зөвхөн NEWS болох гэж байвал
    // NEWS-ээс бусад нэр дэвшигч байгаа эсэхийг шалгаад түүнд суудлаа өгнө
    const lastSeat = picked.length === quota - 1;
    const nonNews = [...alreadyToday, ...picked].filter((x) => x.category !== "NEWS").length;
    if (lastSeat && nonNews < MIN_NON_NEWS && c.category === "NEWS") {
      const alt = sorted.find((x) => x.category !== "NEWS" && !picked.includes(x) && fits(x));
      if (alt) {
        add(alt);
        continue;
      }
    }
    add(c);
  }

  return picked;
}
