/**
 * Нэвтрэх/бүртгэлийн хязгаарлалт — IP хаягаар.
 *
 * Newsletter-ийн энгийн in-memory хязгаарлагчийг дахин ашиглана (нэмэлт сервисгүй).
 * Процесс дахин эхлэхэд тэглэгдэнэ; хэд хэдэн instance дээр тус тусдаа тоологдоно.
 */
import { headers } from "next/headers";
import { rateLimit } from "../newsletter/rate-limit";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Нэвтрэх оролдлого: IP-ээр минутад 5 */
export const LOGIN_MAX = 5;
/** Бүртгэл: IP-ээр цагт 3 */
export const REGISTER_MAX = 3;
/** Нууц үг сэргээх хүсэлт: IP-ээр цагт 3 */
export const RESET_MAX = 3;

/** Proxy-ийн ард ажилладаг тул x-forwarded-for-ийн эхний хаягийг авна */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function allowLogin(ip?: string): Promise<boolean> {
  return rateLimit(`login:${ip ?? (await clientIp())}`, LOGIN_MAX, MINUTE_MS);
}

export async function allowRegister(ip?: string): Promise<boolean> {
  return rateLimit(`register:${ip ?? (await clientIp())}`, REGISTER_MAX, HOUR_MS);
}

export async function allowReset(ip?: string): Promise<boolean> {
  return rateLimit(`reset:${ip ?? (await clientIp())}`, RESET_MAX, HOUR_MS);
}
