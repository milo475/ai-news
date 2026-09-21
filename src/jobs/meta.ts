/** JobRun үүсгэхэд процесс/логийн мэдээлэл — /admin-аас эхлүүлсэн ажлыг хөөж харахад */
export function jobRunMeta(): { pid: number; logFile: string | null } {
  return { pid: process.pid, logFile: process.env.JOB_LOG_FILE ?? null };
}
