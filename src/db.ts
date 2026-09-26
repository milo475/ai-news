import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "./env";
import { PrismaClient } from "./generated/prisma/client";
import { poolMax } from "./lib/pool.api";

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
