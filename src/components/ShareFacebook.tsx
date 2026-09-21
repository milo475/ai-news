"use client";

import { analytics } from "@/lib/analytics";

/** Хуваалцсан товшилтыг хэмжинэ — холбоос нь шинэ цонхонд хэвийн нээгдэнэ */
export function ShareFacebook({ slug, href }: { slug: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => analytics.shareFacebook(slug)}
      className="inline-block rounded border border-accent/50 text-accent px-3 py-1.5 text-sm hover:bg-accent/10"
    >
      Facebook-д хуваалцах
    </a>
  );
}
