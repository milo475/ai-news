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

/**
 * Энэ файл нь шууд ажиллуулсан скрипт мөн үү.
 *
 * `endsWith("card.ts")` нь **recard.ts**-д ч үнэн болдог — card.ts-ийн CLI нь recard-ыг
 * ажиллуулахад дундуур нь орж ирж байсан. Тиймээс файлын нэрийг бүтнээр нь харьцуулна.
 */
export function isEntry(fileName: string, argv = process.argv): boolean {
  const path = argv[1] ?? "";
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base === fileName;
}

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
        e.kind === "credits"
          ? "  Бүх LLM дуудлага ижил унах тул зогслоо. openrouter.ai/settings/credits\n" +
            "  дээр үлдэгдлээ шалгаж цэнэглэнэ үү."
          : "  Бүх дуудлага ижил унах тул зогслоо. OPENROUTER_API_KEY-г шалгана уу —\n" +
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
