/**
 * `npm run studio:eval` — 25 бодит монгол хүсэлт дээр студийг ажиллуулж, LLM шүүгчээр
 * 1–10 оноо тавина.
 *
 * DB хөндөхгүй: session үүсгэхгүй, зөвхөн LLM дуудна. Төсвийг хатуу барина —
 * `--budget` (анхдагч $0.30) хэтэрвэл тэр даруй зогсоно.
 *
 *   npm run studio:eval -- --limit 3
 *   npm run studio:eval -- --spread          # хэлбэр тус бүрээс нэг
 *   npm run studio:eval -- --budget 0.3
 *   npm run studio:eval -- --only office-newyear-video --dump /tmp/studio
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chatJson } from "../agent/llm";
import { isEntry, runCli } from "../lib/cli";
import { askQuestions, buildBrief, buildDirections, buildOutput, scoreModel } from "./run";
import { DECIDE_OPTION } from "./prompts.api";
import type { StudioFormat } from "./studio.api";
import { defaultTools } from "./studio.api";
import {
  autoAnswer, CRITERIA, CRITERION_LABEL, JUDGE_SCHEMA, JUDGE_SYSTEM, normalizeVerdict, average,
  spread, summarize, TARGET_AVG, TARGET_P90_SECONDS, TARGET_SECONDS,
  type EvalRequest, type EvalRow, type EvalVerdict,
} from "./eval.api";
import type { StudioOutput } from "./output.api";

export const DEFAULT_BUDGET_USD = 0.3;

export function loadRequests(): EvalRequest[] {
  const path = join(process.cwd(), "src", "studio", "eval", "requests.json");
  return JSON.parse(readFileSync(path, "utf8")) as EvalRequest[];
}

/** Шүүгчид бүтэн багцыг текстээр өгнө */
export function judgeInput(r: EvalRequest, out: StudioOutput): string {
  const tools = out.tools
    .map((t) =>
      [
        `### ${t.tool}`,
        `PROMPT: ${t.prompt}`,
        t.params.map((p) => `param ${p.name}=${p.value} — ${p.why}`).join("\n"),
        t.parts.map((p) => `хэсэг «${p.part}» — ${p.why}`).join("\n"),
        `Алхам:\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
      ].filter(Boolean).join("\n"),
    )
    .join("\n\n");

  return [
    `ХЭРЭГЛЭГЧ (${r.persona}): ${r.request}`,
    "",
    "=== ГАРГАСАН БАГЦ ===",
    tools,
    out.storyboard.length ? `\nКадарууд:\n${out.storyboard.map((s) => `${s.n}. (${s.seconds}с) ${s.mn} | ${s.prompt}`).join("\n")}` : "",
    out.consistency ? `\nДүрийн тогтвортой байдал: ${out.consistency}` : "",
    out.music ? `\nХөгжим: ${out.music.prompt} — ${out.music.mn}` : "",
    out.assembly.length ? `\nУгсралт:\n${out.assembly.join("\n")}` : "",
    out.ideas.length ? `\nНэмэлт санаа:\n${out.ideas.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

type Chat = typeof chatJson;

export async function judge(
  r: EvalRequest,
  out: StudioOutput,
  opts: { chat?: Chat } = {},
): Promise<{ verdict: EvalVerdict; costUsd: number }> {
  const chat = opts.chat ?? chatJson;
  const res = await chat<Partial<EvalVerdict>>({
    model: scoreModel(),
    system: JUDGE_SYSTEM,
    user: judgeInput(r, out),
    schema: JUDGE_SCHEMA,
    maxTokens: 2_000,
    temperature: 0,
    reasoning: false,
  });
  return { verdict: normalizeVerdict(res.data), costUsd: res.costUsd };
}

/** Нэг хүсэлтийг бүтнээр нь ажиллуулна — хариултыг автоматаар сонгоно */
export async function runOne(
  r: EvalRequest,
  opts: { chat?: Chat; dump?: string } = {},
): Promise<EvalRow> {
  const started = Date.now();
  const format = r.format as StudioFormat;
  let costUsd = 0;
  const lap = () => {
    const now = Date.now();
    const ms = now - mark;
    mark = now;
    return Math.round(ms / 100) / 10;
  };
  let mark = started;

  const q = await askQuestions({ request: r.request, format, known: [], round: 0 }, opts);
  costUsd += q.costUsd;
  const tQuestions = lap();

  const answers = Object.fromEntries(
    q.questions.map((x) => [x.field, autoAnswer(x.options, DECIDE_OPTION)]),
  );

  const b = await buildBrief({ request: r.request, format, answers }, opts);
  costUsd += b.costUsd;
  const tBrief = lap();

  const d = await buildDirections({ brief: b.brief, format }, opts);
  costUsd += d.costUsd;
  const tDirections = lap();
  const direction = d.directions[0];
  if (!direction) throw new Error("чиглэл гарсангүй");

  const o = await buildOutput(
    { brief: b.brief, format, direction, toolIds: defaultTools(format), request: r.request },
    opts,
  );
  costUsd += o.costUsd;
  const tOutput = lap();

  const j = await judge(r, o.output, opts);
  costUsd += j.costUsd;
  const tJudge = lap();

  // Тайланд бүтэн жишээ хэрэгтэй үед — бүх шатыг хадгална
  if (opts.dump) {
    mkdirSync(opts.dump, { recursive: true });
    writeFileSync(
      join(opts.dump, `${r.id}.json`),
      JSON.stringify(
        { request: r, answers, brief: b.brief, directions: d.directions, direction, output: o.output, verdict: j.verdict },
        null, 2,
      ),
      "utf8",
    );
  }

  const { weakness, ...scores } = j.verdict;
  return {
    ...r,
    scores,
    stripped: o.stripped.length,
    stepSeconds: {
      questions: tQuestions, brief: tBrief, directions: tDirections,
      output: tOutput, judge: tJudge,
    },
    avg: average(scores),
    weakness,
    costUsd,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    issues: o.issues,
  };
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

if (isEntry("eval.ts")) {
  void runCli(async () => {
    const all = loadRequests();
    const only = arg("only");
    const limit = Number(arg("limit", String(all.length)));
    const budget = Number(arg("budget", String(DEFAULT_BUDGET_USD)));
    const dump = arg("dump");

    const picked = only
      ? all.filter((r) => r.id === only)
      : process.argv.includes("--spread")
        ? spread(all)
        : all;
    const list = picked.slice(0, limit);
    if (list.length === 0) throw new Error("Хүсэлт олдсонгүй");

    console.log(`Студийн үнэлгээ — ${list.length} хүсэлт, төсөв $${budget.toFixed(2)}\n`);

    const rows: EvalRow[] = [];
    let spent = 0;
    for (const r of list) {
      if (spent >= budget) {
        console.log(`\n⚠ Төсөв дүүрсэн ($${spent.toFixed(4)}) — үлдсэн ${list.length - rows.length}-ыг алгаслаа`);
        break;
      }
      try {
        const row = await runOne(r, dump ? { dump } : {});
        spent += row.costUsd;
        rows.push(row);
        console.log(
          `  ${row.avg.toFixed(1).padStart(4)} · ${row.id.padEnd(28)} ` +
            `$${row.costUsd.toFixed(4)} · ${row.seconds}с (гаргалт ${row.stepSeconds.output}с)` +
            (row.stripped ? ` · ${row.stripped} зохиомол тоо хасав` : "") +
            (row.issues.length ? ` · ⚠ ${row.issues.length} алдаа` : ""),
        );
      } catch (e) {
        console.log(`  ✗ ${r.id}: ${(e as Error).message.slice(0, 100)}`);
      }
    }

    if (rows.length === 0) throw new Error("Нэг ч хүсэлт биелсэнгүй");
    const s = summarize(rows);

    console.log(`\n=== ДҮН (${s.rows} хүсэлт) ===`);
    for (const c of CRITERIA) {
      console.log(`  ${CRITERION_LABEL[c].padEnd(24)} ${s.byCriterion[c].toFixed(1)}`);
    }
    console.log(`  ${"ДУНДАЖ".padEnd(24)} ${s.avg.toFixed(1)}`);
    console.log(
      `\nЗардал: $${s.costUsd.toFixed(4)} нийт · $${s.avgCost.toFixed(4)}/бүтээл\n` +
        `Хугацаа: ${s.avgSeconds.toFixed(1)}с дундаж · p90 ${s.p90Seconds}с ` +
        `(зорилт ${TARGET_SECONDS}с / ${TARGET_P90_SECONDS}с)\n` +
        `Зохиомол тоо: ${s.stripped} (зорилт 0)`,
    );
    const pass = s.avg >= TARGET_AVG && s.stripped === 0 && s.outputP90 <= TARGET_P90_SECONDS;
    console.log(pass ? "\n✓ бүх зорилт хангагдлаа" : `\n⚠ зорилт хангагдаагүй (дундаж ${s.avg}/${TARGET_AVG})`);

    console.log("\n=== ХАМГИЙН МУУ 3 ===");
    for (const w of s.worst) {
      console.log(`  ${w.avg.toFixed(1)} · ${w.id} (${w.persona})`);
      console.log(`      ${w.request}`);
      console.log(`      сул тал: ${w.weakness}`);
    }
  });
}
