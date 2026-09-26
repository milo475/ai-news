/**
 * Алдааг DB-д бүртгэнэ (/admin/aldaa).
 *
 * Бүртгэл өөрөө хэзээ ч хүсэлтийг унагаахгүй — бичиж чадаагүй бол зүгээр консолд
 * үлдээнэ.
 */
import { prisma } from "@/db";
import { fingerprint, messageOf, stackOf } from "./errors.api";

export interface LogErrorInput {
  /** "web" | "cron" | "action" | "api" */
  source: string;
  /** Хүсэлтийн зам эсвэл ажлын нэр */
  path?: string | null;
  error: unknown;
}

export async function logError({ source, path = null, error }: LogErrorInput): Promise<void> {
  const message = messageOf(error);
  const fp = fingerprint(source, path, message);

  try {
    await prisma.appError.upsert({
      where: { fingerprint: fp },
      // Ижил алдаа давтагдвал шинэ мөр биш — тоог нэмнэ
      update: { count: { increment: 1 }, lastAt: new Date(), message: message.slice(0, 1_000) },
      create: {
        fingerprint: fp,
        source,
        path,
        message: message.slice(0, 1_000),
        stack: stackOf(error),
      },
    });
  } catch (e) {
    console.error(`✗ алдаа бүртгэгдсэнгүй: ${(e as Error).message}`);
  }
  console.error(`✗ [${source}] ${path ?? ""} ${message}`);
}

/**
 * instrumentation.ts-д зориулсан бүртгэл.
 *
 * Тэр файлыг Next нь Node ба Edge хоёуланд bundle хийдэг тул түүн дотроос Prisma-г
 * импортлох боломжгүй (edge дээр `node:path` зэрэг байхгүй). Иймд Node талд ажиллаж
 * байгаа модуль өөрөө функцээ globalThis дээр тавьж, instrumentation нь зөвхөн
 * тэндээс уншина — импорт байхгүй тул bundle-д нэмэгдэхгүй.
 */
declare global {
  // eslint-disable-next-line no-var
  var __aiNewsLogError: ((input: LogErrorInput) => Promise<void>) | undefined;
}
globalThis.__aiNewsLogError = logError;

/** Сүүлийн алдаанууд — /admin/aldaa */
export async function recentErrors(limit = 50) {
  return prisma.appError.findMany({
    orderBy: { lastAt: "desc" },
    take: limit,
    select: {
      id: true, source: true, path: true, message: true, stack: true,
      count: true, lastAt: true, createdAt: true,
    },
  });
}

export async function clearErrors(): Promise<number> {
  const r = await prisma.appError.deleteMany({});
  return r.count;
}

/** Хамгийн сүүлд бүртгэгдсэн алдаа — /admin нүүрний самбарт */
export async function lastError() {
  return prisma.appError.findFirst({
    orderBy: { lastAt: "desc" },
    select: { source: true, path: true, message: true, count: true, lastAt: true },
  });
}
