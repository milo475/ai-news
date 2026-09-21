/**
 * LMArena Elo fetcher — DB-д бичнэ.
 *
 *   npx tsx src/fetchers/arena.ts
 *
 * Зөвхөн каталогт (AiModel) байгаа моделиудад snapshot хадгална — шинэ модель үүсгэхгүй.
 * Таараагүй нэрсийг логд хэвлэнэ; тэдгээрийг src/data/model-aliases.ts-д гараар нэмнэ.
 */
import "dotenv/config";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { buildCatalogIndex, fetchArenaRows, rankArena } from "./arena.api";

const SOURCE = "ARENA_ELO" as const;

/** Pipeline болон CLI хоёулаа үүнийг дуудна */
export async function runArena(limit = 100): Promise<{
  matched: number;
  unmatched: number;
  date: string;
}> {
  const run = await prisma.jobRun.create({ data: { job: "arena", ...jobRunMeta() } });
  try {
    const rows = await fetchArenaRows(limit);
    if (rows.length === 0) throw new Error("LMArena-ээс мөр ирсэнгүй");
    const publishDate = rows[0]!.publishDate;
    const date = new Date(`${publishDate}T00:00:00.000Z`);

    const models = await prisma.aiModel.findMany({ where: { isActive: true }, select: { slug: true, name: true } });
    const index = buildCatalogIndex(models);
    const { ranked, unmatched } = rankArena(rows, index);

    // Өмнөх (энэ өдрөөс эрт) жагсаалттай харьцуулж өөрчлөлтийг тооцно.
    // LMArena долоо хоног тутам нийтэлдэг тул "өмнөх өдөр" гэж байхгүй.
    const prevDate = await prisma.rankingSnapshot.findFirst({
      where: { source: SOURCE, date: { lt: date } },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    const prev = new Map<string, { rank: number; score: number }>();
    if (prevDate) {
      const snaps = await prisma.rankingSnapshot.findMany({
        where: { source: SOURCE, date: prevDate.date },
        select: { rank: true, score: true, model: { select: { slug: true } } },
      });
      for (const s of snaps) prev.set(s.model.slug, { rank: s.rank, score: Number(s.score) });
    }

    const idBySlug = new Map(
      (await prisma.aiModel.findMany({ where: { slug: { in: ranked.map((r) => r.slug) } }, select: { id: true, slug: true } }))
        .map((m) => [m.slug, m.id]),
    );

    for (const r of ranked) {
      const modelId = idBySlug.get(r.slug);
      if (!modelId) continue;
      const p = prev.get(r.slug);
      const data = {
        rank: r.rank,
        score: r.rating.toFixed(4),
        rankDelta: p ? p.rank - r.rank : null,
        scoreDelta: p ? (r.rating - p.score).toFixed(4) : null,
      };
      await prisma.rankingSnapshot.upsert({
        where: { modelId_source_date: { modelId, source: SOURCE, date } },
        create: { modelId, source: SOURCE, date, ...data },
        update: data,
      });
    }

    if (unmatched.length) {
      console.warn(`Каталогт таараагүй ${unmatched.length} нэр (model-aliases.ts-д нэмнэ үү):`);
      for (const u of unmatched) console.warn(`  "${u.key}": "…",   // ${u.name} (${u.organization})`);
    }
    console.log(`Source: LMArena (lmarena.ai), as of ${publishDate}`);
    console.log(`Таарсан ${ranked.length}, таараагүй ${unmatched.length}${prevDate ? `, өмнөх ${prevDate.date.toISOString().slice(0, 10)}-тай харьцуулав` : ", өмнөх жагсаалт алга"}`);

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), ok: true,
        itemsIn: rows.length, itemsOut: ranked.length,
        attempted: rows.length, failed: unmatched.length,
      },
    });
    return { matched: ranked.length, unmatched: unmatched.length, date: publishDate };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 1000) },
    });
    throw e;
  }
}

if (process.argv[1]?.endsWith("arena.ts")) {
  runArena()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
