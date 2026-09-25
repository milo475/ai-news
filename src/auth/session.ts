/**
 * Session уншиж, эрхийг шалгах туслахууд (server component / server action).
 */
import { auth } from "./config";
import { AuthError } from "./errors";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: "USER" | "ADMIN";
  verified: boolean;
}

/** Нэвтэрсэн хэрэглэгч эсвэл null */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

export { AuthError } from "./errors";

/** Нэвтэрсэн байхыг шаардана */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("unauthenticated");
  return user;
}

/**
 * Бичих үйлдэлд: нэвтэрсэн БӨГӨӨД имэйл баталгаажсан байхыг шаардана.
 * (prompt нэмэх, коммент бичих гэх мэт).
 */
export async function requireVerified(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.verified) throw new AuthError("unverified");
  return user;
}
