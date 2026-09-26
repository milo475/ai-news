"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Гар утасны цэс — 8 хэсэг «Бусад» товчны доор эвхэгдэнэ.
 *
 * Явган нарын (hamburger) оронд бичигтэй товч: юу нээгдэхийг таахгүйгээр мэднэ.
 * Зөвхөн `md`-ээс доош харагдана; ширээний компьютерт layout нь ердийн nav-ыг үзүүлнэ.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Хуудас солигдоход цэс хаагдана
  useEffect(() => setOpen(false), [pathname]);

  // Цэс нээлттэй үед ард нь гүйлгэхгүй
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="flex h-9 items-center gap-1 rounded-md border border-line px-2.5 text-sm text-ink"
      >
        Бусад
        <svg
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={open ? "rotate-180" : ""}
        >
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto border-t border-line bg-paper"
        >
          <nav className="mx-auto max-w-6xl px-4 py-2">
            <ul className="divide-y divide-line">
              {items.map((n) => {
                const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`block py-3.5 text-base ${active ? "text-accent font-semibold" : "text-ink"}`}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
