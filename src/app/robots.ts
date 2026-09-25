import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const site = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        // Зургийн эндпойнтууд нь og:image ба JSON-LD-д ордог тул хаавал rich result алдагдана.
        // Google нь хамгийн урт таарсан дүрмийг сонгодог учир эдгээр Allow нь /api/ Disallow-ыг дарна.
        allow: ["/", "/api/guide-image/", "/api/hero-image/", "/api/fb-image/", "/api/og/"],
        // /admin нь Basic auth-тай ч индексэд оруулах шаардлагагүй; үлдсэн /api нь хүнд зориулаагүй
        disallow: ["/admin", "/api/", "/profile", "/nevtreh", "/burtguuleh"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
