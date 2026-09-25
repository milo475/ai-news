/**
 * Тестлэх моделиудыг DB-ийн хэрэглээний жагсаалтаас сонгоно.
 */
import { prisma } from "../db";
import { extraModels, pickModels, TOP_MODELS } from "./models.api";

/** Хамгийн сүүлийн OpenRouter хэрэглээний жагсаалтын топ N */
export async function topUsageModels(limit = TOP_MODELS): Promise<string[]> {
  const latest = await prisma.rankingSnapshot.findFirst({
    where: { source: "OPENROUTER_USAGE" },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return [];

  const rows = await prisma.rankingSnapshot.findMany({
    where: { source: "OPENROUTER_USAGE", date: latest.date },
    orderBy: { rank: "asc" },
    take: limit,
    select: { model: { select: { slug: true, isActive: true } } },
  });
  return rows.flatMap((r) => (r.model.isActive ? [r.model.slug] : []));
}

/** Бенчмаркт орох моделиуд */
export async function benchModels(limit = TOP_MODELS): Promise<string[]> {
  return pickModels(await topUsageModels(limit), extraModels(), limit);
}

/** Моделийн нэр, компанийг нэг дуудлагаар (жагсаалт зурахад) */
export async function modelMeta(slugs: string[]): Promise<Map<string, { name: string; company: string }>> {
  if (slugs.length === 0) return new Map();
  const rows = await prisma.aiModel.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true, company: { select: { name: true } } },
  });
  return new Map(rows.map((r) => [r.slug, { name: r.name, company: r.company.name }]));
}
