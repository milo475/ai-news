import Link from "next/link";
import type { NewsCard } from "@/data";
import { BookmarkButton } from "./BookmarkButton";
import { fmtDate } from "./format";

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="text-xs rounded px-1.5 py-0.5 border border-line text-muted">{t}</span>
      ))}
    </div>
  );
}

export function NewsList({
  items,
  /** Хадгалсан нийтлэлүүдийн id — нэвтэрсэн үед л дамжина */
  savedIds,
  path,
}: {
  items: NewsCard[];
  savedIds?: Set<string>;
  path?: string;
}) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {items.map((n) => (
        <li key={n.slug} className="p-4 hover:bg-line/30">
          {n.kind === "DIGEST" && (
            <span className="mr-2 text-xs rounded px-1.5 py-0.5 border border-accent/50 text-accent align-middle">
              Долоо хоног
            </span>
          )}
          <Link href={`/medee/${n.slug}`} className="font-medium hover:text-accent">{n.titleMn}</Link>
          <p className="text-sm text-muted mt-1">{n.summaryMn}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 text-xs text-muted">
            <span>{fmtDate(n.publishedAt)}</span>
            <span>·</span>
            <span>{n.sourceName}</span>
            <Tags tags={n.tags} />
            {savedIds && (
              <span className="ml-auto">
                <BookmarkButton articleId={n.id} saved={savedIds.has(n.id)} path={path} compact />
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
