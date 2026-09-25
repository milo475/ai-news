/**
 * Run дуусахад DIGEST маягийн нийтлэлийг DRAFT-аар үүсгэнэ. Админ уншаад нийтэлнэ.
 */
import { chatJson } from "../agent/llm";
import { prisma } from "../db";
import { slugify } from "../agent/slug";
import { siteUrl } from "../lib/site";
import { modelMeta } from "./models";
import { parseCategoryScores } from "./queries";
import { monthLabel } from "./summary.api";
import {
  ARTICLE_SCHEMA, ARTICLE_SYSTEM, articleUser, assembleArticle, type ArticleOut, type TopRow,
} from "./article.api";
import { BENCH_CATEGORIES, BENCH_CATEGORY_LABEL } from "./task.api";
import type { BenchCategory } from "../generated/prisma/enums";

type Chat = typeof chatJson;

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let n = 2; ; n++) {
    if (!(await prisma.article.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    slug = `${base.replace(/-\d+$/, "")}-${n}`;
  }
}

export async function writeBenchArticle(
  runId: string,
  opts: { chat?: Chat } = {},
): Promise<{ slug: string; title: string }> {
  const chat = opts.chat ?? chatJson;

  const run = await prisma.benchRun.findUniqueOrThrow({
    where: { id: runId },
    select: { month: true, articleId: true },
  });
  const summaries = await prisma.benchModelSummary.findMany({
    where: { runId },
    orderBy: { rank: "asc" },
    take: 10,
  });
  if (summaries.length < 3) throw new Error("Дүн хэтэрхий цөөн — нийтлэл бичсэнгүй");

  const meta = await modelMeta(summaries.map((s) => s.modelSlug));
  const top: TopRow[] = summaries.slice(0, 5).map((s) => ({
    rank: s.rank,
    modelSlug: s.modelSlug,
    name: meta.get(s.modelSlug)?.name ?? s.modelSlug,
    company: meta.get(s.modelSlug)?.company ?? "",
    avgScore: s.avgScore,
    avgLatency: s.avgLatency,
    costPer1kMn: s.costPer1kMn,
  }));

  // Ангилал бүрийн шилдэг
  const bestByCategory: { category: BenchCategory; modelName: string; score: number }[] = [];
  for (const c of BENCH_CATEGORIES) {
    let best: { slug: string; score: number } | null = null;
    for (const s of summaries) {
      const score = parseCategoryScores(s.scoreByCategory)[c];
      if (score !== undefined && (!best || score > best.score)) best = { slug: s.modelSlug, score };
    }
    if (best) {
      bestByCategory.push({
        category: c,
        modelName: meta.get(best.slug)?.name ?? best.slug,
        score: best.score,
      });
    }
  }

  const taskCount = await prisma.benchTask.count({ where: { isActive: true } });
  const out = await chat<ArticleOut>({
    model: process.env.WRITE_MODEL ?? "google/gemini-3.8-flash",
    system: ARTICLE_SYSTEM,
    user: articleUser(run.month, top, bestByCategory, taskCount),
    schema: ARTICLE_SCHEMA,
    maxTokens: 3_000,
    temperature: 0.4,
    reasoning: false,
  });

  const site = siteUrl();
  const body = assembleArticle(out.data, run.month, top, site);
  const slug = await uniqueSlug(slugify(out.data.titleMn) || `benchmark-${run.month}`);

  // Article.sourceId заавал — дотоод эх сурвалжийг нэг удаа үүсгэнэ
  const source = await prisma.source.upsert({
    where: { url: `${site}/benchmark` },
    update: {},
    create: {
      name: "AI News бенчмарк", url: `${site}/benchmark`, language: "mn",
      isActive: false, defaultCategory: "FACT",
    },
    select: { id: true },
  });

  const article = await prisma.article.create({
    data: {
      kind: "DIGEST",
      slug,
      status: "DRAFT",
      sourceId: source.id,
      sourceUrl: `internal:benchmark:${run.month}`,
      sourceTitle: `Монгол хэлний бенчмарк — ${monthLabel(run.month)}`,
      sourceHash: `benchmark-${run.month}`,
      titleMn: out.data.titleMn,
      summaryMn: out.data.leadMn,
      bodyMn: body,
      category: "FACT",
      tags: ["бенчмарк", "монгол хэл", "жагсаалт"],
      relevance: 10,
      writeModel: process.env.WRITE_MODEL ?? "",
      tokensUsed: out.tokens,
    },
    select: { slug: true, titleMn: true },
  });

  await prisma.benchRun.update({ where: { id: runId }, data: { articleId: article.slug } });
  void BENCH_CATEGORY_LABEL;
  return { slug: article.slug, title: article.titleMn ?? "" };
}
