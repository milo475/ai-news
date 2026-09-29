/**
 * Студийн хэрэглээний тоон дүр зураг — /admin.
 *
 * НУУЦЛАЛ: IP, хүсэлтийн бүтэн текст энд ХЭЗЭЭ Ч гарахгүй. Зөвхөн ангилал:
 * эх сурвалжийн домэйн, мэргэжлийн slug, хэрэгслийн нэр.
 */
import { prisma } from "../db";
import { bySource, byPersona, byTool, funnelOf, type Funnel, type SessionRow } from "./attribution.api";

export interface StudioWindow {
  days: number;
  funnel: Funnel;
  sources: ReturnType<typeof bySource>;
  personas: ReturnType<typeof byPersona>;
  tools: ReturnType<typeof byTool>;
}

async function rowsFor(days: number, now: Date): Promise<SessionRow[]> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await prisma.studioSession.findMany({
    where: { createdAt: { gte: since }, rejected: null },
    // Хүсэлтийн текст, anonId, userId-г ОГТ авахгүй
    select: {
      source: true, persona: true, completed: true, copied: true,
      revisionCount: true, costUsd: true, timings: true, tools: true,
    },
  });
  return rows.map((r) => ({
    source: r.source,
    persona: r.persona,
    completed: r.completed,
    copied: r.copied,
    revisionCount: r.revisionCount,
    costUsd: Number(r.costUsd ?? 0) || 0,
    outputMs: Number((r.timings as { output?: number } | null)?.output ?? 0) || null,
    tools: r.tools,
  }));
}

export async function studioWindow(days: number, now = new Date()): Promise<StudioWindow> {
  const rows = await rowsFor(days, now);
  return {
    days,
    funnel: funnelOf(rows, days),
    sources: bySource(rows),
    personas: byPersona(rows),
    tools: byTool(rows),
  };
}

/** 7 ба 30 хоног — /admin дээр зэрэгцүүлж харуулна */
export async function studioWindows(now = new Date()): Promise<StudioWindow[]> {
  return Promise.all([studioWindow(7, now), studioWindow(30, now)]);
}
