/**
 * GET /api/health — Railway-ийн health check ба гараар шалгах хаяг.
 *
 * Буцаах утга: DB холбогдож байгаа эсэх, сүүлийн cron ажиллалтууд, дараалалд
 * хүлээж буй түүхий мэдээний тоо. DB унасан бол 503 — Railway дахин эхлүүлнэ.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/db";
import { levelOf, openRouterBalance } from "@/lib/balance";

export const dynamic = "force-dynamic";

const JOBS = ["openrouter", "rss", "agent", "publish", "pipeline"] as const;

/** Сүүлийн ажиллалт хэр хуучирсан бэ (минутаар) */
function minutesSince(d: Date | null): number | null {
  return d ? Math.round((Date.now() - d.getTime()) / 60_000) : null;
}

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - started;

    const [runs, rawCount, draftReady, errorCount] = await Promise.all([
      Promise.all(
        JOBS.map(async (job) => {
          const run = await prisma.jobRun.findFirst({
            where: { job },
            orderBy: { startedAt: "desc" },
            select: { ok: true, startedAt: true, finishedAt: true },
          });
          return [
            job,
            run && {
              ok: run.ok,
              finishedAt: run.finishedAt,
              minutesAgo: minutesSince(run.finishedAt ?? run.startedAt),
              running: run.finishedAt === null,
            },
          ] as const;
        }),
      ),
      prisma.article.count({ where: { status: "RAW" } }),
      prisma.article.count({ where: { status: "DRAFT", readyAt: { not: null } } }),
      prisma.appError.count(),
    ]);

    // Хамгийн сүүлд ямар нэг ажил ажилласан хугацаа — cron амьд эсэхийн шалгуур
    const lastAny = await prisma.jobRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { job: true, startedAt: true, finishedAt: true, ok: true },
    });

    // Сүүлийн 24 цагт унасан ажлууд. Туслах алхам унавал pipeline нь exit 0 өгдөг
    // (Railway улаан болохгүй) тул ЭНД харагдах нь чухал.
    const failed = await prisma.jobRun.groupBy({
      by: ["job"],
      where: { ok: false, startedAt: { gte: new Date(Date.now() - 86_400_000) } },
      _count: { _all: true },
    });

    // Кредит дуусах нь cron-ийг чимээгүйхэн зогсоодог тул health-д харагдах ёстой.
    // 10 минут кэшлэгддэг — health check олон дуудагддаг ч OpenRouter-д ачаалал өгөхгүй.
    const balance = await openRouterBalance();

    return NextResponse.json({
      ok: true,
      db: { ok: true, ms: dbMs },
      openrouterBalance: balance === null
        ? { usd: null, level: "unknown" }
        : { usd: Math.round(balance * 100) / 100, level: levelOf(balance) },
      queue: { raw: rawCount, readyDrafts: draftReady },
      errors: errorCount,
      failedJobs: Object.fromEntries(failed.map((f) => [f.job, f._count._all])),
      lastRun: lastAny && {
        job: lastAny.job,
        ok: lastAny.ok,
        minutesAgo: minutesSince(lastAny.finishedAt ?? lastAny.startedAt),
      },
      lastRuns: Object.fromEntries(runs),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: { ok: false }, error: (e as Error).message },
      { status: 503 },
    );
  }
}
