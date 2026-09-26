/**
 * Процессийн доторх хугацаат кэш (TTL memo).
 *
 * Яагаад Next-ийн `unstable_cache` биш вэ: тэр нь утгыг JSON болгон хадгалдаг тул
 * `Date` талбарууд мөр болж эргэж ирдэг — бидний query-ууд Date-ээр дүүрэн.
 * Вэб нь Railway дээр нэг процесс болж ажилладаг тул энгийн санах ойн кэш хангалттай.
 *
 * Онцлог:
 *   · нэг зэрэг ирсэн ижил хүсэлтүүдийг нэгтгэнэ (single flight) — DB-д нэг л очно
 *   · алдааг кэшлэхгүй
 *   · түлхүүрийн тоо `max`-аас хэтэрвэл хамгийн эртнийхийг хаяна
 */

export interface MemoOptions<A extends unknown[]> {
  /** Кэшийн нэр — түлхүүрийн угтвар, дибаг хийхэд */
  name: string;
  ttlMs: number;
  /** Аргументаас түлхүүр үүсгэнэ. Өгөөгүй бол JSON.stringify(args) */
  key?: (...args: A) => string;
  /** Санах ойд байлгах түлхүүрийн дээд тоо */
  max?: number;
  /** Тестэд хиймэл цаг өгнө */
  now?: () => number;
}

export interface Memoized<A extends unknown[], R> {
  (...args: A): Promise<R>;
  /** Кэшийг цэвэрлэнэ (тест, админы «шинэчлэх») */
  clear(): void;
  size(): number;
}

export function memoTtl<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  o: MemoOptions<A>,
): Memoized<A, R> {
  const now = o.now ?? Date.now;
  const max = o.max ?? 64;
  const done = new Map<string, { value: R; expires: number }>();
  const inflight = new Map<string, Promise<R>>();

  const wrapped = (async (...args: A): Promise<R> => {
    const key = o.key ? o.key(...args) : JSON.stringify(args);

    const hit = done.get(key);
    if (hit && hit.expires > now()) return hit.value;
    if (hit) done.delete(key);

    const running = inflight.get(key);
    if (running) return running;

    const p = fn(...args)
      .then((value) => {
        done.set(key, { value, expires: now() + o.ttlMs });
        // Map нь оруулсан дарааллаа хадгалдаг — хамгийн эртнийх нь эхний түлхүүр
        while (done.size > max) {
          const oldest = done.keys().next().value;
          if (oldest === undefined) break;
          done.delete(oldest);
        }
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, p);
    return p;
  }) as Memoized<A, R>;

  wrapped.clear = () => {
    done.clear();
    inflight.clear();
  };
  wrapped.size = () => done.size;
  registerCache(wrapped);
  return wrapped;
}

/**
 * Бүртгэгдсэн кэшүүд — админ контент нийтлэхэд бүгдийг нь цэвэрлэнэ.
 * Ингэснээр редактор «нийтлэх» дархад сайт дээр шууд гарна.
 */
const REGISTRY: { clear(): void }[] = [];

export function registerCache(c: { clear(): void }): void {
  REGISTRY.push(c);
}

export function clearAllCaches(): number {
  for (const c of REGISTRY) c.clear();
  return REGISTRY.length;
}

/** Хуудас тус бүрийн шинэчлэх давтамж (секунд) — тайланд иш татахад нэг дор */
export const TTL_SECONDS = {
  /** Нүүр хуудас */
  home: 300,
  /** Мэдээний жагсаалт — шинэ мэдээ хурдан гарах ёстой */
  news: 60,
  /** Каталог, жагсаалтууд */
  list: 3_600,
  /** Заавар — мөнхийн контент */
  guide: 86_400,
} as const;

export const TTL = {
  home: TTL_SECONDS.home * 1000,
  news: TTL_SECONDS.news * 1000,
  list: TTL_SECONDS.list * 1000,
  guide: TTL_SECONDS.guide * 1000,
} as const;
