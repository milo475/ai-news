/**
 * Имэйл баталгаажуулах, нууц үг сэргээх токенууд (VerificationToken хүснэгт).
 *
 * identifier нь "<зорилго>:<имэйл>" хэлбэртэй — нэг хүснэгтэд хоёр төрлийг хадгална.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { expiresAt, identifierFor, parseIdentifier, type TokenPurpose } from "./tokens.api";

export * from "./tokens.api";

/** Шинэ токен үүсгэнэ. Тухайн зорилгын хуучин токеныг хүчингүй болгоно. */
export async function createToken(purpose: TokenPurpose, email: string): Promise<string> {
  const identifier = identifierFor(purpose, email);
  const token = randomBytes(32).toString("hex");

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires: expiresAt(purpose) },
  });
  return token;
}

/**
 * Токеныг шалгаж, зөв бол имэйлийг буцаана (нэг удаа хэрэглэнэ — устгана).
 * Хугацаа нь дууссан, буруу зорилготой, эсвэл байхгүй бол null.
 */
export async function useToken(purpose: TokenPurpose, token: string): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row) return null;

  const { purpose: rowPurpose, email } = parseIdentifier(row.identifier);
  if (rowPurpose !== purpose) return null;

  await prisma.verificationToken.delete({ where: { token } });
  if (row.expires.getTime() < Date.now()) return null;
  return email;
}

/** Хугацаа нь дууссан токенуудыг цэвэрлэнэ */
export async function pruneTokens(now = new Date()): Promise<number> {
  const { count } = await prisma.verificationToken.deleteMany({ where: { expires: { lt: now } } });
  return count;
}
