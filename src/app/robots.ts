import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** SITE_URL-ийг build-д шатаахгүй — домэйн солиход env өөрчлөхөд л хангалттай */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const site = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        // Зургийн эндпойнтууд нь og:image ба JSON-LD-д ордог тул хаавал rich result алдагдана.
        // Google нь хамгийн урт таарсан дүрмийг сонгодог учир эдгээр Allow нь /api/ Disallow-ыг дарна.
        allow: ["/", "/api/guide-image/", "/api/hero-image/", "/api/fb-image/", "/api/og/"],
        // /admin нь Basic auth-тай ч индексэд оруулах шаардлагагүй; үлдсэн /api нь хүнд зориулаагүй.
        // /hailt нь хязгааргүй олон хаяг үүсгэдэг (?q=...) — crawl budget-ыг дэмий үрнэ.
        disallow: ["/admin", "/api/", "/profile", "/nevtreh", "/burtguuleh", "/hailt", "/batalgaajuulah"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
