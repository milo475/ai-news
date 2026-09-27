/**
 * FB/IG постын хүрэлтийн цэвэр хэсэг — Graph-ийн хариуг задлах, 7 хоногийн тайлан
 * бодох (DB, сүлжээгүй тул тесттэй).
 *
 * Зорилго: «юу ажиллаж байна» гэдгийг тааварлахгүй, тоогоор мэдэх. Ангилал ба
 * hook-ийн загвар тус бүрээр дундаж хүрэлт, хариу үзүүлэлтийг харьцуулна.
 */

/** Хүрэлтийг хэдэн цагийн дараа татах вэ — тоо нь тэр үед тогтворжсон байдаг */
export const INSIGHTS_DELAY_HOURS = 24;

/** Нэг run-д хэдэн постыг асуух вэ (Graph-ийн rate limit) */
export const INSIGHTS_BATCH = 25;

/** Тайлангийн цонх */
export const REPORT_DAYS = 7;

/** Graph `/{post-id}/insights?metric=...` ба IG media insights-ийн ерөнхий хэлбэр */
export interface GraphInsights {
  data?: { name?: string; values?: { value?: unknown }[] }[];
  error?: { message?: string; code?: number };
}

/** Graph `/{post-id}?fields=reactions.summary(true),shares,comments.summary(true)` */
export interface GraphEngagement {
  reactions?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  comments?: { summary?: { total_count?: number } };
  error?: { message?: string; code?: number };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * Insights-ийн хариунаас нэг метрикийн тоог гаргана.
 * Метрик байхгүй бол null — 0 гэж дарж бичвэл бодит өгөгдөл алдагдана.
 */
export function metricOf(json: GraphInsights, name: string): number | null {
  if (json.error) return null;
  const row = json.data?.find((d) => d.name === name);
  if (!row) return null;
  return num(row.values?.[0]?.value);
}

export interface FbPostStats {
  reach: number | null;
  likes: number | null;
  shares: number | null;
  comments: number | null;
}

/**
 * Хоёр дуудлагын хариуг нэгтгэнэ. Хоёулаа бүтэлгүй бол null.
 *
 * Graph нь ТЭГ утгатай талбарыг огт буцаадаггүй (`shares` байхгүй = 0 хуваалцалт).
 * Тиймээс хариу алдаагүй ирсэн бол байхгүй талбарыг **0** гэж үзнэ. Хариу огт
 * ирээгүй / алдаатай бол null — байгаа тоог 0-ээр дарж бичихгүй.
 */
export function parseFbStats(
  insights: GraphInsights | null,
  engagement: GraphEngagement | null,
): FbPostStats | null {
  const reach = insights ? metricOf(insights, "post_impressions_unique") : null;
  const ok = engagement !== null && !engagement.error;
  const count = (v: unknown) => (ok ? (num(v) ?? 0) : null);

  if (reach === null && !ok) return null;
  return {
    reach,
    likes: count(engagement?.reactions?.summary?.total_count),
    shares: count(engagement?.shares?.count),
    comments: count(engagement?.comments?.summary?.total_count),
  };
}

export interface IgMediaStats {
  reach: number | null;
  likes: number | null;
  comments: number | null;
}

export function parseIgStats(json: GraphInsights | null): IgMediaStats | null {
  if (!json || json.error) return null;
  const reach = metricOf(json, "reach");
  const likes = metricOf(json, "likes");
  const comments = metricOf(json, "comments");
  if (reach === null && likes === null && comments === null) return null;
  return { reach, likes, comments };
}

/**
 * Хүрэлтийг татах хугацаа болсон уу.
 *
 * Постлосноос 24 цагийн дараа нэг л удаа татна: түүнээс хойш тоо бараг хувирахгүй,
 * дэмий дуудлага нь Graph-ийн лимитийг иддэг.
 */
export function insightsDue(
  postedAt: Date | null,
  statsAt: Date | null,
  now: Date,
  delayHours = INSIGHTS_DELAY_HOURS,
): boolean {
  if (!postedAt) return false;
  const ready = postedAt.getTime() + delayHours * 3_600_000;
  if (now.getTime() < ready) return false;
  // Хүлээх хугацаа болсны ДАРАА татсан бол дахин шаардлагагүй
  return statsAt === null || statsAt.getTime() < ready;
}

// ---------- 7 хоногийн тайлан ----------

export interface PostRow {
  category: string;
  /** null = карт үүсээгүй, эсвэл загвар тэмдэглэгдээгүй хуучин пост */
  hookType: string | null;
  fbReach: number;
  fbLikes: number;
  fbShares: number;
  fbComments: number;
  igReach: number;
  igLikes: number;
  igComments: number;
}

export interface GroupStats {
  key: string;
  posts: number;
  /** Дундаж FB хүрэлт */
  avgReach: number;
  /** Дундаж хариу үзүүлэлт (reaction + share + коммент) */
  avgEngagement: number;
  /** Хариу / хүрэлт, хувиар. Хүрэлт 0 бол null. */
  engagementRate: number | null;
  /** Дундаж IG хүрэлт */
  avgIgReach: number;
}

export function engagementOf(r: PostRow): number {
  return r.fbLikes + r.fbShares + r.fbComments;
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Нэг бүлгийн дундаж — постын тоогоор */
export function statsFor(key: string, rows: PostRow[]): GroupStats {
  const posts = rows.length;
  const sum = (f: (r: PostRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const reach = sum((r) => r.fbReach);
  const engagement = sum(engagementOf);

  return {
    key,
    posts,
    avgReach: posts ? Math.round(reach / posts) : 0,
    avgEngagement: posts ? round(engagement / posts) : 0,
    engagementRate: reach > 0 ? round((engagement / reach) * 100, 2) : null,
    avgIgReach: posts ? Math.round(sum((r) => r.igReach) / posts) : 0,
  };
}

/**
 * Бүлэглээд дундажлана. Хүрэлтээр буурахаар эрэмбэлнэ; хүрэлт тэнцвэл хариугаар.
 * `minPosts`-оос бага бүлгийг хасна — 1 постын тоо санамсаргүй.
 */
export function groupBy(
  rows: PostRow[],
  key: (r: PostRow) => string | null,
  minPosts = 1,
): GroupStats[] {
  const buckets = new Map<string, PostRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    buckets.set(k, [...(buckets.get(k) ?? []), r]);
  }
  return [...buckets]
    .filter(([, list]) => list.length >= minPosts)
    .map(([k, list]) => statsFor(k, list))
    .sort((a, b) => b.avgReach - a.avgReach || b.avgEngagement - a.avgEngagement);
}

export interface Report {
  /** Хэдэн пост тооцоонд орсон */
  posts: number;
  byCategory: GroupStats[];
  byHookType: GroupStats[];
  /** Бүх постын нийлбэр дундаж — бүлгүүдийг харьцуулах суурь */
  overall: GroupStats;
}

export function buildReport(rows: PostRow[], minPosts = 1): Report {
  return {
    posts: rows.length,
    byCategory: groupBy(rows, (r) => r.category, minPosts),
    byHookType: groupBy(rows, (r) => r.hookType, minPosts),
    overall: statsFor("бүгд", rows),
  };
}

/** Дундажаас хэдэн хувиар дээгүүр/доогуур — "+42%" / "-8%" / null */
export function vsOverall(group: GroupStats, overall: GroupStats): string | null {
  if (overall.avgReach <= 0) return null;
  const pct = Math.round(((group.avgReach - overall.avgReach) / overall.avgReach) * 100);
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
