"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchResults } from "@/lib/search";
import { analytics } from "@/lib/analytics";

const DEBOUNCE_MS = 200;
const PLACEHOLDER = "Модель, мэдээ, хэрэгсэл хайх…";

interface Row {
  href: string;
  label: string;
  hint: string;
}

/** Гурван бүлгийг keyboard-аар гүйх нэг жагсаалт болгоно */
function toRows(r: SearchResults | null): { group: string; rows: Row[] }[] {
  if (!r) return [];
  return [
    {
      group: "Мэдээ",
      rows: r.articles.map((a) => ({
        href: `/medee/${a.slug}`,
        label: a.titleMn,
        hint: a.kind === "DIGEST" ? "Долоо хоногийн тойм" : a.summaryMn.slice(0, 80),
      })),
    },
    {
      group: "Модель",
      rows: r.models.map((m) => ({
        href: `/model/${m.slug}`,
        label: m.name,
        hint: m.arenaOnly ? `${m.companyName} · зөвхөн Arena` : m.companyName,
      })),
    },
    {
      group: "Хэрэгсэл",
      rows: r.tools.map((t) => ({
        href: t.useCaseSlug ? `/hereglee/${t.useCaseSlug}` : "/hereglee",
        label: t.name,
        hint: t.useCaseName ?? t.vendor,
      })),
    },
  ].filter((g) => g.rows.length > 0);
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Бичих бүрт 200мс хүлээгээд дуудна
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        setResults(res.ok ? await res.json() : null);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
        setActive(0);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);

  const groups = toRows(results);
  const flat = groups.flatMap((g) => g.rows);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults(null);
  }, []);

  /** Үр дүнгээс шууд сонгосон нь баталсан хайлт. /hailt руу очих замыг тэр хуудас өөрөө бүртгэнэ. */
  const pick = useCallback(() => {
    analytics.search(q.trim(), results?.total ?? 0);
    close();
  }, [q, results, close]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) pick();
      else close();
      router.push(hit ? hit.href : `/hailt?q=${encodeURIComponent(q)}`);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Хайх"
        title="Хайх (Ctrl+K)"
        className="shrink-0 rounded border border-line p-1.5 text-muted hover:text-ink hover:bg-line/40"
      >
        <SearchIcon />
      </button>
    );
  }

  let index = -1;
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 sm:p-6 sm:pt-24 flex justify-center"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-xl h-full sm:h-auto sm:max-h-[70vh] bg-paper sm:rounded-lg border-line sm:border flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <span className="text-muted"><SearchIcon /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={PLACEHOLDER}
            aria-label={PLACEHOLDER}
            className="flex-1 bg-transparent py-3 text-sm outline-none"
          />
          <button onClick={close} aria-label="Хаах" className="text-xs text-muted hover:text-ink px-2">
            Esc
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {q.trim().length < 2 ? (
            <p className="p-4 text-sm text-muted">Хайх үгээ бичнэ үү (2-оос дээш тэмдэгт).</p>
          ) : loading && !results ? (
            <p className="p-4 text-sm text-muted">Хайж байна…</p>
          ) : flat.length === 0 ? (
            <p className="p-4 text-sm text-muted">Юу ч олдсонгүй. Өөр үгээр оролдоно уу.</p>
          ) : (
            groups.map((g) => (
              <div key={g.group}>
                <p className="px-3 pt-3 pb-1 text-xs uppercase tracking-wide text-muted">{g.group}</p>
                {g.rows.map((row) => {
                  index++;
                  const selected = index === active;
                  return (
                    <Link
                      key={row.href + row.label}
                      href={row.href}
                      onClick={pick}
                      className={`block px-3 py-2 ${selected ? "bg-line/50" : "hover:bg-line/30"}`}
                    >
                      <span className="text-sm font-medium">{row.label}</span>
                      {row.hint && <span className="block text-xs text-muted">{row.hint}</span>}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {q.trim().length >= 2 && (
          <Link
            href={`/hailt?q=${encodeURIComponent(q)}`}
            onClick={close}
            className="border-t border-line px-3 py-2 text-xs text-accent hover:bg-line/30"
          >
            «{q}» бүх үр дүнг харах →
          </Link>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
