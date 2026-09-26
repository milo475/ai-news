/**
 * Орчны хувьсагчийг үйлчилгээний үндсэн процессоос (PID 1) нөхнө.
 *
 * Яагаад: Railway-ийн Console (SSH shell) нь **service-ийн Variables-ийг өгдөггүй** —
 * тэнд гараар `npm run seed:tools` гэх мэтийг ажиллуулахад `OPENROUTER_API_KEY`
 * хоосон болж, OpenRouter 401 буцаадаг. Контейнер дотор PID 1 нь тухайн
 * үйлчилгээний өөрийнх нь процесс (`next start` эсвэл `tsx src/pipeline.ts`) тул
 * `/proc/1/environ`-д ЯГ тэр хувьсагчид байна.
 *
 * Дүрэм:
 *   · зөвхөн Linux дээр (`/proc` байхгүй бол чимээгүй гарна)
 *   · зөвхөн ЗААВАЛ хэрэгтэй хувьсагчийн аль нэг нь дутуу үед уншина
 *   · аль хэдийн тохируулсан утгыг **хэзээ ч дарж бичихгүй** (.env давуу)
 *   · алдааг залгина — энэ нь тусламж болохоос шаардлага биш
 *   · утгыг хэвлэхгүй, зөвхөн НЭРИЙГ нь
 */
import { readFileSync } from "node:fs";

/** Эдгээрийн аль нэг дутуу бол PID 1-ээс уншина */
export const REQUIRED_KEYS = ["DATABASE_URL", "OPENROUTER_API_KEY"] as const;

/** Процесс тус бүрт хамаарах хувьсагчид — хуулбарлах нь буруу */
const PROCESS_LOCAL = new Set(["PWD", "OLDPWD", "SHLVL", "_", "TERM", "HOSTNAME"]);

export const INIT_ENVIRON_PATH = "/proc/1/environ";

/** `/proc/<pid>/environ` нь NUL-аар тусгаарласан `KEY=VALUE` жагсаалт */
export function parseEnviron(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of raw.split("\0")) {
    if (!entry) continue;
    const i = entry.indexOf("=");
    // "=VALUE" гэсэн нэргүй бичлэгийг алгасна
    if (i <= 0) continue;
    out[entry.slice(0, i)] = entry.slice(i + 1);
  }
  return out;
}

/** Хоосон мөр ч «дутуу»-д тооцогдоно */
export function missingKeys(
  env: Record<string, string | undefined>,
  keys: readonly string[] = REQUIRED_KEYS,
): string[] {
  return keys.filter((k) => !(env[k] ?? "").trim());
}

/**
 * `source`-оос `env`-д дутуу хувьсагчдыг нөхнө. Цэвэр функц — тесттэй.
 * @returns нэмэгдсэн хувьсагчдын нэр
 */
export function fillMissing(
  env: Record<string, string | undefined>,
  source: Record<string, string>,
): string[] {
  const added: string[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (!value || PROCESS_LOCAL.has(key)) continue;
    if ((env[key] ?? "") !== "") continue;
    env[key] = value;
    added.push(key);
  }
  return added;
}

export interface HydrateOptions {
  env?: Record<string, string | undefined>;
  path?: string;
  /** Тестэд файл унших оронд шууд өгнө */
  read?: (path: string) => string;
  platform?: string;
}

/** @returns нэмэгдсэн хувьсагчдын нэр (юу ч хийгээгүй бол хоосон) */
export function hydrateEnv(opts: HydrateOptions = {}): string[] {
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;

  if (missingKeys(env).length === 0) return [];
  if (platform !== "linux") return [];

  let raw: string;
  try {
    raw = (opts.read ?? ((p: string) => readFileSync(p, "utf8")))(opts.path ?? INIT_ENVIRON_PATH);
  } catch {
    // /proc байхгүй, эрх хүрэхгүй, PID 1 өөр эзэнтэй — алийг нь ч засах боломжгүй
    return [];
  }

  return fillMissing(env, parseEnviron(raw));
}

let loaded = false;

/**
 * CLI скриптүүдийн эхэнд дуудна (`import "dotenv/config"`-ийн ДАРАА).
 * Олон газраас дуудагдаж болно — нэг л удаа ажиллана.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const added = hydrateEnv();
  if (added.length === 0) return;

  // Зөвхөн НЭР — утгыг хэзээ ч хэвлэхгүй.
  // Дутуу хэвээр байвал src/env.ts нь дуудагдахдаа өөрөө ойлгомжтой алдаа өгнө.
  const filled = REQUIRED_KEYS.filter((k) => added.includes(k));
  console.log(
    `ℹ env: PID 1-ийн орчноос ${added.length} хувьсагч нөхлөө` +
      (filled.length > 0 ? ` — ${filled.join(", ")}` : ""),
  );
}

/** Тестэд байдлыг сэргээнэ */
export function resetLoaded(): void {
  loaded = false;
}
