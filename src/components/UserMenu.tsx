"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Нэвтэрсэн хэрэглэгчийн цэс — нэр/зураг дээр дарахад Профайл, Гарах */
export function UserMenu({
  name,
  email,
  image,
  signOut,
}: {
  name: string | null;
  email: string;
  image: string | null;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const label = name?.trim() || email.split("@")[0]!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-line/40"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="w-6 h-6 rounded-full" />
        ) : (
          <span className="w-6 h-6 rounded-full bg-accent text-white grid place-items-center text-xs uppercase">
            {label.slice(0, 1)}
          </span>
        )}
        <span className="hidden sm:inline max-w-28 truncate">{label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-lg border border-line bg-paper shadow-lg p-1 z-20"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded px-3 py-2 text-sm hover:bg-line/40"
          >
            Профайл
          </Link>
          <form action={signOut}>
            <button role="menuitem" className="w-full text-left rounded px-3 py-2 text-sm hover:bg-line/40">
              Гарах
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
