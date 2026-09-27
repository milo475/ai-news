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
  assembleBody, DIGEST_MAX_TOKENS, DIGEST_OUTLINE_SCHEMA, DIGEST_SCHEMA,
  DIGEST_SECTION_SCHEMA, MIN_ARTICLES, OUTLINE_MAX_TOKENS, resolveOutline, SECTION_MAX_TOKENS,
  weekLabel,
  type DigestOut, type DigestOutline, type DigestSource, type RankingChange,
} from "./digest.api";
import { chatJson, isTruncated } from "./llm";
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

type Chat = typeof chatJson;

/** Мэдээг prompt-д оруулах хэлбэр */
function itemLines(items: DigestSource[]): string[] {
  return items.map(
    (a) => `- slug: ${a.slug}\n  гарчиг: ${a.titleMn}\n  хураангуй: ${a.summaryMn}\n  эх сурвалж: ${a.sourceName}`,
  );
}

/**
 * Тоймыг **хэсэгчлэн** бичүүлнэ: эхлээд бүтэц (гарчиг, тойм, хэсгүүд + аль мэдээ
 * хаана орох), дараа нь хэсэг бүрийн биеийг тусад нь.
 *
 * Нэг дуудлага нь max_tokens-д багтахгүй үед л ажиллана. Дуудлага олон ч тус бүр нь
 * жижиг тул нийт зардал бараг ижил, харин тасрах эрсдэлгүй.
 */
async function writeInParts(
  label: string,
  items: DigestSource[],
  chat: Chat,
): Promise<{ data: DigestOut; tokens: number; costUsd: number }> {
  console.log("  ↻ нэг дуудлагад багтсангүй — хэсэгчлэн бичүүлнэ");
  let tokens = 0;
  let costUsd = 0;

  const outlineRes = await chat<DigestOutline>({
    model: WRITE_MODEL,
    system: `${SYSTEM}\n\nОДОО зөвхөн БҮТЦИЙГ гарга: гарчиг, тойм, 2–5 хэсгийн ГАРЧИГ, хэсэг бүрд ямар мэдээ орохыг slug-аар нь. Хэсгийн биеийг БҮҮ бич — дараа нь тусад нь бичнэ.`,
    user: [`Долоо хоног: ${label}`, "", "Мэдээнүүд (оноогоор эрэмбэлсэн):", ...itemLines(items)].join("\n"),
    schema: DIGEST_OUTLINE_SCHEMA,
    maxTokens: OUTLINE_MAX_TOKENS,
    temperature: 0.4,
    reasoning: false,
  });
  tokens += outlineRes.tokens;
  costUsd += outlineRes.costUsd;

  const known = items.map((a) => a.slug);
  const outline = resolveOutline(outlineRes.data, known);
  if (outline.sections.length === 0) throw new Error("Digest: бүтэц хоосон ирлээ");

  const bySlug = new Map(items.map((a) => [a.slug, a]));
  const sections: DigestOut["sections"] = [];

  for (const [i, s] of outline.sections.entries()) {
    const mine = s.slugs.flatMap((slug) => bySlug.get(slug) ?? []);
    const res = await chat<{ body: string }>({
      model: WRITE_MODEL,
      system: `${SYSTEM}\n\nОДОО зөвхөн НЭГ хэсгийн биеийг бич. Гарчгийг давтаж бүү бич — зөвхөн 2–4 догол мөр.`,
      user: [
        `Долоо хоног: ${label}`,
        `Тоймын гарчиг: ${outline.titleMn}`,
        `Энэ хэсгийн гарчиг: ${s.heading}`,
        "",
        "Зөвхөн эдгээр мэдээг ашигла:",
        ...itemLines(mine),
      ].join("\n"),
      schema: DIGEST_SECTION_SCHEMA,
      maxTokens: SECTION_MAX_TOKENS,
      temperature: 0.4,
      reasoning: false,
    });
    tokens += res.tokens;
    costUsd += res.costUsd;
    sections.push({ heading: s.heading, body: res.data.body });
    console.log(`    ${i + 1}/${outline.sections.length} «${s.heading}» (${mine.length} мэдээ)`);
  }

  return {
    data: { titleMn: outline.titleMn, leadMn: outline.leadMn, sections, nextWeek: outline.nextWeek },
    tokens,
    costUsd,
  };
}

/** Эхлээд нэг дуудлагаар; тасарвал хэсэгчилсэн горимд шилжинэ */
export async function writeDigest(
  label: string,
  items: DigestSource[],
  chat: Chat,
): Promise<{ data: DigestOut; tokens: number; costUsd: number }> {
  const user = [
    `Долоо хоног: ${label}`,
    "",
    "Мэдээнүүд (оноогоор эрэмбэлсэн):",
    ...itemLines(items),
  ].join("\n");

  try {
    return await chat<DigestOut>({
      model: WRITE_MODEL, system: SYSTEM, user, schema: DIGEST_SCHEMA,
      maxTokens: DIGEST_MAX_TOKENS, temperature: 0.4, reasoning: false,
    });
  } catch (e) {
    // Зөвхөн «багтсангүй» алдаанд хэсэгчилнэ — бусад алдааг дамжуулна
    if (!isTruncated(e)) throw e;
    return writeInParts(label, items, chat);
  }
}

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

export async function runDigest(
  publish = false,
  opts: { chat?: Chat } = {},
): Promise<{ created: boolean; slug?: string; title?: string; items: number }> {
  const run = await prisma.jobRun.create({ data: { job: "digest", ...jobRunMeta() } });
  try {
    const to = new Date();
    const since = new Date(to.getTime() - DAYS * 86_400_000);

    // Дотоодын мэдээ тусдаа хэсэгт орно — дэлхийн мэдээний тоймд хольж будлиулахгүй
    const localRows = await prisma.article.findMany({
      where: { kind: "NEWS", status: "PUBLISHED", isLocal: true, publishedAt: { gte: since } },
      orderBy: [{ relevance: "desc" }, { publishedAt: "desc" }],
      take: 5,
      select: { slug: true, titleMn: true, summaryMn: true, relevance: true, source: { select: { name: true } } },
    });

    const rows = await prisma.article.findMany({
      where: { kind: "NEWS", status: "PUBLISHED", isLocal: false, publishedAt: { gte: since } },
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

    const { data, tokens, costUsd } = await writeDigest(label, items, opts.chat ?? chatJson);

    const local: DigestSource[] = localRows.map((a) => ({
      slug: a.slug,
      titleMn: a.titleMn ?? "",
      summaryMn: a.summaryMn ?? "",
      relevance: a.relevance,
      sourceName: a.source.name,
    }));
    const body = assembleBody(data, changes, items, local);
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
      data: { finishedAt: new Date(), ok: true, itemsIn: items.length, itemsOut: 1, costUsd },
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
