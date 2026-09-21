/**
 * Долоо хоногийн digest — 7 хоногийн нийтлэгдсэн мэдээг нэг нийтлэл болгож нэгтгэнэ.
 *
 *   npm run agent:digest              # DRAFT болгож үлдээнэ
 *   npm run agent:digest -- --publish # шууд нийтэлнэ
 *
 * Pipeline дээр зөвхөн Ням гарагт (UTC) ажиллана.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import {
  assembleBody, DIGEST_SCHEMA, MIN_ARTICLES, weekLabel,
  type DigestOut, type DigestSource, type RankingChange,
} from "./digest.api";
import { chatJson } from "./llm";
import { slugify } from "./slug";

const WRITE_MODEL = process.env.WRITE_MODEL ?? "google/gemini-3.8-flash";
const GLOSSARY = readFileSync(join(process.cwd(), "src/agent/glossary.md"), "utf8");
const DAYS = 7;
/** Хамгийн олондоо энэ тооны мэдээг digest-д оруулна */
const MAX_ARTICLES = 15;

const SYSTEM = `Чи монгол хэлээр хиймэл оюуны мэдээ бичдэг сэтгүүлч. Доорх долоо хоногийн мэдээнүүдийг уншаад НЭГ БҮТЭН тоймыг монголоор бич.
Мэдээг зүгээр жагсаахгүй — сэдвээр нь бүлэглэж, хоорондын холбоог нь тайлбарла. Мэдээ дурдах бүрдээ [гарчиг](/medee/<slug>) хэлбэрээр холбоос тавь. Өгөгдсөн жагсаалтад байхгүй slug бүү зохио.
Өгөгдсөн мэдээнд байхгүй баримт, тоо бүү нэм. Ажлын явцын тайлбарыг нийтлэлд хэзээ ч бүү бич. Доорх толь бичиг, дүрмийг заавал мөрд.
--- ТОЛЬ БИЧИГ, ДҮРЭМ ---
${GLOSSARY}`;

/** Сүүлийн 7 хоногийн жагсаалтын өөрчлөлт — LLM оролцохгүй */
async function rankingChanges(since: Date): Promise<RankingChange> {
  const empty: RankingChange = { enteredTop10: [], leftTop10: [], biggestRise: null, biggestFall: null, arenaNew: [] };

  const latest = await prisma.rankingSnapshot.findFirst({
    where: { source: "OPENROUTER_USAGE" }, orderBy: { date: "desc" }, select: { date: true },
  });
  if (!latest) return empty;
  const earlier = await prisma.rankingSnapshot.findFirst({
    where: { source: "OPENROUTER_USAGE", date: { lte: since } }, orderBy: { date: "desc" }, select: { date: true },
  });

  const pick = { rank: true, model: { select: { slug: true, name: true } } };
  const now = await prisma.rankingSnapshot.findMany({ where: { source: "OPENROUTER_USAGE", date: latest.date }, select: pick });
  const then = earlier
    ? await prisma.rankingSnapshot.findMany({ where: { source: "OPENROUTER_USAGE", date: earlier.date }, select: pick })
    : [];
  const thenRank = new Map(then.map((s) => [s.model.slug, s.rank]));

  const top10Now = now.filter((s) => s.rank <= 10);
  const top10Then = new Set(then.filter((s) => s.rank <= 10).map((s) => s.model.slug));

  const changes: RankingChange = {
    enteredTop10: top10Now
      .filter((s) => then.length > 0 && !top10Then.has(s.model.slug))
      .map((s) => ({ name: s.model.name, slug: s.model.slug, rank: s.rank })),
    leftTop10: then
      .filter((s) => s.rank <= 10 && !top10Now.some((n) => n.model.slug === s.model.slug))
      .map((s) => ({ name: s.model.name, slug: s.model.slug })),
    biggestRise: null,
    biggestFall: null,
    arenaNew: [],
  };

  const moves = now
    .filter((s) => thenRank.has(s.model.slug))
    .map((s) => ({ name: s.model.name, slug: s.model.slug, delta: thenRank.get(s.model.slug)! - s.rank }))
    .sort((a, b) => b.delta - a.delta);
  if (moves.length) {
    if (moves[0]!.delta > 0) changes.biggestRise = moves[0]!;
    const worst = moves[moves.length - 1]!;
    if (worst.delta < 0) changes.biggestFall = worst;
  }

  // Arena-д шинээр орсон
  const arenaLatest = await prisma.rankingSnapshot.findFirst({
    where: { source: "ARENA_ELO" }, orderBy: { date: "desc" }, select: { date: true },
  });
  if (arenaLatest) {
    const arenaNow = await prisma.rankingSnapshot.findMany({ where: { source: "ARENA_ELO", date: arenaLatest.date }, select: pick });
    const seen = new Set(
      (await prisma.rankingSnapshot.findMany({
        where: { source: "ARENA_ELO", date: { lt: arenaLatest.date } },
        select: { model: { select: { slug: true } } },
        distinct: ["modelId"],
      })).map((s) => s.model.slug),
    );
    if (seen.size > 0) {
      changes.arenaNew = arenaNow
        .filter((s) => !seen.has(s.model.slug))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 5)
        .map((s) => ({ name: s.model.name, slug: s.model.slug, rank: s.rank }));
    }
  }
  return changes;
}

export async function runDigest(publish = false): Promise<{ created: boolean; slug?: string; title?: string; items: number }> {
  const run = await prisma.jobRun.create({ data: { job: "digest", ...jobRunMeta() } });
  try {
    const to = new Date();
    const since = new Date(to.getTime() - DAYS * 86_400_000);

    const rows = await prisma.article.findMany({
      where: { kind: "NEWS", status: "PUBLISHED", publishedAt: { gte: since } },
      orderBy: [{ relevance: "desc" }, { publishedAt: "desc" }],
      take: MAX_ARTICLES,
      select: { id: true, slug: true, titleMn: true, summaryMn: true, relevance: true, source: { select: { name: true } } },
    });

    if (rows.length < MIN_ARTICLES) {
      console.log(`Энэ долоо хоногт ${rows.length} мэдээ — ${MIN_ARTICLES}-аас цөөн тул digest үүсгэсэнгүй.`);
      await prisma.jobRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: true, itemsIn: rows.length, itemsOut: 0 },
      });
      return { created: false, items: rows.length };
    }

    const items: DigestSource[] = rows.map((a) => ({
      slug: a.slug,
      titleMn: a.titleMn ?? "",
      summaryMn: a.summaryMn ?? "",
      relevance: a.relevance,
      sourceName: a.source.name,
    }));
    const changes = await rankingChanges(since);
    const label = weekLabel(since, to);

    const user = [
      `Долоо хоног: ${label}`,
      "",
      "Мэдээнүүд (оноогоор эрэмбэлсэн):",
      ...items.map((a) => `- slug: ${a.slug}\n  гарчиг: ${a.titleMn}\n  хураангуй: ${a.summaryMn}\n  эх сурвалж: ${a.sourceName}`),
    ].join("\n");

    const { data, tokens } = await chatJson<DigestOut>({
      model: WRITE_MODEL, system: SYSTEM, user, schema: DIGEST_SCHEMA,
      maxTokens: 4000, temperature: 0.4, reasoning: false,
    });

    const body = assembleBody(data, changes, items);
    const slug = await uniqueSlug(slugify(data.titleMn) || `digest-${label.replace(/\D+/g, "-")}`);

    const digest = await prisma.article.create({
      data: {
        kind: "DIGEST",
        slug,
        status: publish ? "PUBLISHED" : "DRAFT",
        ...(publish ? { publishedAt: new Date(), reviewedBy: "auto" } : {}),
        // Digest-д эх сурвалж байхгүй ч Article.sourceId заавал — эхний мэдээнийхийг авна
        sourceId: (await prisma.article.findUniqueOrThrow({ where: { id: rows[0]!.id }, select: { sourceId: true } })).sourceId,
        sourceUrl: `internal:digest:${slug}`,
        sourceTitle: `Долоо хоногийн тойм ${label}`,
        sourceHash: `digest-${slug}`,
        titleMn: data.titleMn,
        summaryMn: data.leadMn,
        bodyMn: body,
        tags: ["долоо хоног", "тойм"],
        relevance: 10,
        writeModel: WRITE_MODEL,
        tokensUsed: tokens,
        digestItems: { create: rows.map((a, i) => ({ articleId: a.id, order: i })) },
      },
      select: { slug: true, titleMn: true },
    });

    console.log(`Digest: "${digest.titleMn}" → /medee/${digest.slug} (${items.length} мэдээ, ${publish ? "PUBLISHED" : "DRAFT"})`);
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, itemsIn: items.length, itemsOut: 1 },
    });
    return { created: true, slug: digest.slug, title: digest.titleMn ?? "", items: items.length };
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 1000) },
    });
    throw e;
  }
}

async function uniqueSlug(base: string): Promise<string> {
  for (let n = 2; ; n++) {
    if (!(await prisma.article.findUnique({ where: { slug: base }, select: { id: true } }))) return base;
    base = `${base.replace(/-\d+$/, "")}-${n}`;
  }
}

if (process.argv[1]?.endsWith("digest.ts")) {
  runDigest(process.argv.includes("--publish"))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
