/**
 * Зааврын үзэлт — Umami-гаас биш, DB дээр шууд increment.
 *
 * Хайлтын bot-ууд мөнхийн хуудсыг байнга сканнердаг тул user-agent-аар шүүнэ.
 */
import { prisma } from "../db";
import { isBot } from "./views.api";

export async function bumpViews(guideId: string, userAgent: string | null | undefined): Promise<void> {
  if (isBot(userAgent)) return;
  try {
    await prisma.guide.update({ where: { id: guideId }, data: { views: { increment: 1 } } });
  } catch {
    // Тоолуур унасан нь хуудсыг унагаах ёсгүй
  }
}
