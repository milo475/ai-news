/**
 * FB постын статистикийн цэвэр хэсэг — Graph API-ийн хариуг задлах.
 */

/** Graph /<post-id>?fields=reactions.summary(true),shares */
export interface GraphStats {
  reactions?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  error?: { message?: string; code?: number };
}

export interface PostStats {
  likes: number;
  shares: number;
}

/**
 * Graph-ийн хариунаас тоо гаргана.
 *
 * Талбар дутуу байвал 0 — постод reaction/share байхгүй байж бүрэн хэвийн.
 * `error` байвал null: тоолуурыг 0 болгож дарж бичвэл бодит өгөгдөл алдагдана.
 */
export function parseStats(json: GraphStats): PostStats | null {
  if (json.error) return null;
  const likes = json.reactions?.summary?.total_count;
  const shares = json.shares?.count;
  if (likes === undefined && shares === undefined) return null;
  return {
    likes: Number.isFinite(likes) ? Number(likes) : 0,
    shares: Number.isFinite(shares) ? Number(shares) : 0,
  };
}

/** Хэдэн хоногийн постыг шинэчлэх вэ — хуучин постын тоо бараг хувирахгүй */
export const STATS_WINDOW_DAYS = 30;
/** Нэг run-д хэдэн постыг асуух вэ (Graph-ийн rate limit) */
export const STATS_BATCH = 50;
