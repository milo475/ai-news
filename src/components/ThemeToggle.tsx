"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Одоогийн бодит горим: гар сонголт байвал түүнийг, үгүй бол системийнхийг */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  // Сервер дээр аль горим болохыг мэдэхгүй — hydrate хийсний дараа тодорхой болно
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // private горимд хадгалагдахгүй — тухайн хуудсанд л ажиллана
    }
    setTheme(next);
  }

  const label = theme === "dark" ? "Цайвар горимд шилжих" : "Бараан горимд шилжих";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="shrink-0 rounded border border-line p-1.5 text-muted hover:text-ink hover:bg-line/40"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
