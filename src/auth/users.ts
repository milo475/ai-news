/**
 * Хэрэглэгч үүсгэх, баталгаажуулах, нууц үг солих — DB талын үйлдлүүд.
 */
import { prisma } from "../db";
import type { UserRole } from "../generated/prisma/enums";
import { hashPassword } from "./password";

export interface NewUser {
  email: string;
  name: string;
  password: string;
}

export interface CreatedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * Ижил имэйлтэй newsletter бүртгэл байвал хэрэглэгчтэй холбоно.
 * Аль хэдийн өөр хэрэглэгчид холбогдсон бол хөндөхгүй.
 */
export async function linkSubscriber(userId: string, email: string): Promise<boolean> {
  const { count } = await prisma.subscriber.updateMany({
    where: { email: email.trim().toLowerCase(), userId: null },
    data: { userId },
  });
  return count > 0;
}

/** Шинэ хэрэглэгч. Имэйл давхардвал null (дуудагч нь ерөнхий мессеж харуулна). */
export async function createUser(input: NewUser): Promise<CreatedUser | null> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return null;

  const user = await prisma.user.create({
    data: { email, name: input.name.trim() || null, passwordHash: await hashPassword(input.password) },
    select: { id: true, email: true, name: true, role: true },
  });
  await linkSubscriber(user.id, email);
  return user;
}

/** Имэйлийг баталгаажсан гэж тэмдэглэнэ */
export async function markVerified(email: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { email: email.trim().toLowerCase(), emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  return count > 0;
}

/** Нууц үгийг солино (сэргээх урсгал болон профайл) */
export async function setPassword(email: string, password: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { email: email.trim().toLowerCase() },
    data: { passwordHash: await hashPassword(password) },
  });
  return count > 0;
}
