"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardShare } from "./CardShare";
import type { CardItem } from "@/gallery/queries";
import type { SharePlatform } from "@/gallery/card.api";
import { CATEGORY_LABEL } from "@/agent/category";
import { fmtDate } from "./format";
import { track } from "@/lib/analytics";

interface ApiPage {
  items: (Omit<CardItem, "publishedAt" | "cardAt"> & { publishedAt: string | null; cardAt: string | null })[];
  next: string | null;
}

/**
 * Картын галерей — infinite scroll (cursor pagination) + lightbox.
 *
 * Эхний хуудсыг сервер рендерлэж өгнө (SEO, хурд); дараагийнхыг /api/barimt-аас авна.
 */
export function CardGallery({
  initial,
  initialNext,
  category,
  siteOrigin,
  platforms,
  appId,
}: {
  initial: CardItem[];
  initialNext: string | null;
  category?: string;
  siteOrigin: string;
  platforms: SharePlatform[];
  appId?: string;
}) {
  const [items, setItems] = useState(initial);
  const [next, setNext] = useState(initialNext);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<CardItem | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Шүүлт солигдоход серверийн шинэ өгөгдлөөр солино
  useEffect(() => {
    setItems(initial);
    setNext(initialNext);
  }, [initial, initialNext]);

  const loadMore = useCallback(async () => {
    if (!next || loading) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ cursor: next });
      if (category) qs.set("angilal", category);
      const res = await fetch(`/api/barimt?${qs}`);
      if (!res.ok) return;
      const page = (await res.json()) as ApiPage;
      setItems((prev) => [
        ...prev,
        ...page.items.map((i) => ({
          ...i,
          publishedAt: i.publishedAt ? new Date(i.publishedAt) : null,
          cardAt: i.cardAt ? new Date(i.cardAt) : null,
        })),
      ]);
      setNext(page.next);
    } finally {
      setLoading(false);
    }
  }, [next, loading, category]);

  // Хуудсын төгсгөлд хүрэхэд дараагийн хуудсыг авна
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, next]);

  // Lightbox — Esc-ээр хаана, нээлттэй үед хуудас гүйлгэхгүй
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => {
                setOpen(c);
                track("card_view", { slug: c.slug, from: "gallery" });
              }}
              className="group relative block w-full overflow-hidden rounded-lg border border-line text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/fb-image/${c.id}`}
                alt={c.hook}
                width={1080}
                height={1350}
                loading="lazy"
                className="w-full aspect-4/5 object-cover"
              />
              <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="text-xs text-white/70">
                  {CATEGORY_LABEL[c.category]} · {fmtDate(c.publishedAt)}
                </span>
                <span className="text-sm font-medium text-white line-clamp-3">{c.hook}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div ref={sentinel} className="h-px" />
      {next && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="text-sm rounded border border-line px-4 py-2 text-muted hover:text-ink disabled:opacity-60"
          >
            {loading ? "Ачаалж байна…" : "Дараагийн 24"}
          </button>
        </div>
      )}
      {!next && items.length > 0 && (
        <p className="text-center text-xs text-muted pt-2">Бүх карт үзэгдлээ.</p>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.hook}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-lg bg-paper p-4 my-auto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/fb-image/${open.id}`}
              alt={open.hook}
              width={1080}
              height={1350}
              className="w-full aspect-4/5 object-cover rounded border border-line"
            />
            <div className="space-y-1">
              <p className="text-xs text-muted">
                {CATEGORY_LABEL[open.category]} · {fmtDate(open.publishedAt)}
              </p>
              <p className="font-medium leading-snug">{open.hook}</p>
            </div>
            <CardShare
              articleId={open.id}
              slug={open.slug}
              title={open.hook}
              url={`${siteOrigin}/barimt/${open.slug}`}
              imageUrl={`/api/fb-image/${open.id}`}
              platforms={platforms}
              appId={appId}
            />
            <div className="flex flex-wrap gap-3 text-sm border-t border-line pt-3">
              <Link href={`/medee/${open.slug}`} className="text-accent hover:underline">
                Дэлгэрэнгүй →
              </Link>
              <Link href={`/barimt/${open.slug}`} className="text-muted hover:text-ink">
                Картын хуудас
              </Link>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="ml-auto text-muted hover:text-ink"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
