/**
 * Ажлын түгжээ — нэг ажлыг нэг л процесс ажиллуулна.
 *
 * 2026-09-28: гараар ажиллуулсан `npm run bench` ба cron-ы үргэлжлүүлэх алхам
 * НЭГ run дээр зэрэг бичээд «Unique constraint failed on
 * BenchResult_runId_modelSlug_taskId_key» гаргаж, run бүхэлдээ FAILED болсон.
 *
 * Postgres-ийн advisory lock БИШ: Prisma нь холболтын сан (pool) ашигладаг тул
 * `pg_try_advisory_lock` нь нэг session дотор дахин авагддаг ба суллах нь өөр
 * холболт дээр очиж болно (хэмжиж баталгаажуулсан). Тиймээс мөрийн түгжээ:
 * атомарх `INSERT ... ON CONFLICT DO UPDATE WHERE heartbeat хуучирсан`.
 */
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";

/** Цохилт хийхээ больсноос хойш энэ хугацааны дараа түгжээг булааж болно */
export const LOCK_TTL_MIN = 25;

/** Цохилтын давтамж — TTL-ээс хамаагүй богино */
export const HEARTBEAT_MS = 60_000;

export function ownerId(): string {
  return `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
}

/** Цохилт дараалан хэдэн удаа унавал түгжээг алдагдсан гэж үзэх вэ */
export const HEARTBEAT_FAILS = 3;

export interface Lock {
  name: string;
  owner: string;
  /**
   * Түгжээ алдагдсан эсэх.
   *
   * · цохилт 0 мөр шинэчилсэн (өөр процесс булаасан), эсвэл
   * · цохилт дараалан 3 удаа унасан (DB хүрэхгүй).
   *
   * Ажил үүнийг дараагийн алхмынхаа ӨМНӨ шалгаж, үнэн бол дүгнэлт, DRAFT
   * бичилгүй зогсоно — булаагдсан процесс шинэ эзэмшигчтэй мөргөлдөх ёсгүй.
   */
  lost: () => boolean;
  release: () => Promise<void>;
}

/**
 * Түгжээ авах оролдлого. Өөр процесс барьж байвал **null**.
 *
 * Атомарх: түгжээ байхгүй бол шинээр үүснэ; байгаа ч цохилт нь хуучирсан бол
 * (процесс унасан) булаана. Шинэхэн түгжээтэй бол `WHERE` нөхцөл биелэхгүй тул
 * мөр буцахгүй — хоёр процесс зэрэг оролдоход зөвхөн НЭГ нь авна.
 */
export async function tryLock(
  name: string,
  ttlMin = LOCK_TTL_MIN,
  heartbeatMs = HEARTBEAT_MS,
): Promise<Lock | null> {
  const owner = ownerId();
  const now = new Date();
  // Хугацааг JS-ээс бэлдэнэ: `${n} * interval '1 minute'` нь параметржүүлэхэд
  // найдваргүй ажилласан (шинэхэн түгжээг булаачихаж байв).
  const cutoff = new Date(now.getTime() - ttlMin * 60_000);

  const rows = await prisma.$queryRaw<{ lockedBy: string }[]>`
    INSERT INTO "JobLock" ("name", "lockedBy", "lockedAt", "heartbeatAt")
    VALUES (${name}, ${owner}, ${now}, ${now})
    ON CONFLICT ("name") DO UPDATE
      SET "lockedBy" = EXCLUDED."lockedBy",
          "lockedAt" = EXCLUDED."lockedAt",
          "heartbeatAt" = EXCLUDED."heartbeatAt"
      WHERE "JobLock"."heartbeatAt" < ${cutoff}
    RETURNING "lockedBy"
  `;
  if (rows[0]?.lockedBy !== owner) return null;

  // Амьд байгаагаа мэдэгдэнэ — урт ажил дундуур түгжээ хуучрахгүй.
  // Цохилт нь ӨӨРИЙН эзэмшлийг шалгана: 0 мөр шинэчлэгдвэл түгжээ булаагдсан.
  let lost = false;
  let fails = 0;

  const beat = async (): Promise<void> => {
    try {
      const r = await prisma.jobLock.updateMany({
        where: { name, lockedBy: owner },
        data: { heartbeatAt: new Date() },
      });
      if (r.count === 0) {
        lost = true;
        console.warn(`  ⚠ «${name}» түгжээ алдагдлаа — өөр процесс булаасан байна`);
        return;
      }
      fails = 0;
    } catch (e) {
      fails += 1;
      console.warn(`  ⚠ «${name}» цохилт ${fails}/${HEARTBEAT_FAILS}: ${(e as Error).message.slice(0, 80)}`);
      if (fails >= HEARTBEAT_FAILS) lost = true;
    }
  };

  const timer = setInterval(() => void beat(), heartbeatMs);
  timer.unref?.();

  return {
    name,
    owner,
    lost: () => lost,
    release: async () => {
      clearInterval(timer);
      try {
        // Зөвхөн ӨӨРИЙН түгжээг суллана — булаагдсан бол хөндөхгүй.
        // Хэсэг дуусмагц суллах нь чухал: 00:20-д дууссан ажлын түгжээ 00:30-ын
        // cron-д «10 минутын настай, шинэхэн» гэж харагдаж алгасуулна.
        await prisma.jobLock.deleteMany({ where: { name, lockedBy: owner } });
      } catch (e) {
        // Суллалт унах нь ажлыг унагаах ёсгүй — TTL нь нөөц хамгаалалт
        console.warn(`  ⚠ «${name}» түгжээ суллагдсангүй: ${(e as Error).message.slice(0, 80)}`);
      }
    },
  };
}

/** Түгжээг хэн барьж байгаа — оношилгоонд */
export async function lockHolder(name: string) {
  return prisma.jobLock.findUnique({ where: { name } });
}

/**
 * Түгжээтэйгээр ажиллуулна. Авч чадаагүй бол `null` — дуудагч нь «өөр процесс
 * ажиллаж байна» гэж мэдэгдэнэ.
 */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  const lock = await tryLock(name);
  if (!lock) return null;
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
