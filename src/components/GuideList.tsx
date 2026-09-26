import Image from "next/image";
import Link from "next/link";
import type { GuideCard } from "@/guides/queries";
import { LEVEL_LABEL } from "@/guides/write.api";
import { BookmarkButton } from "./BookmarkButton";

export function LevelBadge({ level }: { level: GuideCard["level"] }) {
  return (
    <span className="text-xs rounded px-1.5 py-0.5 border border-line text-muted">{LEVEL_LABEL[level]}</span>
  );
}

/** Зааврын карт — hero, гарчиг, lead, уншихад X мин, түвшин */
export function GuideItem({
  guide,
  saved,
  path,
}: {
  guide: GuideCard;
  saved?: boolean;
  path?: string;
}) {
  return (
    <li className="rounded-lg border border-line overflow-hidden hover:bg-line/20 flex flex-col">
      <Link href={`/zaavar/${guide.slug}`} className="block" aria-label={guide.title} tabIndex={-1}>
        {guide.hasHero ? (
          <Image
            src={`/api/guide-image/${guide.slug}`}
            alt=""
            width={1200}
            height={675}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
            className="w-full aspect-video object-cover border-b border-line"
          />
        ) : (
          <div className="w-full aspect-video bg-line/30 border-b border-line" />
        )}
      </Link>
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <Link href={`/zaavar/${guide.slug}`} className="font-medium hover:text-accent leading-snug">
          {guide.title}
        </Link>
        <p className="text-sm text-muted line-clamp-3">{guide.lead}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-auto pt-1">
          <LevelBadge level={guide.level} />
          <span>{guide.readMinutes} мин</span>
          {saved !== undefined && (
            <span className="ml-auto">
              <BookmarkButton target={{ guideId: guide.id }} saved={saved} path={path} compact />
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function GuideGrid({
  items,
  savedIds,
  path,
  /** Нарийн баганад (нийтлэлийн доор) 2, өргөн хуудсанд 3 */
  cols = 3,
}: {
  items: GuideCard[];
  savedIds?: Set<string>;
  path?: string;
  cols?: 2 | 3;
}) {
  return (
    <ul className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {items.map((g) => (
        <GuideItem key={g.id} guide={g} saved={savedIds ? savedIds.has(g.id) : undefined} path={path} />
      ))}
    </ul>
  );
}
