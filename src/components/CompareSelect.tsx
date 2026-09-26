"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pairPath } from "@/compare/pair.api";
import { track } from "@/lib/analytics";

/**
 * «Харьцуулах» сонголт — /model хуудаснаас /harits руу.
 *
 * Хос нь цагаан толгойн эрэмбэтэй болж хаяг үүснэ (pairPath), тиймээс аль талаас
 * сонгосон нь хамаагүй — үргэлж ижил хуудас руу орно.
 */
export function CompareSelect({
  slug,
  options,
}: {
  slug: string;
  options: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (options.length === 0) return null;

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Харьцуулах:</span>
      <select
        defaultValue=""
        disabled={busy}
        onChange={(e) => {
          const other = e.target.value;
          if (!other) return;
          setBusy(true);
          track("compare_pick", { from: slug, to: other });
          router.push(pairPath(slug, other));
        }}
        className="rounded border border-line bg-transparent px-2 py-1 text-sm focus:outline-none focus:border-accent"
      >
        <option value="" disabled>— модель сонгох —</option>
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
