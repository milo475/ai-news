/**
 * `npm run bench:status` — бенчмаркийн төлвийг ЗӨВХӨН УНШИЖ харуулна.
 *
 * DB-д юу ч бичихгүй. «Яагаад /benchmark хоосон байна», «яагаад cron алгасаж
 * байна» гэдгийг production дээр аюулгүй шалгах команд.
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { currentMonth } from "./summary.api";
import { decideStart, isMeasured } from "./status.api";
import { dailyHour } from "../jobs/mode.api";
import { ubHour } from "../publish/slot.api";

export async function benchStatus(now = new Date()) {
  const month = currentMonth(now);
  const day = new Date(now.getTime() + 8 * 3_600_000).getUTCDate();

  const runs = await prisma.benchRun.findMany({
    orderBy: { month: "desc" },
    take: 6,
    select: {
      month: true, status: true, startedAt: true, finishedAt: true, costUsd: true, note: true,
      _count: { select: { results: true, summaries: true } },
    },
  });

  const jobs = await prisma.jobRun.findMany({
    where: { job: "bench" },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: { startedAt: true, finishedAt: true, ok: true, costUsd: true, error: true },
  });

  const current = runs.find((r) => r.month === month) ?? null;
  const decision = decideStart({
    status: current?.status ?? null,
    finishedAt: current?.finishedAt ?? null,
    now, day, ubHour: ubHour(now), dailyHour: dailyHour(),
  });

  return { month, day, runs, jobs, current, decision };
}

if (isEntry("status.ts")) {
  await runCli(async () => {
    const s = await benchStatus();
    console.log(`Одоогийн сар: ${s.month} (УБ ${s.day}-ны өдөр)\n`);

    console.log("BenchRun-ууд:");
    if (s.runs.length === 0) console.log("  (алга)");
    for (const r of s.runs) {
      const mark = isMeasured(r.status) ? "✓" : r.status === "RUNNING" ? "…" : "✗";
      console.log(
        `  ${mark} ${r.month}  ${r.status.padEnd(8)} ` +
          `үр дүн ${String(r._count.results).padStart(4)} · дүгнэлт ${String(r._count.summaries).padStart(3)} · ` +
          `$${r.costUsd.toFixed(3)}`,
      );
      console.log(
        `      эхэлсэн ${r.startedAt.toISOString().slice(0, 16)}` +
          (r.finishedAt ? ` · дууссан ${r.finishedAt.toISOString().slice(0, 16)}` : " · дуусаагүй"),
      );
      if (r.note) console.log(`      тэмдэглэл: ${r.note.slice(0, 160)}`);
    }

    console.log("\nСүүлийн JobRun-ууд (bench):");
    if (s.jobs.length === 0) console.log("  (алга)");
    for (const j of s.jobs) {
      console.log(
        `  ${j.ok ? "✓" : "✗"} ${j.startedAt.toISOString().slice(0, 16)} · $${(j.costUsd ?? 0).toFixed(3)}` +
          (j.error ? ` · ${j.error.slice(0, 120)}` : ""),
      );
    }

    console.log("\nДараагийн cron юу хийх вэ:");
    console.log(
      s.decision.go
        ? `  ▶ АЖИЛЛАНА — ${s.decision.detail}${s.decision.resume ? " (үргэлжлэл)" : ""}`
        : `  ⊘ алгасна — ${s.decision.skip}: ${s.decision.detail}`,
    );

    if (s.current && !isMeasured(s.current.status) && s.current._count.summaries === 0) {
      console.log(
        `\n⚠ ${s.month}-ийн run нь ${s.current.status} бөгөөд дүгнэлтгүй — /benchmark хоосон харагдана.`,
      );
      console.log(`  Цэвэрлэх: npm run bench:reset -- --month ${s.month} --yes`);
    }
  });
}
