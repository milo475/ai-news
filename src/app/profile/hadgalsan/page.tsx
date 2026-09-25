import Link from "next/link";
import { requireUser } from "@/auth/session";
import { bookmarkCategories, listBookmarks } from "@/bookmarks/queries";
import { BookmarkButton } from "@/components/BookmarkButton";
import { CATEGORIES, CATEGORY_LABEL } from "@/agent/category";
import { fmtDate } from "@/components/format";
import { getLatestNews } from "@/data";
import type { ArticleCategory } from "@/generated/prisma/enums";

export const metadata = { title: "Хадгалсан" };

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ angilal?: string }>;
}) {
  const user = await requireUser();
  const asked = (await searchParams).angilal;
  // Танигдахгүй ангилал ирвэл шүүлтгүй бүтэн жагсаалт
  const filter = (CATEGORIES as string[]).includes(asked ?? "") ? (asked as ArticleCategory) : undefined;

  const [items, groups] = await Promise.all([
    listBookmarks(user.id, filter),
    bookmarkCategories(user.id),
  ]);
  const total = groups.reduce((n, g) => n + g.count, 0);

  if (total === 0) {
    const latest = await getLatestNews(3);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          Одоохондоо хадгалсан зүйл алга. Мэдээний хажуугийн ☆ товчийг дарж хадгална.
        </div>
        {latest.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Сүүлийн мэдээнээс</h2>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {latest.map((n) => (
                <li key={n.slug} className="p-4">
                  <Link href={`/medee/${n.slug}`} className="font-medium hover:text-accent">{n.titleMn}</Link>
                  <p className="text-sm text-muted mt-1">{n.summaryMn}</p>
                  <p className="text-xs text-muted mt-2">{fmtDate(n.publishedAt)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const path = filter ? `/profile/hadgalsan?angilal=${filter}` : "/profile/hadgalsan";

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1.5 text-xs">
        <Link
          href="/profile/hadgalsan"
          className={`rounded-full border px-2.5 py-1 ${
            filter ? "border-line text-muted hover:text-ink" : "border-accent text-accent"
          }`}
        >
          Бүгд <span className="tabular-nums">{total}</span>
        </Link>
        {groups.map((g) => (
          <Link
            key={g.category}
            href={`/profile/hadgalsan?angilal=${g.category}`}
            className={`rounded-full border px-2.5 py-1 ${
              filter === g.category ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
            }`}
          >
            {CATEGORY_LABEL[g.category]} <span className="tabular-nums">{g.count}</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          Энэ ангилалд хадгалсан зүйл алга.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((n) => (
            <li key={n.id} className="p-4 hover:bg-line/30">
              <Link href={`/medee/${n.slug}`} className="font-medium hover:text-accent">{n.titleMn}</Link>
              <p className="text-sm text-muted mt-1">{n.summaryMn}</p>
              <div className="flex flex-wrap items-center gap-x-3 mt-2 text-xs text-muted">
                <span>{CATEGORY_LABEL[n.category]}</span>
                <span>·</span>
                <span>{fmtDate(n.publishedAt)}</span>
                <span className="ml-auto">
                  <BookmarkButton articleId={n.id} saved path={path} compact />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
