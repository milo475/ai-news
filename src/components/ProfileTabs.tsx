"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profile", label: "Ерөнхий" },
  { href: "/profile/hadgalsan", label: "Хадгалсан" },
  { href: "/profile/sonirhol", label: "Сонирхол" },
  { href: "/profile/prompt", label: "Миний prompt" },
  { href: "/profile/ayuulgui", label: "Аюулгүй байдал" },
] as const;

export function ProfileTabs() {
  const path = usePathname();

  return (
    <nav className="flex gap-4 text-sm border-b border-line overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`pb-2 -mb-px border-b-2 whitespace-nowrap ${
            path === t.href ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
