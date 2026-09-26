import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "./env";
import { PrismaClient } from "./generated/prisma/client";
import { loadEnv } from "./lib/env";
import { poolMax } from "./lib/pool.api";

// databaseUrl() уншихаас ӨМНӨ: Railway Console (SSH shell) дээр DATABASE_URL
// дутуу байдаг тул PID 1-ийн орчноос нөхнө. Тохируулсан байвал юу ч хийхгүй.
loadEnv();

/**
 * Холболтын сан.
 *
 * Postgres-ийн холболт хязгаартай (Railway-ийн жижиг план ~20–30). Вэб ба cron
 * хоёр тусдаа контейнер тул нийлбэр нь хязгаараас хэтрэхгүй байх ёстой:
 *   · web  — 10 (зэрэг ирэх хүсэлтүүд)
 *   · cron — 5  (дараалан ажилладаг, олон холболт хэрэггүй)
 * PRISMA_POOL_MAX env-ээр дарж болно.
 */
const adapter = new PrismaPg({
  connectionString: databaseUrl(),
  max: poolMax(),
  // Сул холболтыг эзэлж суухгүй — cron ажил дуусахад сан хурдан хоосруулна
  idleTimeoutMillis: 30_000,
});

export const prisma = new PrismaClient({ adapter });
