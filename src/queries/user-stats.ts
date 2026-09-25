/**
 * /admin-ийн "Хэрэглэгчид" хэсгийн тоо баримт.
 */
import { prisma } from "../db";

export interface UserStats {
  total: number;
  verified: number;
  /** Баталгаажсан хувь, 0–100 */
  verifiedPct: number;
  withPreference: number;
  recent: { id: string; email: string; name: string | null; createdAt: Date; verified: boolean; provider: string }[];
  topBookmarked: { id: string; slug: string; titleMn: string; count: number }[];
}

export async function userStats(): Promise<UserStats> {
  const [total, verified, withPreference, recentRows, grouped] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.userPreference.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, email: true, name: true, createdAt: true, emailVerifiedAt: true,
        accounts: { select: { provider: true }, take: 1 },
      },
    }),
    prisma.bookmark.groupBy({
      by: ["articleId"], where: { articleId: { not: null } },
      _count: { articleId: true }, orderBy: { _count: { articleId: "desc" } }, take: 10,
    }),
  ]);

  const ids = grouped.flatMap((g) => (g.articleId ? [g.articleId] : []));
  const articles = ids.length
    ? await prisma.article.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, titleMn: true } })
    : [];
  const byId = new Map(articles.map((a) => [a.id, a]));

  return {
    total,
    verified,
    verifiedPct: total === 0 ? 0 : Math.round((verified / total) * 100),
    withPreference,
    recent: recentRows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      verified: u.emailVerifiedAt !== null,
      provider: u.accounts[0]?.provider ?? "имэйл",
    })),
    topBookmarked: grouped.flatMap((g) => {
      const a = g.articleId ? byId.get(g.articleId) : undefined;
      return a ? [{ id: a.id, slug: a.slug, titleMn: a.titleMn ?? "", count: g._count.articleId }] : [];
    }),
  };
}
