import Link from "next/link";
import { requireUser } from "@/auth/session";
import {
  bookmarkCategories, listBookmarks, listGuideBookmarks, listPromptBookmarks, listToolBookmarks,
} from "@/bookmarks/queries";
import { BookmarkButton } from "@/components/BookmarkButton";
import { GuideGrid } from "@/components/GuideList";
import { PromptGrid } from "@/components/PromptList";
import { ToolGrid } from "@/components/ToolList";
import { likedPromptIds } from "@/prompts/queries";
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

  const [items, groups, guides, prompts, tools] = await Promise.all([
    listBookmarks(user.id, filter),
    bookmarkCategories(user.id),
    listGuideBookmarks(user.id),
    listPromptBookmarks(user.id),
    listToolBookmarks(user.id),
  ]);
  const articleTotal = groups.reduce((n, g) => n + g.count, 0);
  const total = articleTotal + guides.length + prompts.length + tools.length;

  // ?angilal=zaavar | prompt — зөвхөн тэр төрлийг харуулна
  const onlyGuides = asked === "zaavar";
  const onlyPrompts = asked === "prompt";
  const onlyTools = asked === "heregsel";
  const likedIds = prompts.length > 0 ? await likedPromptIds(user.id, prompts.map((p) => p.id)) : undefined;

  if (total === 0) {
    const latest = await getLatestNews(3);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          Одоохондоо хадгалсан зүйл алга. Мэдээ, заавар, prompt, хэрэгслийн хажуугийн ☆ товчийг
          дарж хадгална.
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

  const path = asked ? `/profile/hadgalsan?angilal=${asked}` : "/profile/hadgalsan";

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1.5 text-xs">
        <Link
          href="/profile/hadgalsan"
          className={`rounded-full border px-2.5 py-1 ${
            filter || onlyGuides || onlyPrompts || onlyTools
              ? "border-line text-muted hover:text-ink"
              : "border-accent text-accent"
          }`}
        >
          Бүгд <span className="tabular-nums">{total}</span>
        </Link>
        {guides.length > 0 && (
          <Link
            href="/profile/hadgalsan?angilal=zaavar"
            className={`rounded-full border px-2.5 py-1 ${
              onlyGuides ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
            }`}
          >
            Заавар <span className="tabular-nums">{guides.length}</span>
          </Link>
        )}
        {prompts.length > 0 && (
          <Link
            href="/profile/hadgalsan?angilal=prompt"
            className={`rounded-full border px-2.5 py-1 ${
              onlyPrompts ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
            }`}
          >
            Prompt <span className="tabular-nums">{prompts.length}</span>
          </Link>
        )}
        {tools.length > 0 && (
          <Link
            href="/profile/hadgalsan?angilal=heregsel"
            className={`rounded-full border px-2.5 py-1 ${
              onlyTools ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
            }`}
          >
            Хэрэгсэл <span className="tabular-nums">{tools.length}</span>
          </Link>
        )}
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

      {tools.length > 0 && !filter && !onlyGuides && !onlyPrompts && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Хэрэгсэл</h2>
          <ToolGrid items={tools} savedIds={new Set(tools.map((t) => t.id))} path={path} cols={2} />
        </section>
      )}

      {guides.length > 0 && !filter && !onlyPrompts && !onlyTools && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Заавар</h2>
          <GuideGrid items={guides} savedIds={new Set(guides.map((g) => g.id))} path={path} cols={2} />
        </section>
      )}

      {prompts.length > 0 && !filter && !onlyGuides && !onlyTools && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Prompt</h2>
          <PromptGrid
            items={prompts}
            savedIds={new Set(prompts.map((p) => p.id))}
            likedIds={likedIds}
            path={path}
          />
        </section>
      )}

      {onlyGuides || onlyPrompts || onlyTools ? null : items.length === 0 ? (
        // Ангиллаар шүүсэн үед л «хоосон» гэж хэлнэ — шүүлтгүй үед заавар/prompt нь доор байна
        filter ? (
          <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
            Энэ ангилалд хадгалсан мэдээ алга.
          </div>
        ) : null
      ) : (
        <section className="space-y-2">
          {(guides.length > 0 || prompts.length > 0 || tools.length > 0) && !filter && (
            <h2 className="text-sm font-semibold">Мэдээ</h2>
          )}
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
                  <BookmarkButton target={{ articleId: n.id }} saved path={path} compact />
                </span>
              </div>
            </li>
          ))}
        </ul>
        </section>
      )}
    </div>
  );
}
