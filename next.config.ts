import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Серверийн хувилбарыг зарлахгүй
  poweredByHeader: false,
  images: {
    // AVIF нь WebP-ээс ~20% бага — хөтөч дэмжвэл эхэлж түүнийг өгнө
    formats: ["image/avif", "image/webp"],
    // Зургууд нь DB дэх тогтмол агуулга — удаан кэшлэнэ
    minimumCacheTTL: 31_536_000,
    // Бидний хэрэглэдэг бодит хэмжээнүүд — илүү вариант үүсгэхгүй
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1920],
    imageSizes: [96, 128, 160, 192, 220, 256, 384],
  },
  async redirects() {
    return [
      // «Аргачлал» хуудас 2026-09-25-нд хасагдсан — эх сурвалжийн тайлбар нь
      // жагсаалтын хуудасны доод талд үлдсэн
      // 301 (308 биш) — хуучин холбоосууд хайлтын системд ингэж шилждэг
      { source: "/argachlal", destination: "/", statusCode: 301 },
    ];
  },
};

export default config;
