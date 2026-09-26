"use client";

import { countClickAction } from "@/tools/actions";
import { track } from "@/lib/analytics";

/**
 * «Вэбсайт руу →» товч. Нэвтрэхгүй ч ажиллана — товшилтыг л тоолно.
 *
 * Affiliate холбоос үед rel="sponsored nofollow" — хайлтын системд ил тод байх ёстой.
 */
export function ToolClickOut({
  toolId,
  slug,
  href,
  affiliate,
  label = "Вэбсайт руу",
  compact = false,
}: {
  toolId: string;
  slug: string;
  href: string;
  affiliate: boolean;
  label?: string;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={affiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
      onClick={() => {
        track("tool_click_out", { slug, affiliate });
        void countClickAction(toolId);
      }}
      className={
        compact
          ? "text-xs rounded border border-accent/60 px-2 py-1 text-accent hover:bg-accent/10 whitespace-nowrap"
          : "rounded bg-accent text-white px-4 py-2 text-sm font-medium hover:opacity-90 inline-block"
      }
    >
      {label} →
    </a>
  );
}
