/**
 * Бенчмаркийн 30 даалгаврыг DB-д хийж, лавлах хариултыг нь хамгийн хүчтэй моделиор бичүүлнэ.
 *
 *   npm run seed:bench                  — байхгүйг нь нэмж, лавлах хариулт бичүүлнэ
 *   npm run seed:bench -- --no-reference  — зөвхөн даалгавруудыг нэмнэ (үнэгүй)
 *   npm run seed:bench -- --model openai/gpt-5.2
 *
 * Лавлах хариултыг /admin/benchmark дээрээс гараар засаж болно.
 */
import "dotenv/config";
import { chatText } from "../agent/llm";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { SEED_TASKS } from "./seed.api";
import { judgeModel } from "./models.api";

/** Лавлах хариулт нь жишиг тул хамгийн хүчтэй моделиор бичүүлнэ */
function referenceModel(): string {
  return (process.env.BENCH_REFERENCE_MODEL ?? "").trim() || judgeModel();
}

const REFERENCE_SYSTEM =
  "Чи монгол хэлний мэргэжилтэн. Дараах даалгаврыг ЖИШИГ болохуйц чанартай гүйцэтгэ. " +
  "Энэ хариултыг бусад моделийг үнэлэх лавлах болгон ашиглана. Даалгаврын заавар, " +
  "формат, хязгаарлалтыг яг дагаж, зөвхөн хүссэн үр дүнг гарга.";

export interface SeedResult {
  created: number;
  updated: number;
  references: number;
  costUsd: number;
  failed: { slug: string; error: string }[];
}

export async function seedBenchTasks(
  opts: { withReference?: boolean; model?: string } = {},
): Promise<SeedResult> {
  const model = opts.model ?? referenceModel();
  const r: SeedResult = { created: 0, updated: 0, references: 0, costUsd: 0, failed: [] };

  for (const [i, t] of SEED_TASKS.entries()) {
    const existing = await prisma.benchTask.findUnique({
      where: { slug: t.slug },
      select: { id: true, reference: true },
    });

    // rubric/checker нь Json багана — Prisma-д InputJsonValue гэж дамжуулна
    const data = {
      title: t.title,
      category: t.category,
      prompt: t.prompt,
      rubric: t.rubric as unknown as Prisma.InputJsonValue,
      checker: (t.checker ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
      weight: t.weight ?? 1,
      isPublic: t.isPublic ?? false,
    };

    const task = existing
      ? await prisma.benchTask.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.benchTask.create({ data: { slug: t.slug, ...data }, select: { id: true } });
    if (existing) r.updated++;
    else r.created++;

    // Лавлах хариулт аль хэдийн байвал дарж бичихгүй (админ гараар зассан байж болно)
    if (opts.withReference === false || existing?.reference) continue;

    try {
      const out = await chatText({
        model,
        system: REFERENCE_SYSTEM,
        user: t.prompt,
        maxTokens: 2_500,
        temperature: 0.2,
        timeoutMs: 90_000,
        // Бодох модельд reasoning токен нь max_tokens-оос иддэг — хоосон хариу гарахаас сэргийлнэ
        reasoning: false,
      });
      await prisma.benchTask.update({
        where: { id: task.id },
        data: { reference: out.text.trim().slice(0, 10_000) },
      });
      r.references++;
      r.costUsd += out.costUsd;
      console.log(`${i + 1}/${SEED_TASKS.length} ✓ ${t.slug} — лавлах ${out.text.length} тэмдэгт ($${out.costUsd.toFixed(4)})`);
    } catch (e) {
      const error = (e as Error).message.slice(0, 160);
      r.failed.push({ slug: t.slug, error });
      console.warn(`${i + 1}/${SEED_TASKS.length} ✗ ${t.slug}: ${error}`);
    }
  }
  return r;
}

if (process.argv[1]?.endsWith("seed.ts") && process.argv[1]?.includes("bench")) {
  const modelArg = process.argv.indexOf("--model");
  const r = await seedBenchTasks({
    withReference: !process.argv.includes("--no-reference"),
    model: modelArg > -1 ? process.argv[modelArg + 1] : undefined,
  });
  console.log(
    `\n${r.created} шинэ, ${r.updated} шинэчилсэн, ${r.references} лавлах хариулт, ` +
    `${r.failed.length} амжилтгүй — $${r.costUsd.toFixed(3)}`,
  );
  await prisma.$disconnect();
}
