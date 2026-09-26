/**
 * Процессийн үүргээс хамаарсан холболтын сангийн хэмжээ — цэвэр функц, тесттэй.
 */

export const WEB_POOL = 10;
export const CRON_POOL = 5;
/** Тест, seed, гар ажиллагаа — аль болох бага */
export const SCRIPT_POOL = 3;

/**
 * Cron контейнер нь `tsx src/pipeline.ts`-ээр ажилладаг (Next биш) тул
 * `NEXT_RUNTIME`/`__NEXT_PRIVATE_*` байхгүй. Үүрэг нь ROLE env-ээр давж тодорхойлогдоно.
 */
export function processRole(env = process.env): "web" | "cron" | "script" {
  const explicit = (env.APP_ROLE ?? "").trim().toLowerCase();
  if (explicit === "web" || explicit === "cron" || explicit === "script") return explicit;
  if (env.NEXT_RUNTIME || env.NEXT_PHASE) return "web";
  return "script";
}

export function poolMax(env = process.env): number {
  const explicit = Number(env.PRISMA_POOL_MAX);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const role = processRole(env);
  return role === "web" ? WEB_POOL : role === "cron" ? CRON_POOL : SCRIPT_POOL;
}
