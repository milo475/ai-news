import Link from "next/link";
import { BookmarkButton } from "./BookmarkButton";
import { ToolClickOut } from "./ToolClickOut";
import { ToolLogo } from "./ToolLogo";
import { ToolUpvote } from "./ToolUpvote";
import type { ToolCard } from "@/tools/queries";
import { MN_SUPPORT_BADGE, MN_SUPPORT_LABEL, TOOL_CATEGORY_LABEL, TOOL_PLAN_LABEL } from "@/tools/tool.api";

/** Үнийн шошго — тоо мэдэгдэж байвал түүнийг харуулна */
export function PriceBadge({ tool }: { tool: Pick<ToolCard, "pricing" | "priceFrom"> }) {
  const text =
    tool.pricing === "FREE"
      ? "Үнэгүй"
      : tool.priceFrom
        ? `$${tool.priceFrom}/сар-аас`
        : TOOL_PLAN_LABEL[tool.pricing];
  const free = tool.pricing === "FREE" || tool.pricing === "FREEMIUM";
  return (
    <span className={`text-xs rounded px-1.5 py-0.5 border ${free ? "border-up/40 text-up" : "border-line text-muted"}`}>
      {text}
    </span>
  );
}

export function MnBadge({ support }: { support: ToolCard["mongolianSupport"] }) {
  const cls =
    support === "GOOD" ? "border-up/50 text-up"
    : support === "PARTIAL" ? "border-warn/50 text-warn"
    : "border-line text-muted";
  return (
    <span className={`text-xs rounded px-1.5 py-0.5 border ${cls}`} title={MN_SUPPORT_LABEL[support]}>
      {MN_SUPPORT_BADGE[support]}
    </span>
  );
}

export function Stars({ rating, count }: { rating: number; count: number }) {
  if (count === 0) return <span className="text-xs text-muted">үнэлгээгүй</span>;
  return (
    <span className="text-xs text-muted tabular-nums" title={`${count} шүүмж`}>
      ★ {rating.toFixed(1)} <span className="text-muted">({count})</span>
    </span>
  );
}

export function ToolItem({
  tool,
  website,
  saved,
  upvoted,
  path,
}: {
  tool: ToolCard;
  /** Картаас шууд гарах товч — affiliate ?? website */
  website?: { href: string; affiliate: boolean };
  saved?: boolean;
  upvoted?: boolean;
  path?: string;
}) {
  return (
    <li className="rounded-lg border border-line p-4 space-y-3 flex flex-col hover:bg-line/20">
      <div className="flex items-start gap-3">
        {/* Зураг нь alt="" тул холбоост нэр aria-label-аар өгнө */}
        <Link href={`/hereglel/${tool.slug}`} aria-label={tool.name} tabIndex={-1}>
          <ToolLogo name={tool.name} slug={tool.slug} hasLogo={tool.hasLogo} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/hereglel/${tool.slug}`} className="font-medium hover:text-accent block leading-snug">
            {tool.name}
          </Link>
          <p className="text-sm text-muted line-clamp-2">{tool.tagline}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PriceBadge tool={tool} />
        <MnBadge support={tool.mongolianSupport} />
        {tool.categories.slice(0, 2).map((c) => (
          <span key={c} className="text-xs rounded px-1.5 py-0.5 border border-line text-muted">
            {TOOL_CATEGORY_LABEL[c]}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        <Stars rating={tool.rating} count={tool.reviewCount} />
        <span className="ml-auto flex items-center gap-2">
          {upvoted !== undefined ? (
            <ToolUpvote toolId={tool.id} slug={tool.slug} upvoted={upvoted} count={tool.upvotes} path={path} />
          ) : (
            <span className="text-xs text-muted tabular-nums">▲ {tool.upvotes}</span>
          )}
          {saved !== undefined && (
            <BookmarkButton target={{ toolId: tool.id }} saved={saved} path={path} compact />
          )}
          {website && (
            <ToolClickOut
              toolId={tool.id} slug={tool.slug} href={website.href}
              affiliate={website.affiliate} label="Сайт" compact
            />
          )}
        </span>
      </div>
    </li>
  );
}

export function ToolGrid({
  items,
  savedIds,
  upvotedIds,
  path,
  cols = 3,
}: {
  items: ToolCard[];
  savedIds?: Set<string>;
  upvotedIds?: Set<string>;
  path?: string;
  cols?: 2 | 3;
}) {
  return (
    <ul className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {items.map((t) => (
        <ToolItem
          key={t.id}
          tool={t}
          saved={savedIds ? savedIds.has(t.id) : undefined}
          upvoted={upvotedIds ? upvotedIds.has(t.id) : undefined}
          path={path}
        />
      ))}
    </ul>
  );
}
