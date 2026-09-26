/**
 * CLI скриптүүдийн нийтлэг бүрхүүл.
 *
 * Хариуцах зүйл:
 *   · env-ийг PID 1-ээс нөхөх (Railway Console) — `loadEnv()`
 *   · алдааг богино, ойлгомжтой хэвлэх (stack биш; DEBUG=1 бол бүтнээр)
 *   · түлхүүрийн алдааг тусад нь тайлбарлах — дахин оролдох нь утгагүй
 *   · Prisma-гаа салгаж, **exit code 1** өгөх (cron, CI үүнийг л хардаг)
 */
import { isAuthError } from "../agent/llm";
import { loadEnv } from "./env";

export async function runCli(fn: () => Promise<void>): Promise<void> {
  loadEnv();
  const { prisma } = await import("../db");

  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n✗ ${msg}`);
    if (isAuthError(e)) {
      console.error(
        "  Бүх дуудлага ижил унах тул зогслоо. OPENROUTER_API_KEY-г шалгана уу —\n" +
          "  Railway Console (SSH) нь үйлчилгээний Variables-ыг автоматаар өгдөггүй.",
      );
    } else if (process.env.DEBUG) {
      console.error(e);
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$disconnect();
}
