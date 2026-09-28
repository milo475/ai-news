/**
 * Бенчмаркийн ажиллагаа: модель бүрийг бүх даалгавраар дуудаж, шүүгчээр үнэлж, дүгнэнэ.
 *
 *   npm run bench                    — энэ сарын run
 *   npm run bench -- --month 2026-10 — тодорхой сар
 *   npm run bench -- --models openai/gpt-5.2,google/gemini-3.8-pro --tasks 5
 *
 * Төсөв (BENCH_BUDGET_USD) хэтэрвэл эхэлсэн моделиудаа дуусгаад зогсоно.
 */
import "dotenv/config";
import { chatJson, chatText, isAuthError } from "../agent/llm";
import { balanceMessage, openRouterBalance } from "../lib/balance";
import { classifyError, completeness, completenessLabel, INFRA_RETRIES } from "./failure.api";
import { isEntry, runCli } from "../lib/cli";
import { prisma } from "../db";
import { jobRunMeta } from "../jobs/meta";
import { benchModels } from "./models";
import { judgeModel, judgeModel2 } from "./models.api";
import { judge } from "./judge";
import { benchBudget, canStartModel, estimateCost } from "./budget.api";
import { parseChecker, parseRubric, runChecker, wordCount } from "./task.api";
import { currentMonth, summarize, type ScoredResult } from "./summary.api";
import { needsSecondJudge } from "./judge.api";

/**
 * Эхлэхийн өмнөх үлдэгдлийн нөөцийн коэффициент.
 *
 * Тооцоо нь дундажаар гардаг тул яг таарч эхлээд дундуур дуусах эрсдэлтэй.
 * 1.5 дахин нөөцтэй байж байж эхэлнэ.
 */
export const BALANCE_HEADROOM = 1.5;

/**
 * Даалгавар бүрд ижил нөхцөл — temperature 0, 60с.
 *
 * max_tokens 1200 байсныг 2500 болгов: бодох (reasoning) моделиуд дотоод бодолтдоо
 * 700–800 токен зарцуулдаг тул хариулахад 400 орчим л үлдэж, хариу хоосон гардаг
 * байсан (2026-09-27: deepseek-v4.1-flash 13, space-bunny-alpha 11 удаа хоосон).
 * Хязгаар нь БҮХ модельд ижил тул харьцуулалтын шударга байдал алдагдахгүй.
 */
const TASK_MAX_TOKENS = 2_500;
const TASK_TIMEOUT_MS = 60_000;

/** Модель бүрд өгөх ерөнхий заавар — даалгавраас гадна юу ч нэмэхгүй */
const TASK_SYSTEM =
  "Даалгаврыг яг заасан ёсоор гүйцэтгэ. Нэмэлт тайлбар, оршил, төгсгөлийн үг бүү бич — " +
  "зөвхөн хүссэн үр дүнг гарга.";

export interface RunOptions {
  month?: string;
  /** Зөвхөн эдгээр моделиор (туршилтад) */
  models?: string[];
  /** Хэдэн даалгавар авах (туршилтад) */
  taskLimit?: number;
  budgetUsd?: number;
  /** Нийтлэл автоматаар үүсгэх эсэх */
  writeArticle?: boolean;
  /** Үлдэгдлийн урьдчилсан шалгалтыг алгасах (зөвхөн тест) */
  skipBalanceCheck?: boolean;
  chat?: typeof chatJson;
  text?: typeof chatText;
}

export interface RunSummary {
  month: string;
  runId: string;
  models: number;
  tasks: number;
  results: number;
  costUsd: number;
  status: "DONE" | "BUDGET" | "FAILED";
  note: string | null;
  top: { modelSlug: string; avgScore: number }[];
  articleSlug?: string;
}

export async function runBenchmark(opts: RunOptions = {}): Promise<RunSummary> {
  // JobRun — /admin дээр явц харагдах, давхар ажиллахаас хамгаалах
  const job = await prisma.jobRun.create({ data: { job: "bench", ...jobRunMeta() } });
  try {
    return await execute(opts, job.id);
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: job.id },
      data: { finishedAt: new Date(), ok: false, error: String(e).slice(0, 1000) },
    });
    throw e;
  }
}

async function execute(opts: RunOptions, jobId: string): Promise<RunSummary> {
  const month = opts.month ?? currentMonth();
  const text = opts.text ?? chatText;
  const chat = opts.chat ?? chatJson;
  const budget = opts.budgetUsd ?? benchBudget();

  const tasks = await prisma.benchTask.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { slug: "asc" }],
    ...(opts.taskLimit ? { take: opts.taskLimit } : {}),
    select: {
      id: true, slug: true, title: true, category: true, prompt: true, reference: true,
      rubric: true, checker: true, weight: true,
    },
  });
  if (tasks.length === 0) throw new Error("Идэвхтэй даалгавар алга — npm run seed:bench ажиллуулна уу");

  const models = opts.models?.length ? opts.models : await benchModels();
  if (models.length === 0) throw new Error("Тестлэх модель олдсонгүй (жагсаалт хоосон байна)");

  const jModel = judgeModel();
  const jModel2 = judgeModel2();
  const selfJudged = models.filter((m) => needsSecondJudge(jModel, m)).length;

  const estimate = estimateCost(models.length, tasks.length, selfJudged);
  console.log(
    `Бенчмарк ${month}: ${models.length} модель × ${tasks.length} даалгавар\n` +
    `  шүүгч: ${jModel}${jModel2 ? ` (2: ${jModel2}, ${selfJudged} модельд)` : ""}\n` +
    `  ойролцоо ${estimate.calls} дуудлага ≈ $${estimate.usd.toFixed(2)} · төсөв $${budget.toFixed(2)}`,
  );

  // Эхлэхийн ӨМНӨ үлдэгдлийг шалгана. Run дундуур кредит дуусвал хагас дүн
  // үлддэг — 2026-09-27-нд яг ингэж хуурамч оноо нийтэд гарсан.
  const needUsd = Math.round(estimate.usd * BALANCE_HEADROOM * 100) / 100;
  const balance = opts.skipBalanceCheck ? null : await openRouterBalance();
  if (balance !== null && balance < needUsd) {
    throw new Error(
      `OpenRouter үлдэгдэл $${balance.toFixed(2)} — энэ run-д дор хаяж $${needUsd.toFixed(2)} ` +
        `хэрэгтэй (тооцоо $${estimate.usd.toFixed(2)} × ${BALANCE_HEADROOM}).\n` +
        `  Цэнэглэх: openrouter.ai/settings/credits\n` +
        `  Эсвэл багасгах: npm run bench -- --models <нэг хоёр> --tasks 5`,
    );
  }
  console.log(
    balance === null
      ? "  үлдэгдэл: мэдэгдэхгүй (шалгалт алгасав)"
      : `  үлдэгдэл: $${balance.toFixed(2)} (шаардлага $${needUsd.toFixed(2)})`,
  );

  // Сар бүр нэг run — дахин ажиллуулбал хуучныг нь солино
  await prisma.benchRun.deleteMany({ where: { month } });
  const run = await prisma.benchRun.create({
    data: { month, judgeModel: jModel, judgeModel2: jModel2, status: "RUNNING" },
    select: { id: true },
  });

  let spent = 0;
  let stopped: string | null = null;
  const scored: ScoredResult[] = [];

  /** Модель бүрийг даалгавруудаар нь дуудна. Дундуур шидвэл run нь FAILED болно. */
  async function runModels(): Promise<void> {
    for (const [mi, modelSlug] of models.entries()) {
      if (!canStartModel(spent, budget, tasks.length)) {
        stopped = `Төсөв дүүрсэн тул ${models.length - mi} модель тестлэгдсэнгүй ($${spent.toFixed(2)}/$${budget.toFixed(2)})`;
        console.warn(`⚠ ${stopped}`);
        break;
      }
      console.log(`\n[${mi + 1}/${models.length}] ${modelSlug}`);

      for (const task of tasks) {
        const rubric = parseRubric(task.rubric);
        const checker = parseChecker(task.checker);

        let output = "";
        let latencyMs = 0;
        let tokensIn = 0;
        let tokensOut = 0;
        let costUsd = 0;
        let error: string | null = null;
        let errorKind: string | null = null;
        let finishReason: string | null = null;
        let reasoningTokens = 0;

        // Дэд бүтцийн алдааг нэг удаа дахин оролдоно; моделийн алдааг оролдохгүй
        for (let tryNo = 0; tryNo <= INFRA_RETRIES; tryNo++) {
          try {
            const r = await text({
              model: modelSlug,
              system: TASK_SYSTEM,
              user: task.prompt,
              maxTokens: TASK_MAX_TOKENS,
              temperature: 0,
              timeoutMs: TASK_TIMEOUT_MS,
            });
            output = r.text;
            latencyMs = r.latencyMs;
            tokensIn = r.tokensIn;
            tokensOut = r.tokensOut;
            costUsd = r.costUsd;
            finishReason = r.finishReason;
            reasoningTokens = r.reasoningTokens;
            spent += r.costUsd;
            error = null;
            errorKind = null;
            break;
          } catch (e) {
            // Түлхүүр буруу / кредит дууссан — бүх модель ижил унана, run бүхэлдээ FAILED
            if (isAuthError(e)) throw e;
            error = (e as Error).message.slice(0, 200);
            errorKind = classifyError(error);
            if (errorKind === "infra" && tryNo < INFRA_RETRIES) {
              console.warn(`   ↻ ${task.slug}: дэд бүтцийн алдаа — дахин оролдоно`);
              continue;
            }
            console.warn(`   ${errorKind === "infra" ? "⚠" : "✗"} ${task.slug}: ${error}`);
            break;
          }
        }

        const check = error ? null : runChecker(checker, output);

        // Хариу өгөөгүй, эсвэл тодорхой шалгалт унасан бол шүүгчийг зовоохгүй (зардал хэмнэнэ)
        let judgeScore: number | null = null;
        let judgeScore2: number | null = null;
        let judgeNotes: string | null = null;
        if (!error && check?.pass !== false) {
          try {
            const v = await judge(
              { taskTitle: task.title, prompt: task.prompt, reference: task.reference, rubric, output },
              { modelSlug, judgeModel: jModel, judgeModel2: jModel2 },
              { chat },
            );
            judgeScore = v.score;
            judgeScore2 = v.score2;
            judgeNotes = v.note;
            spent += v.costUsd;
          } catch (e) {
            if (isAuthError(e)) throw e;
            judgeNotes = `шүүгч ажиллсангүй: ${(e as Error).message.slice(0, 120)}`;
            // Оноогүй үлдэнэ (judgeScore = null) — 0 гэж тоолохгүй.
            // Шүүгчийн дэд бүтцийн алдаа бол даалгаврыг дундажаас бүрэн хасна.
            if (classifyError((e as Error).message) === "infra") errorKind = "infra";
            console.warn(`   ⚠ ${task.slug}: ${judgeNotes}`);
          }
        } else if (check?.pass === false) {
          judgeNotes = `Тодорхой шалгалт унасан: ${check.detail}`;
        }

        const outputWords = wordCount(output);
        await prisma.benchResult.create({
          data: {
            runId: run.id, modelSlug, taskId: task.id, output: output.slice(0, 20_000),
            latencyMs, tokensIn, tokensOut, costUsd, outputWords,
            judgeScore, judgeScore2, judgeNotes,
            checkerPass: check ? check.pass : null,
            error, errorKind, finishReason, reasoningTokens,
          },
        });

        scored.push({
          modelSlug, category: task.category, weight: task.weight,
          latencyMs, costUsd, outputWords, judgeScore, checkerPass: check?.pass ?? null,
          error, errorKind,
        });
      }

      const mine = scored.filter((s) => s.modelSlug === modelSlug);
      const avg = summarize(mine)[0];
      const c = completeness(
        mine.map((r) => ({ error: r.error, errorKind: r.errorKind, score: r.judgeScore ?? null })),
      );
      if (!avg || avg.incomplete) {
        console.warn(
          `   ⚠ ${modelSlug}: дутуу (${completenessLabel(c)}) — нийтэд харуулахгүй`,
        );
        continue;
      }
      console.log(
        `   дүн ${avg.avgScore.toFixed(2)}/10 · ${completenessLabel(c)} · $${spent.toFixed(3)} нийт`,
      );
    }
  }

  try {
    await runModels();
  } catch (e) {
    // Дундуур тасарсан (түлхүүр буруу гэх мэт) — run нь үүрд RUNNING үлдэх ёсгүй
    await prisma.benchRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(), status: "FAILED", costUsd: spent,
        note: (e as Error).message.slice(0, 500),
      },
    });
    throw e;
  }

  // Дүгнэлт нь даалгаврын ≥90%-д оноо гарсан модельд л бичигдэнэ. Дутуу нь
  // «incomplete» гэж тэмдэглэгдэж, /admin дээр харагдах ч НИЙТЭД гарахгүй.
  const all = summarize(scored);
  const summaries = all.filter((s) => !s.incomplete);
  const partial = all.filter((s) => s.incomplete);

  // Нэг ч бүтэн дүн гарсангүй — run амжилтгүй. Дүгнэлт, нийтлэл үүсгэхгүй.
  const allFailed = summaries.length === 0 && scored.length > 0;
  const failNote = allFailed
    ? `Нэг ч модель даалгаврын 90%-д оноо авсангүй (${partial.length} дутуу) — ` +
      `түлхүүр, үлдэгдэл, сүлжээгээ шалгана уу`
    : null;

  if (!allFailed) {
    // Эрэмбийг бүтэн дүнгүүдийн дотор дахин тооцно — дутуу нь байр эзлэхгүй
    await prisma.benchModelSummary.createMany({
      data: summaries.map((s, i) => ({
        runId: run.id, modelSlug: s.modelSlug, avgScore: s.avgScore,
        scoreByCategory: s.scoreByCategory, avgLatency: s.avgLatency,
        costPer1kMn: s.costPer1kMn, completed: s.completed,
        scored: s.scored, infra: s.infra, incomplete: false, rank: i + 1,
      })),
    });
  }
  // Дутуу дүнг ч хадгална — /admin дээр яагаад дутсаныг харна.
  // Run бүхэлдээ унасан бол юу ч бичихгүй: хагас өгөгдөл нь BenchResult-д хэвээр.
  if (!allFailed && partial.length > 0) {
    await prisma.benchModelSummary.createMany({
      data: partial.map((s, i) => ({
        runId: run.id, modelSlug: s.modelSlug, avgScore: s.avgScore,
        scoreByCategory: s.scoreByCategory, avgLatency: s.avgLatency,
        costPer1kMn: s.costPer1kMn, completed: s.completed,
        scored: s.scored, infra: s.infra, incomplete: true, rank: summaries.length + i + 1,
      })),
    });
  }

  const status = allFailed ? "FAILED" : stopped ? "BUDGET" : "DONE";
  const notes = [
    stopped,
    partial.length > 0 ? `дутуу (нийтлэгдээгүй): ${partial.map((s) => s.modelSlug).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const note = failNote ?? (notes || null);

  await prisma.benchRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), costUsd: spent, status, note },
  });

  const result: RunSummary = {
    month, runId: run.id, models: summaries.length, tasks: tasks.length,
    results: scored.length, costUsd: spent, status, note,
    top: summaries.slice(0, 5).map((s) => ({ modelSlug: s.modelSlug, avgScore: s.avgScore })),
  };

  if (allFailed) {
    await prisma.jobRun.update({
      where: { id: jobId },
      data: {
        finishedAt: new Date(), ok: false,
        itemsIn: models.length * tasks.length, itemsOut: 0,
        attempted: scored.length, failed: scored.length,
        costUsd: spent, error: failNote,
      },
    });
    console.error(`
✗ ${failNote}`);
    console.error("  Дүгнэлт ч, нийтлэл ч үүсгэсэнгүй. Засаад дахин: npm run bench");
    return result;
  }

  if (opts.writeArticle !== false && summaries.length >= 3) {
    try {
      const { writeBenchArticle } = await import("./article");
      const a = await writeBenchArticle(run.id, { chat });
      result.articleSlug = a.slug;
      console.log(`\nНийтлэл (DRAFT): /medee/${a.slug}`);
    } catch (e) {
      console.warn(`⚠ нийтлэл бичигдсэнгүй: ${(e as Error).message.slice(0, 160)}`);
    }
  }

  await prisma.jobRun.update({
    where: { id: jobId },
    data: {
      finishedAt: new Date(), ok: true,
      itemsIn: models.length * tasks.length, itemsOut: scored.length,
      costUsd: spent,
      ...(note ? { error: note } : {}),
    },
  });

  console.log(
    `\n${status === "BUDGET" ? "⚠ төсвөөр зогслоо" : "✓ дууслаа"} — ` +
    `${summaries.length} модель, $${spent.toFixed(3)}`,
  );
  for (const s of summaries.slice(0, 5)) {
    console.log(`  ${s.rank}. ${s.modelSlug} — ${s.avgScore.toFixed(2)}/10 · ${s.avgLatency}мс`);
  }
  return result;
}

if (isEntry("run.ts") && process.argv[1]?.includes("bench")) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  const models = arg("models")?.split(",").map((s) => s.trim()).filter(Boolean);
  const taskLimit = arg("tasks") ? Number(arg("tasks")) : undefined;
  const budgetUsd = arg("budget") ? Number(arg("budget")) : undefined;

  await runCli(async () => {
    const r = await runBenchmark({
      month: arg("month"),
      models,
      taskLimit,
      budgetUsd,
      writeArticle: !process.argv.includes("--no-article"),
    });
    // Бүх модель бүтэлгүйтсэн бол cron/CI үүнийг алдаа гэж мэдэх ёстой
    if (r.status === "FAILED") throw new Error(r.note ?? "бенчмарк амжилтгүй");
  });
}
