import type { TocItem } from "@/guides/markdown.api";

/** Зүүн талын sticky агуулга. Нэг л алхамтай бол утгагүй тул харуулахгүй. */
export function GuideToc({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Агуулга" className="lg:sticky lg:top-6 space-y-2">
      <p className="text-xs uppercase tracking-widest text-muted">Агуулга</p>
      <ol className="space-y-1.5 text-sm">
        {items.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`} className="text-muted hover:text-accent block leading-snug">
              {t.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
