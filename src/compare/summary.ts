/**
 * Харьцуулалтын дүгнэлт — LLM дуудлага + кэш.
 *
 * Дүгнэлтийг build үед биш, хуудсыг эхний удаа үзэхэд (lazy) бичүүлнэ. 30 хоног
 * хуучирвал дахин — үнэ, оноо хувирдаг.
 */
import { chatJson } from "../agent/llm";
import { prisma } from "../db";
import { pairKey, recommend, summaryStale, type CompareStats } from "./pair.api";
import {
  checkSummary, sanitizeSummary, SUMMARY_SCHEMA, SUMMARY_SYSTEM, summaryUser, type SummaryOutput,
} from "./summary.api";

type Chat = typeof chatJson;

export interface SummaryResult {
  summaryMn: string | null;
  /** Кэшээс уншсан эсэх — логд */
  cached: boolean;
}

/**
 * Дүгнэлтийг кэшээс уншина, байхгүй/хуучирсан бол LLM-ээр бичүүлнэ.
 *
 * LLM унасан бол хуучин дүгнэлтийг (байвал) хэвээр харуулна — хуудас хоосон болохгүй.
 */
export async function summaryFor(
  a: CompareStats,
  b: CompareStats,
  opts: { chat?: Chat; now?: Date } = {},
): Promise<SummaryResult> {
  const key = pairKey(a.slug, b.slug);
  const now = opts.now ?? new Date();

  const row = await prisma.aiModelComparison.findUnique({
    where: { pairKey: key },
    select: { summaryMn: true, generatedAt: true },
  });
  if (row?.summaryMn && !summaryStale(row.generatedAt, now)) {
    return { summaryMn: row.summaryMn, cached: true };
  }

  try {
    const chat = opts.chat ?? chatJson;
    const recs = recommend(a, b);
    let text = "";
    let costUsd = 0;

    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await chat<SummaryOutput>({
        model: process.env.WRITE_MODEL ?? "google/gemini-3.8-flash",
        system: SUMMARY_SYSTEM,
        user: summaryUser(a, b, recs),
        schema: SUMMARY_SCHEMA,
        // Бодох моделийн reasoning токен max_tokens-оос иддэг — 1200 дээр тасарч байсан
        maxTokens: 2_500,
        temperature: attempt === 0 ? 0.3 : 0.6,
        reasoning: false,
      });
      costUsd += out.costUsd;
      text = sanitizeSummary(out.data.summaryMn);
      if (checkSummary(text).length === 0) break;
      text = "";
    }
    if (!text) throw new Error("дүгнэлт шалгуур давсангүй");

    await prisma.aiModelComparison.upsert({
      where: { pairKey: key },
      create: { pairKey: key, summaryMn: text, generatedAt: now, costUsd },
      update: { summaryMn: text, generatedAt: now, costUsd: { increment: costUsd } },
    });
    return { summaryMn: text, cached: false };
  } catch (e) {
    console.warn(`  ⚠ ${key}: дүгнэлт бичигдсэнгүй — ${(e as Error).message.slice(0, 120)}`);
    // Хуучин дүгнэлт байвал түүнийг харуулна; байхгүй бол хуудас дүгнэлтгүй гарна
    return { summaryMn: row?.summaryMn ?? null, cached: true };
  }
}
