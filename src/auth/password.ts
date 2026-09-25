/**
 * Нууц үгийн hash ба шалгуур — цэвэр хэсэг (DB-гүй, тесттэй).
 *
 * bcryptjs (цэвэр JS) — контейнерт нэмэлт build хэрэггүй.
 */
import bcrypt from "bcryptjs";

/** Нууц үгийн доод урт */
export const MIN_PASSWORD = 8;

const ROUNDS = 10;

export interface PasswordProblem {
  code: "short" | "empty" | "common";
  detail: string;
}

/** Хэт түгээмэл нууц үгс — толь бичгийн халдлагад хамгийн түрүүнд ордог */
const COMMON = new Set([
  "password", "12345678", "123456789", "qwertyui", "11111111", "password1",
  "iloveyou", "sunshine", "princess", "admin123", "welcome1",
]);

/** Нууц үг болох эсэх. Хоосон массив = зүгээр. */
export function checkPassword(password: string): PasswordProblem[] {
  const p = password ?? "";
  if (!p.trim()) return [{ code: "empty", detail: "Нууц үгээ оруулна уу." }];
  const problems: PasswordProblem[] = [];
  if (p.length < MIN_PASSWORD) {
    problems.push({ code: "short", detail: `Нууц үг ${MIN_PASSWORD}-аас доошгүй тэмдэгт байх ёстой.` });
  }
  if (COMMON.has(p.toLowerCase())) {
    problems.push({ code: "common", detail: "Энэ нууц үг хэт түгээмэл байна. Өөрийг сонгоно уу." });
  }
  return problems;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
