/**
 * Студийн DB давхарга — хэрэглээний тоо, өдрийн зардал, session.
 */
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { ubDateLabel } from "../jobs/day";
import type { StudioFormat } from "../generated/prisma/enums";
import { subjectsOf, usedOf } from "./studio.api";

export function today(now = new Date()): string {
  return ubDateLabel(now);
}

function toNum(v: unknown): number {
  return Number(v ?? 0) || 0;
}

/** Хэрэглэгчийн өнөөдрийн хэрэглээ — subject бүрийн хамгийн их тоо */
export async function usedToday(
  a: { userId?: string | null; anonId: string; ip: string },
  now = new Date(),
): Promise<number> {
  const rows = await prisma.studioUsage.findMany({
    where: { day: today(now), subject: { in: subjectsOf(a) } },
    select: { count: true },
  });
  return usedOf(rows.map((r) => r.count));
}

/** Өнөөдрийн НИЙТ зардал — төсөв хянана. `ip:` мөрүүдээр тоолно (давхардахгүй). */
export async function spentToday(now = new Date()): Promise<number> {
  const rows = await prisma.studioUsage.findMany({
    where: { day: today(now), subject: { startsWith: "ip:" } },
    select: { costUsd: true },
  });
  return rows.reduce((n, r) => n + toNum(r.costUsd), 0);
}

/**
 * Шинэ бүтээл эхэлснийг тоолно. Эхлэхэд л тоолно — дуудлага хийгдсэн, мөнгө зарцуулагдсан.
 * Дуусгаагүй бүтээл ч квотоос иднэ, эс тэгвээс хязгаарыг тойрч болно.
 */
export async function bumpCount(
  a: { userId?: string | null; anonId: string; ip: string },
  now = new Date(),
): Promise<void> {
  const day = today(now);
  await prisma.$transaction(
    subjectsOf(a).map((subject) =>
      prisma.studioUsage.upsert({
        where: { day_subject: { day, subject } },
        create: { day, subject, count: 1, costUsd: 0 },
        update: { count: { increment: 1 } },
      }),
    ),
  );
}

/** Алхам бүрийн зардлыг нэмнэ (тоо нэмэгдэхгүй) */
export async function addSpend(
  a: { userId?: string | null; anonId: string; ip: string; costUsd: number },
  now = new Date(),
): Promise<void> {
  if (a.costUsd <= 0) return;
  const day = today(now);
  await prisma.$transaction(
    subjectsOf(a).map((subject) =>
      prisma.studioUsage.upsert({
        where: { day_subject: { day, subject } },
        create: { day, subject, count: 0, costUsd: a.costUsd },
        update: { costUsd: { increment: a.costUsd } },
      }),
    ),
  );
}

export interface NewSession {
  userId?: string | null;
  anonId: string;
  request: string;
  format: StudioFormat;
  tools?: string[];
  placement?: string | null;
}

export async function createSession(a: NewSession): Promise<string> {
  const row = await prisma.studioSession.create({
    data: {
      userId: a.userId ?? null,
      anonId: a.anonId,
      request: a.request,
      format: a.format,
      tools: a.tools ?? [],
      placement: a.placement ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Модерациар татгалзсаныг бүртгэнэ — /admin дээр «ямар хүсэлт татгалзаж байна»
 * гэдгийг харах, prompt-оо сайжруулахад хэрэгтэй.
 */
export async function recordRejected(a: {
  userId?: string | null;
  anonId: string;
  request: string;
  format: StudioFormat;
  reason: string;
}): Promise<void> {
  await prisma.studioSession.create({
    data: {
      userId: a.userId ?? null,
      anonId: a.anonId,
      request: a.request,
      format: a.format,
      rejected: a.reason,
    },
  });
}

export async function getSession(id: string) {
  return prisma.studioSession.findUnique({ where: { id } });
}

type SessionPatch = Parameters<typeof prisma.studioSession.update>[0]["data"];

export async function patchSession(id: string, data: SessionPatch): Promise<void> {
  await prisma.studioSession.update({ where: { id }, data });
}

/** Зардлыг нэмж бичнэ — алхам бүрд дуудагдана */
export async function addCost(id: string, costUsd: number): Promise<void> {
  await prisma.studioSession.update({
    where: { id },
    data: { costUsd: { increment: costUsd } },
  });
}

export async function setFeedback(id: string, up: boolean): Promise<void> {
  await prisma.studioSession.update({ where: { id }, data: { feedback: up } });
}

/** «Миний промптууд» */
export async function mySessions(userId: string, take = 30) {
  return prisma.studioSession.findMany({
    where: { userId, outputs: { not: Prisma.DbNull } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, request: true, format: true, tools: true, createdAt: true, feedback: true },
  });
}

/** Нэвтрээгүй хэрэглэгчийн энэ хөтөч дээрх ажлууд */
export async function anonSessions(anonId: string, take = 10) {
  return prisma.studioSession.findMany({
    where: { anonId, outputs: { not: Prisma.DbNull } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, request: true, format: true, tools: true, createdAt: true, feedback: true },
  });
}

/** Prisma-гийн Json талбарт бичих — бидний интерфейсүүд index signature-гүй */
export function asJson<T>(v: T): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}

/** Мэдлэгийн сангаас баталгаажаагүй тул хасагдсан тооны тоог нэмнэ */
export async function bumpStripped(id: string, n: number): Promise<void> {
  if (n <= 0) return;
  await prisma.studioSession.update({
    where: { id },
    data: { strippedNumbers: { increment: n } },
  });
}
