import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
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
