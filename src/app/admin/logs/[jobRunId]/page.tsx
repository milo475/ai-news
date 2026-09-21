import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Ажлын лог" };

const TAIL_LINES = 200;

export default async function JobLog({ params }: { params: Promise<{ jobRunId: string }> }) {
  const run = await prisma.jobRun.findUnique({ where: { id: (await params).jobRunId } });
  if (!run) notFound();

  let text = "";
  if (!run.logFile) {
    text = "Энэ ажлыг /admin-аас эхлүүлээгүй тул лог файл алга (cron эсвэл гараар ажиллуулсан).";
  } else {
    try {
      // Замыг logs/ дотор барина — jobRunId-аар л хандаж байгаа ч давхар шалгалт
      const file = join(process.cwd(), "logs", run.logFile.replace(/^logs[/\\]/, ""));
      const all = await readFile(file, "utf8");
      text = all.split("\n").slice(-TAIL_LINES).join("\n").trim() || "(лог хоосон)";
    } catch (e) {
      text = `Лог уншигдсангүй: ${(e as Error).message}`;
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
      <h1 className="text-xl font-semibold tracking-tight">
        {run.job} · {run.startedAt.toISOString().slice(0, 16).replace("T", " ")}
        {!run.finishedAt && <span className="text-accent text-sm font-normal"> · ажиллаж байна</span>}
      </h1>
      <p className="text-xs text-muted">
        pid {run.pid ?? "—"} · {run.logFile ?? "лог файлгүй"} · сүүлийн {TAIL_LINES} мөр
      </p>
      {!run.finishedAt && <meta httpEquiv="refresh" content="10" />}
      <pre className="rounded-lg border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words">
        {text}
      </pre>
    </div>
  );
}
