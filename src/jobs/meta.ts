/**
 * JobRun үүсгэхэд процесс/логийн мэдээлэл — /admin-аас эхлүүлсэн ажлыг хөөж харахад.
 * JOB_MODE-ийг pipeline тавьдаг (PUBLISH | PREPARE) тул алхам бүрийн мөрөнд горим үлдэнэ.
 */
export function jobRunMeta(): { pid: number; logFile: string | null; mode: string | null } {
  return { pid: process.pid, logFile: process.env.JOB_LOG_FILE ?? null, mode: process.env.JOB_MODE ?? null };
}
