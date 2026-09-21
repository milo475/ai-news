/**
 * LMArena Elo fetcher — DB-д бичнэ.
 *
 *   npx tsx src/fetchers/arena.ts
 *
 * Каталогт (AiModel) байхгүй Arena модель бүрт `arenaOnly: true` мөр үүсгэнэ —
 * тэдгээр нь чанарын жагсаалтад орох ч хэрэглээний жагсаалтад орохгүй.
 * Давхардал үүсэхээс сэргийлэхийн тулд таарах ёстой байсан нэрийг
 * src/data/model-aliases.ts-д нэмнэ.
 */
import "dotenv/config";
import { COMPANY_ALIASES } from "../data/model-aliases";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { buildCatalogIndex, fetchArenaRows, rankArena, type ArenaEntry } from "./arena.api";

const SOURCE = "ARENA_ELO" as const;

/** Arena-гийн organization → Company.slug (давхардал үүсгэхгүйн тулд alias-аар дамжина) */
function companySlug(organization: string): string {
  const slug = organization.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "unknown";
  return COMPANY_ALIASES[slug] ?? slug;
}

/** Arena-гийн organization жижиг үсгээр ирдэг ("alibaba") — харуулахад том үсгээр эхлүүлнэ */
function companyName(organization: string): string {
  return organization.trim().replace(/\b[a-z]/g, (c) => c.toUpperCase()) || "Unknown";
}

/** Каталогт байхгүй моделиудыг arenaOnly болгож үүсгээд slug → id буцаана */
async function createArenaOnly(entries: ArenaEntry[]): Promise<string[]> {
  const created: string[] = [];
  for (const e of entries) {
    const slug = companySlug(e.organization);
    const company = await prisma.company.upsert({
      where: { slug },
      create: { slug, name: companyName(e.organization) || slug },
      update: {},
      select: { id: true },
    });
    await prisma.aiModel.create({
      data: {
        slug: e.slug,
        // OpenRouter-ийн permaslug-тай мөргөлдөхгүйн тулд тэмдэглэнэ
        orPermaslug: `arena:${e.slug}`,
        name: e.name,
        companyId: company.id,
        arenaOnly: true,
      },
    });
    created.push(`${e.name} (${e.organization}) → ${e.slug}`);
  }
  return created;
}

/** Pipeline болон CLI хоёулаа үүнийг дуудна */
export async function runArena(limit = 100): Promise<{
  matched: number;
  created: number;
  date: string;
}> {
  const run = await prisma.jobRun.create({ data: { job: "arena", ...jobRunMeta() } });
  try {
    const rows = await fetchArenaRows(limit);
    if (rows.length === 0) throw new Error("LMArena-ээс мөр ирсэнгүй");
    const publishDate = rows[0]!.publishDate;
    const date = new Date(`${publishDate}T00:00:00.000Z`);

    const models = await prisma.aiModel.findMany({ where: { isActive: true }, select: { slug: true, name: true } });
    const entries = rankArena(rows, buildCatalogIndex(models));

    const fresh = entries.filter((e) => e.isNew);
    const created = fresh.length ? await createArenaOnly(fresh) : [];

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
      (await prisma.aiModel.findMany({ where: { slug: { in: entries.map((e) => e.slug) } }, select: { id: true, slug: true } }))
        .map((m) => [m.slug, m.id]),
    );

    let saved = 0;
    for (const e of entries) {
      const modelId = idBySlug.get(e.slug);
      if (!modelId) continue;
      const p = prev.get(e.slug);
      const data = {
        rank: e.rank,
        score: e.rating.toFixed(4),
        rankDelta: p ? p.rank - e.rank : null,
        scoreDelta: p ? (e.rating - p.score).toFixed(4) : null,
      };
      await prisma.rankingSnapshot.upsert({
        where: { modelId_source_date: { modelId, source: SOURCE, date } },
        create: { modelId, source: SOURCE, date, ...data },
        update: data,
      });
      saved++;
    }

    if (created.length) {
      console.log(`Каталогт байхгүй ${created.length} моделийг arenaOnly болгож үүсгэв:`);
      for (const c of created) console.log(`  ${c}`);
      console.log("  (OpenRouter-т байгаа модель байсан бол model-aliases.ts-д нэмж давхардлыг арилгана уу)");
    }
    console.log(`Source: LMArena (lmarena.ai), as of ${publishDate}`);
    console.log(
      `${saved} модель хадгалав (шинэ ${created.length})` +
        `${prevDate ? `, өмнөх ${prevDate.date.toISOString().slice(0, 10)}-тай харьцуулав` : ", өмнөх жагсаалт алга"}`,
    );

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), ok: true,
        itemsIn: rows.length, itemsOut: saved,
        attempted: rows.length, failed: 0,
      },
    });
    return { matched: saved, created: created.length, date: publishDate };
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
