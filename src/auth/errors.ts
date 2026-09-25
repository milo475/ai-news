/**
 * Нэвтрэлтийн алдаанууд — цэвэр (DB, next-auth-гүй тул тесттэй).
 */
export type AuthErrorCode = "unauthenticated" | "unverified";

export const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  unauthenticated: "Энэ үйлдэлд нэвтэрсэн байх шаардлагатай.",
  unverified: "Имэйлээ баталгаажуулсны дараа энэ үйлдлийг хийх боломжтой.",
};

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(AUTH_MESSAGES[code]);
    this.name = "AuthError";
  }
}
