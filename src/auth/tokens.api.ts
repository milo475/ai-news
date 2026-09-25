/**
 * Токенуудын цэвэр хэсэг (DB-гүй тул тесттэй).
 */

export type TokenPurpose = "verify" | "reset";

/** Баталгаажуулах холбоос хэдэн цаг хүчинтэй */
export const VERIFY_HOURS = 24;
/** Нууц үг сэргээх холбоос хэдэн цаг хүчинтэй */
export const RESET_HOURS = 1;

/** VerificationToken.identifier — нэг хүснэгтэд хоёр төрлийн токен хадгалахад */
export function identifierFor(purpose: TokenPurpose, email: string): string {
  return `${purpose}:${email.trim().toLowerCase()}`;
}

/** identifier-ээс зорилго, имэйлийг задлана */
export function parseIdentifier(identifier: string): { purpose: string; email: string } {
  const [purpose, ...rest] = identifier.split(":");
  return { purpose: purpose ?? "", email: rest.join(":") };
}

/** Токены хугацаа */
export function expiresAt(purpose: TokenPurpose, now = new Date()): Date {
  const hours = purpose === "reset" ? RESET_HOURS : VERIFY_HOURS;
  return new Date(now.getTime() + hours * 3_600_000);
}
