/**
 * Auth-ийн цэвэр тохиргоо (DB, next-auth-гүй тул тесттэй).
 */

/** Session-ий хугацаа: 30 хоног, секундээр */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/** Нэвтрэхэд алдааны шалтгааныг задруулахгүй — ерөнхий мессеж */
export const GENERIC_LOGIN_ERROR = "Имэйл эсвэл нууц үг буруу байна.";

/** Google-ийн түлхүүр тохируулсан эсэх — товчийг нуухад ч хэрэглэнэ */
export function googleEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}
