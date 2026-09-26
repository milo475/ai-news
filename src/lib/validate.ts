/**
 * Server action-уудын оролтыг шалгах нийтлэг схемүүд (zod).
 *
 * Server action бүр нь нээлттэй HTTP endpoint — хэн ч дурын утга илгээж чадна.
 * Тиймээс UI-д ямар талбар байгаагаас үл хамааран сервер талд ЗААВАЛ шалгана.
 */
import { z } from "zod";

/** Prisma-ийн cuid — `c` + 24 орчим тэмдэгт. cuid2 ч багтаана. */
export const cuid = z.string().trim().min(8).max(64).regex(/^[a-z0-9]+$/i, "буруу id");

/** Хаягийн slug: жижиг үсэг, тоо, зураас, ташуу зураас (модель: "openai/gpt-4") */
export const slug = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[-/.][a-z0-9]+)*$/i, "буруу slug");

/** Богино текст талбар */
export const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Заавал биш текст — хоосон мөрийг undefined болгоно */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? undefined : s))
    .optional();

export const email = z.string().trim().toLowerCase().email("имэйл буруу").max(254);

export const httpUrl = z
  .string()
  .trim()
  .max(2_000)
  .url("холбоос буруу")
  .refine((u) => /^https?:\/\//i.test(u), "зөвхөн http(s)");

/** Сайтын доторх зам — задарсан хаяг руу шилжүүлэхээс сэргийлнэ */
export const internalPath = z
  .string()
  .trim()
  .max(512)
  .refine((p) => p.startsWith("/") && !p.startsWith("//"), "дотоод зам байх ёстой");

/** Checkbox — "on" | "true" | "1" */
export const checkbox = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true" || v === "1");

/** Таслалаар эсвэл мөрөөр тусгаарласан жагсаалт */
export const csvList = (max = 20, itemMax = 60) =>
  z
    .string()
    .trim()
    .max(2_000)
    .transform((s) =>
      [...new Set(s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))]
        .map((x) => x.slice(0, itemMax))
        .slice(0, max),
    );

export interface ParseOk<T> {
  ok: true;
  data: T;
}
export interface ParseFail {
  ok: false;
  /** Хэрэглэгчид үзүүлэх нэг мөр */
  error: string;
  /** Талбар бүрийн алдаа */
  fields: Record<string, string>;
}

/** Zod-ийн алдааг монгол, нэг мөр болгоно */
export function firstError(e: z.ZodError): string {
  const issue = e.issues[0];
  if (!issue) return "Өгөгдөл буруу байна.";
  return issue.message;
}

function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const key = i.path.join(".") || "_";
    out[key] ??= i.message;
  }
  return out;
}

/** FormData-г схемээр шалгана */
export function parseForm<S extends z.ZodTypeAny>(
  schema: S,
  form: FormData,
): ParseOk<z.infer<S>> | ParseFail {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    // Файл энэ төсөлд байхгүй — зөвхөн мөр
    if (typeof v === "string") raw[k] = v;
  }
  const r = schema.safeParse(raw);
  return r.success
    ? { ok: true, data: r.data }
    : { ok: false, error: firstError(r.error), fields: fieldErrors(r.error) };
}

/**
 * Аргументаар ирсэн утгыг шалгана. Буруу бол алдаа шиднэ — эдгээр нь UI-аас
 * хэзээ ч буруу ирэхгүй утгууд (id, slug), тиймээс алдаа нь халдлагын шинж.
 */
export function parseArg<S extends z.ZodTypeAny>(schema: S, value: unknown, what = "утга"): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error(`Буруу ${what}: ${firstError(r.error)}`);
  return r.data;
}

/** Буруу бол алдаа шидэхгүй, null буцаана — тоолуур зэрэг чимээгүй action-д */
export function tryParse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> | null {
  const r = schema.safeParse(value);
  return r.success ? r.data : null;
}

export { z };

/**
 * Формын `id` талбарыг cuid гэж шалгана.
 *
 * Админы формууд нь /admin доор Basic auth-ийн ард байдаг ч id-г шалгах нь
 * гарын үсгийн алдаа, буруу форм илгээхэд ойлгомжтой алдаа өгнө (Prisma-ийн
 * "Record not found" биш).
 */
export function formId(form: FormData, field = "id"): string {
  return parseArg(cuid, String(form.get(field) ?? ""), field);
}
