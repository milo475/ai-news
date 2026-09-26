/**
 * Сайтын 40 prompt-ыг LLM-ээр бичүүлж PUBLISHED-ээр хадгална.
 *
 *   npm run seed:prompts             — байхгүйг нь бичүүлнэ
 *   npm run seed:prompts -- --only 5 — эхний 5
 *
 * Давтан ажиллуулахад аюулгүй: Prompt.topic-оор давхардлыг шалгана.
 */
import "dotenv/config";
import { chatJson, isAuthError } from "../agent/llm";
import { prisma } from "../db";
import { slugify } from "../agent/slug";
import { extractVariables } from "./prompt.api";
import { uniquePromptSlug } from "./mutations";
import {
  checkSeed, sanitizeSeed, SEED_SCHEMA, SEED_SYSTEM, SEED_TOPICS, type SeedDraft, type SeedTopic,
} from "./seed.api";
import { PROMPT_CATEGORY_HINT, PROMPT_CATEGORY_LABEL } from "./prompt.api";
import { runCli } from "../lib/cli";

type Chat = typeof chatJson;

/** Нэг сэдвээр prompt бичүүлнэ. Шалгуур давахгүй бол нэг удаа дахин. */
export async function writeSeedPrompt(
  t: SeedTopic,
  opts: { chat?: Chat } = {},
): Promise<{ draft: SeedDraft; variables: string[]; costUsd: number }> {
  const chat = opts.chat ?? chatJson;
  let costUsd = 0;
  let problems: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<SeedDraft>({
      model: process.env.WRITE_MODEL ?? "google/gemini-3.8-flash",
      system: SEED_SYSTEM,
      user: [
        `Сэдэв: ${t.topic}`,
        `Ангилал: ${PROMPT_CATEGORY_LABEL[t.category]} (${PROMPT_CATEGORY_HINT[t.category]})`,
        ...(attempt === 0 ? [] : ["", `Өмнөх оролдлого амжилтгүй: ${problems.join("; ")}`]),
      ].join("\n"),
      schema: SEED_SCHEMA,
      maxTokens: 2_500,
      temperature: attempt === 0 ? 0.7 : 0.9,
      reasoning: false,
    });
    costUsd += out.costUsd;

    const draft = sanitizeSeed(out.data);
    const variables = extractVariables(draft.body);
    const found = checkSeed(draft, variables);
    if (found.length === 0) return { draft, variables, costUsd };

    problems = found.map((f) => f.detail);
    console.warn(`   ⚠ ${problems.join("; ")}`);
  }
  throw new Error(`Prompt бичигдсэнгүй: ${problems.join("; ")}`);
}

export async function alreadyWritten(topic: string): Promise<boolean> {
  const found = await prisma.prompt.findFirst({ where: { topic }, select: { id: true } });
  return found !== null;
}

export interface SeedResult {
  created: { slug: string; topic: string }[];
  skipped: string[];
  failed: { topic: string; error: string }[];
  costUsd: number;
}

export async function seedPrompts(opts: { only?: number } = {}): Promise<SeedResult> {
  const topics = opts.only ? SEED_TOPICS.slice(0, opts.only) : SEED_TOPICS;
  const r: SeedResult = { created: [], skipped: [], failed: [], costUsd: 0 };

  for (const [i, t] of topics.entries()) {
    if (await alreadyWritten(t.topic)) {
      console.log(`${i + 1}/${topics.length} ⏭  ${t.topic}`);
      r.skipped.push(t.topic);
      continue;
    }
    console.log(`${i + 1}/${topics.length} ✎ ${t.topic}`);
    try {
      const { draft, variables, costUsd } = await writeSeedPrompt(t);
      r.costUsd += costUsd;

      const slug = await uniquePromptSlug(slugify(draft.title));
      await prisma.prompt.create({
        data: {
          slug,
          title: draft.title,
          body: draft.body,
          description: draft.description,
          category: t.category,
          tools: draft.tools,
          language: "MN",
          variables,
          topic: t.topic,
          source: "SITE",
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      r.created.push({ slug, topic: t.topic });
      console.log(`   ✓ /prompt/${slug} — ${variables.length} хувьсагч ($${costUsd.toFixed(4)})`);
    } catch (e) {
      // Түлхүүр буруу/хүчингүй бол дараагийнх нь ч мөн л унана — шууд зогсоно
      if (isAuthError(e)) throw e;
      const error = (e as Error).message.slice(0, 160);
      r.failed.push({ topic: t.topic, error });
      console.warn(`   ✗ ${error}`);
    }
  }
  return r;
}

if (process.argv[1]?.endsWith("seed.ts") && process.argv[1]?.includes("prompts")) {
  await runCli(async () => {
    const onlyArg = process.argv.indexOf("--only");
    const r = await seedPrompts({ only: onlyArg > -1 ? Number(process.argv[onlyArg + 1]) : undefined });
    console.log(
      `\n${r.created.length} шинэ, ${r.skipped.length} алгассан, ${r.failed.length} амжилтгүй — ` +
      `нийт $${r.costUsd.toFixed(3)}`,
    );
  });
}
