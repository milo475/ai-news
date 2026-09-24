/**
 * /admin-аас ажлыг ард нь эхлүүлнэ.
 *
 * Server action дотор pipeline-ийг шууд await хийвэл HTTP timeout болно (agent 5–10 мин),
 * тиймээс тусдаа процесс болгож салгаж (detached) явуулаад лог файл руу бичүүлнэ.
 */
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../db";

export const JOB_NAMES = [
  "rss", "agent", "improve", "publish", "instagram", "openrouter", "arena", "digest", "newsletter",
  "pipeline",
] as const;
export type JobName = (typeof JOB_NAMES)[number];

/** pipeline нь хэд хэдэн JobRun үүсгэдэг тул бүгдийг нь шалгана */
const JOB_ROWS: Record<JobName, string[]> = {
  rss: ["rss"],
  agent: ["agent"],
  improve: ["improve"],
  publish: ["publish"],
  instagram: ["instagram"],
  openrouter: ["openrouter"],
  arena: ["arena"],
  digest: ["digest"],
  newsletter: ["newsletter"],
  pipeline: [
    "pipeline", "openrouter", "arena", "rss", "agent", "improve", "publish", "instagram",
    "digest", "newsletter",
  ],
};

/** Үүнээс удвал процесс нь үхсэн гэж үзнэ */
const STALE_MS = 30 * 60_000;

export async function startJob(name: JobName): Promise<{ started: boolean; reason?: string }> {
  // Дуусаагүй хуучин бүртгэлийг хаана — эс бөгөөс тэр job үүрд "ажиллаж байна" гэж гацна
  await prisma.jobRun.updateMany({
    where: { finishedAt: null, startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { finishedAt: new Date(), ok: false, error: "timeout — процесс дуусаагүй" },
  });

  const running = await prisma.jobRun.findFirst({
    where: { job: { in: JOB_ROWS[name] }, finishedAt: null },
    select: { job: true },
  });
  if (running) return { started: false, reason: `${running.job} аль хэдийн ажиллаж байна` };

  mkdirSync(join(process.cwd(), "logs"), { recursive: true });
  const logFile = join("logs", `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
  const fd = openSync(join(process.cwd(), logFile), "a");
  try {
    const child = spawn("npx", ["tsx", "src/pipeline.ts", "--only", name], {
      detached: true,
      stdio: ["ignore", fd, fd],
      cwd: process.cwd(),
      // JOB_LOG_FILE-ээр дамжуулж алхам бүрийн JobRun-д лог файлын замыг бичнэ
      env: { ...process.env, JOB_LOG_FILE: logFile },
    });
    child.unref();
  } finally {
    closeSync(fd);
  }

  return { started: true };
}
