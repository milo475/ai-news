/** Railway-ийн health check: DB холболт + сүүлийн ажиллалтуудын төлөв */
import { NextResponse } from "next/server";
import { prisma } from "@/db";

export const dynamic = "force-dynamic";

const JOBS = ["openrouter", "rss", "agent"] as const;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const runs = await Promise.all(
      JOBS.map(async (job) => {
        const run = await prisma.jobRun.findFirst({
          where: { job },
          orderBy: { startedAt: "desc" },
          select: { ok: true, finishedAt: true },
        });
        return [job, run && { ok: run.ok, finishedAt: run.finishedAt }] as const;
      }),
    );
    return NextResponse.json({ ok: true, db: true, lastRuns: Object.fromEntries(runs) });
  } catch (e) {
    return NextResponse.json({ ok: false, db: false, error: (e as Error).message }, { status: 503 });
  }
}
