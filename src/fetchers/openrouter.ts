/**
 * OpenRouter fetcher — DB-д бичнэ.
 *
 *   npx tsx src/fetchers/openrouter.ts            # каталог + сүүлийн 7 хоногийн жагсаалт
 *   npx tsx src/fetchers/openrouter.ts --days 60  # түүхэн өгөгдөл анх удаа татахад
 *
 * Cron: өдөрт 1 удаа (UTC 03:00 орчим — OpenRouter өмнөх өдрөө хаасны дараа).
 */
import "dotenv/config";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import {
  companySlugOf,
  fetchModels,
  fetchRankingsDaily,
  groupByDay,
  isCanonicalModel,
  pricePerMillion,
  rankDay,
  splitName,
} from "./openrouter.api";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 1-р алхам: моделийн каталогийг Company/AiModel хүснэгтэд upsert */
export async function syncCatalog(): Promise<{ companies: number; models: number }> {
  const all = await fetchModels();
  const models = all.filter(isCanonicalModel);

  const companySlugs = [...new Set(models.map((m) => companySlugOf(m.id)))];
  const companyIds = new Map<string, string>();
  for (const slug of companySlugs) {
    const sample = models.find((m) => companySlugOf(m.id) === slug)!;
    const name = splitName(sample.name).company || slug;
    const c = await prisma.company.upsert({
      where: { slug },
      create: { slug, name },
      update: {},               // нэрийг гараар засаж болно — дарж бичихгүй
      select: { id: true },
    });
    companyIds.set(slug, c.id);
  }

  const seen: string[] = [];
  for (const m of models) {
    const data = {
      name: splitName(m.name).model,
      descriptionEn: m.description,
      companyId: companyIds.get(companySlugOf(m.id))!,
      isOpenWeights: Boolean(m.hugging_face_id),
      contextLength: m.context_length,
      modality: m.architecture?.modality ?? null,
      releasedAt: new Date(m.created * 1000),
      inputPricePerM: pricePerMillion(m.pricing.prompt),
      outputPricePerM: pricePerMillion(m.pricing.completion),
      isActive: true,
      lastSeenAt: new Date(),
    };
    await prisma.aiModel.upsert({
      where: { orPermaslug: m.canonical_slug },
      create: { slug: m.id, orPermaslug: m.canonical_slug, ...data },
      update: data,
    });
    seen.push(m.canonical_slug);
  }

  // Каталогоос алга болсон моделиудыг идэвхгүй болгоно (устгахгүй — түүх хэрэгтэй).
  // arenaOnly моделиуд OpenRouter-т угаасаа байхгүй тул хамрахгүй.
  await prisma.aiModel.updateMany({
    where: { orPermaslug: { notIn: seen }, isActive: true, arenaOnly: false },
    data: { isActive: false },
  });

  return { companies: companySlugs.length, models: models.length };
}

/** 2-р алхам: өдөр тутмын токены жагсаалтыг RankingSnapshot-д бичнэ */
export async function syncUsageRankings(days: number): Promise<{ days: number; rows: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY тохируулаагүй байна");

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);               // сүүлийн бүтэн UTC өдөр
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);        // +1 өдөр илүү: delta тооцоход

  const res = await fetchRankingsDaily(apiKey, isoDate(start), isoDate(end));
  const daysGrouped = groupByDay(res.data);

  const known = await prisma.aiModel.findMany({ select: { id: true, orPermaslug: true } });
  const idByPermaslug = new Map(known.map((m) => [m.orPermaslug, m.id]));

  let rows = 0;
  let unknown = new Set<string>();
  for (let i = 0; i < daysGrouped.length; i++) {
    const today = daysGrouped[i]!;
    const yesterday = daysGrouped[i - 1];
    const ranked = rankDay(today, yesterday);
    for (const r of ranked) {
      const modelId = idByPermaslug.get(r.slug);
      if (!modelId) { unknown.add(r.slug); continue; }   // каталогоос хасагдсан модель
      await prisma.rankingSnapshot.upsert({
        where: { modelId_source_date: { modelId, source: "OPENROUTER_USAGE", date: new Date(today.date) } },
        create: {
          modelId,
          source: "OPENROUTER_USAGE",
          date: new Date(today.date),
          rank: r.rank,
          score: r.score.toString(),
          rankDelta: r.rankDelta,
          scoreDelta: r.scoreDelta?.toString() ?? null,
        },
        update: {
          rank: r.rank,
          score: r.score.toString(),
          rankDelta: r.rankDelta,
          scoreDelta: r.scoreDelta?.toString() ?? null,
        },
      });
      rows++;
    }
  }
  if (unknown.size) console.warn(`Каталогт байхгүй ${unknown.size} permaslug алгасав:`, [...unknown].slice(0, 10));
  console.log(`Source: OpenRouter (openrouter.ai/rankings), as of ${res.meta.as_of}`);
  return { days: daysGrouped.length, rows };
}

/** Pipeline болон CLI хоёулаа үүнийг дуудна */
export async function runOpenRouter(days = 7): Promise<{ models: number; rows: number }> {
  const run = await prisma.jobRun.create({ data: { job: "openrouter", ...jobRunMeta() } });
  try {
    const cat = await syncCatalog();
    console.log("Каталог:", cat);
    const usage = await syncUsageRankings(days);
    console.log("Жагсаалт:", usage);
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, itemsIn: cat.models, itemsOut: usage.rows },
    });
    return { models: cat.models, rows: usage.rows };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e) },
    });
    throw e;
  }
}

if (process.argv[1]?.endsWith("openrouter.ts")) {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 7;
  runOpenRouter(days)
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
