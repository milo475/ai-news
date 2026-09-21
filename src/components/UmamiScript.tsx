"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import type { UmamiConfig } from "@/lib/analytics";

/**
 * Umami-гийн tracker. /admin доорх хуудсууд редакторын ажлын талбар тул
 * тэнд огт ачаалахгүй — статистик зөвхөн олон нийтийн хуудсыг хэмжинэ.
 */
export function UmamiScript({ src, websiteId }: UmamiConfig) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <Script
      src={src}
      data-website-id={websiteId}
      strategy="afterInteractive"
      data-exclude-search="true"
    />
  );
}
