/**
 * Өдрийн нийтлэлийн квот — DRAFT-уудаас хэдийг нь нийтлэхийг сонгох цэвэр логик (DB-гүй, тесттэй).
 *
 * Дүрэм:
 *   1. Оноо өндөрөөс нь эхэлнэ. Оноо нь үнэлгээ + **ангиллын давуу оноо**:
 *      RISK/FACT/HOWTO/BUSINESS +1, NEWS ба PROJECT 0 (`CATEGORY_BONUS`).
 *      Тэнцвэл эх сурвалжийн шинэ мэдээ түрүүлнэ.
 *   2. Нэг эх сурвалжаас өдөрт 2-оос илүүг авахгүй — нэг сайтын эгнээ болохгүйн тулд.
 *   3. Нэг ангиллаас өдөрт 2-оос илүүг авахгүй; **NEWS-ээс өдөрт зөвхөн 1**
 *      (`MAX_PER_CATEGORY_OVERRIDE`) — өдрийн хуудас компанийн мэдэгдлээр дүүрэхгүй.
 *   4. Ижил сэдэв/модель давхардуулахгүй — sameTopic-ийг үз.
 */
import { CATEGORIES } from "./category";
import type { ArticleCategory } from "../generated/prisma/enums";

/** Нэг эх сурвалжаас өдөрт авах дээд тоо */
export const MAX_PER_SOURCE = 2;

/** Нэг ангиллаас өдөрт авах дээд тоо */
export const MAX_PER_CATEGORY = 2;

/**
 * Ангилал бүрийн өдрийн дээд тоо — MAX_PER_CATEGORY-г дарна.
 *
 * NEWS нь компанийн мэдэгдэл: хурдан хуучирдаг, монгол уншигчид шууд хамаарал бага.
 * Өдөрт нэгээр хязгаарлаж, суудлыг хэрэгтэй контентод (RISK/FACT/HOWTO/BUSINESS) өгнө.
 */
export const MAX_PER_CATEGORY_OVERRIDE: Partial<Record<ArticleCategory, number>> = {
  NEWS: 1,
};

export function maxPerCategory(c: ArticleCategory): number {
  return MAX_PER_CATEGORY_OVERRIDE[c] ?? MAX_PER_CATEGORY;
}

/**
 * Сонголтын давуу оноо — үнэлгээний оноон дээр нэмэгдэнэ (DB-д хадгалагдахгүй).
 *
 * Хүнд шууд хэрэгтэй контент (аюул, гайхалтай баримт, заавар, бизнесийн боломж) нь
 * ижил оноотой компанийн мэдээг ялна.
 */
export const CATEGORY_BONUS: Partial<Record<ArticleCategory, number>> = {
  RISK: 1,
  FACT: 1,
  HOWTO: 1,
  BUSINESS: 1,
};

export function categoryBonus(c: ArticleCategory): number {
  return CATEGORY_BONUS[c] ?? 0;
}

/** Үнэлгээ + ангиллын давуу оноо */
export function effectiveScore(c: Pick<PublishCandidate, "relevance" | "category">): number {
  return c.relevance + categoryBonus(c.category);
}

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

/**
 * Ангилал тус бүрийн доод оноо. PROJECT/HOWTO контент нь жин багатай эх сурвалжаас
 * (Product Hunt, TLDR, Simon Willison ...) ирдэг бөгөөд үнэлгээний модель тэдгээрт ховор
 * 7+ өгдөг тул оройн slot хоосон үлддэг байв — тэдэнд нэгээр доогуур босго тавина.
 */
export const CATEGORY_MIN_SCORE: Partial<Record<ArticleCategory, number>> = {
  PROJECT: 6,
  HOWTO: 6,
};

/**
 * Ангиллын сулруулсан босго — ерөнхий босгоос хэзээ ч өндөр болохгүй.
 * Agent-ийн REJECTED босго болон нийтлэх босго хоёулаа үүгээр дамжина.
 */
export function relaxedScore(base: number, category: ArticleCategory): number {
  return Math.min(base, CATEGORY_MIN_SCORE[category] ?? base);
}

/** Тухайн ангиллын нийтлэх доод оноо */
export function minScoreFor(category: ArticleCategory, env: Env = process.env): number {
  return relaxedScore(autoPublishMinScore(env), category);
}

/** Ангиллуудыг доод онооных нь дагуу бүлэглэнэ — Prisma-гийн OR нөхцөл барихад */
export function minScoreGroups(env: Env = process.env): { score: number; categories: ArticleCategory[] }[] {
  const byScore = new Map<number, ArticleCategory[]>();
  for (const c of CATEGORIES) {
    const score = minScoreFor(c, env);
    byScore.set(score, [...(byScore.get(score) ?? []), c]);
  }
  return [...byScore].map(([score, categories]) => ({ score, categories }));
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

// ---------- Шинэлэг байдал ----------

/**
 * Шинэлэг байдлын хагас задралын хугацаа.
 *
 * Хэмжилт (production, 14 хоног): нийтлэгдэх үеийн нас p50 = 65ц, p90 = 193ц.
 * Шалтгаан нь буферт хуримтлагдсан хуучин ноорог **оноогоороо** шинэ мэдээг
 * дийлж байсан: 9 оноотой 5 хоногийн өмнөх мэдээ 7 оноотой өнөөдрийн мэдээг
 * үргэлж хөөнө. Мэдээний үнэ цэн цагаар буурдаг — оноонд түүнийг тусгана.
 */
export const FRESHNESS_HALF_LIFE_H = 24;

/**
 * Шинэлэг байдлын жин — оноон дээр нэмэгдэх дээд утга.
 *
 * 3 нь: дөнгөж гарсан мэдээ +3.0, нэг хоногийнх +1.5, хоёр хоногийнх +0.75.
 * Өөрөөр хэлбэл 7 оноотой шинэ мэдээ (10.0) нь 9 оноотой 3 хоногийнхийг (9.4)
 * ялна, харин 5 оноотой шинэ мэдээ (8.0) ялахгүй — чанар хэвээр эхэнд.
 */
export const FRESHNESS_WEIGHT = 3;

export function ageHours(c: Pick<PublishCandidate, "publishedAtSource" | "createdAt">, now: Date): number {
  const at = (c.publishedAtSource ?? c.createdAt).getTime();
  return Math.max(0, (now.getTime() - at) / 3_600_000);
}

/** 1 (дөнгөж гарсан) → 0 (хэдэн хоногийн өмнөх) */
export function freshness(
  c: Pick<PublishCandidate, "publishedAtSource" | "createdAt">,
  now: Date,
  halfLifeH = FRESHNESS_HALF_LIFE_H,
): number {
  return 0.5 ** (ageHours(c, now) / halfLifeH);
}

/** Сонголтын эцсийн оноо: үнэлгээ + ангиллын давуу оноо + шинэлэг байдал */
export function rankScore(c: PublishCandidate, now: Date): number {
  return effectiveScore(c) + FRESHNESS_WEIGHT * freshness(c, now);
}

/** Оноо (шинэлэг байдлын хамт) буурахаар, тэнцвэл шинэ мэдээ түрүүлнэ */
function byScore(now: Date) {
  return (a: PublishCandidate, b: PublishCandidate): number => {
    const [sa, sb] = [rankScore(a, now), rankScore(b, now)];
    if (sa !== sb) return sb - sa;
    const at = (a.publishedAtSource ?? a.createdAt).getTime();
    const bt = (b.publishedAtSource ?? b.createdAt).getTime();
    return bt - at;
  };
}

/** Slot-ын ангилалтай нийтлэл түрүүлнэ, дотроо оноогоор */
function bySlotThenScore(prefer: ArticleCategory[], now: Date) {
  const score = byScore(now);
  return (a: PublishCandidate, b: PublishCandidate): number => {
    const pa = prefer.includes(a.category) ? 0 : 1;
    const pb = prefer.includes(b.category) ? 0 : 1;
    return pa !== pb ? pa - pb : score(a, b);
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
    /** Шинэлэг байдлыг тооцох агшин (тестэд тогтмол) */
    now?: Date;
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
    (byCategory.get(c.category) ?? 0) < maxPerCategory(c.category) &&
    !taken.some((t) => sameTopic(c, t));

  const add = (c: PublishCandidate) => {
    picked.push(c);
    taken.push(c);
    bySource.set(c.sourceId, (bySource.get(c.sourceId) ?? 0) + 1);
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
  };

  const now = opts.now ?? new Date();
  const sorted = [...candidates].sort(prefer.length ? bySlotThenScore(prefer, now) : byScore(now));
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
