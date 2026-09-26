/**
 * GET /api/health — Railway-ийн health check ба гараар шалгах хаяг.
 *
 * Буцаах утга: DB холбогдож байгаа эсэх, сүүлийн cron ажиллалтууд, дараалалд
 * хүлээж буй түүхий мэдээний тоо. DB унасан бол 503 — Railway дахин эхлүүлнэ.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/db";

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

    return NextResponse.json({
      ok: true,
      db: { ok: true, ms: dbMs },
      queue: { raw: rawCount, readyDrafts: draftReady },
      errors: errorCount,
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
