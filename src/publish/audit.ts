/**
 * `npm run publish:audit` — НИЙТЛЭГДСЭН мэдээг эх сурвалжтай нь тулгана.
 *
 *   npm run publish:audit                    # сүүлийн 30 хоног, механик шалгалт ($0)
 *   npm run publish:audit -- --days 14
 *   npm run publish:audit -- --judge         # + LLM шүүгч (claim тус бүрээр)
 *   npm run publish:audit -- --judge --budget 0.40
 *   npm run publish:audit -- --slug <slug>   # нэг нийтлэл
 *
 * DB-ээс ЗӨВХӨН УНШИНА — юу ч бичихгүй. Production дээр аюулгүй ажиллана.
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { chatJson } from "../agent/llm";
import { checkBeforePublish, offendingSentence, sameEvent, type FieldIssue } from "./prepublish.api";
import { buildCaption } from "./instagram.api";
import {
  AUDIT_BODY_CHARS, CLAIMS_SCHEMA, CLAIMS_SYSTEM, claimsUser, duplicatePairs, evidence, groupIssues,
  needsJudge, normalizeClaims, rankRows, RULE_EVIDENCE, riskTopics, worstSeverity,
  type AuditRow, type ClaimIssue, type DuplicatePair,
} from "./audit.api";

/** Аудитын шүүгч — prepublish-ийн шүүгчтэй нэг модель (FIDELITY_MODEL) */
const JUDGE_MODEL =
  (process.env.FIDELITY_MODEL ?? "").trim() || process.env.SCORE_MODEL || "deepseek/deepseek-v4.1-flash";

/** LLM шүүгчийн анхдагч дээд зардал */
export const DEFAULT_AUDIT_BUDGET = 0.4;

const SELECT = {
  slug: true, titleMn: true, summaryMn: true, bodyMn: true, category: true, kind: true,
  publishedAt: true, publishedAtSource: true, sourceUrl: true, sourceText: true,
  fbHook: true, fbText: true, igMediaId: true,
  source: { select: { name: true } },
  companies: { select: { name: true } },
} as const;

type Row = {
  slug: string; titleMn: string | null; summaryMn: string | null; bodyMn: string | null;
  category: string; kind: string; publishedAt: Date | null; publishedAtSource: Date | null;
  sourceUrl: string; sourceText: string | null; fbHook: string | null; fbText: string | null;
  igMediaId: string | null; source: { name: string } | null;
  companies: { name: string }[];
};

/** Сүүлийн N хоногт нийтлэгдсэн мэдээ, тойм (шинээс хуучин руу) */
export async function publishedSince(days: number, slug?: string): Promise<Row[]> {
  return prisma.article.findMany({
    where: slug
      ? { slug }
      : { status: "PUBLISHED", publishedAt: { gte: new Date(Date.now() - days * 86_400_000) } },
    orderBy: { publishedAt: "desc" },
    select: SELECT,
  }) as Promise<Row[]>;
}

/** Нэг нийтлэлийн механик шалгалт ($0) */
export function mechanical(a: Row): FieldIssue[] {
  return checkBeforePublish({
    titleMn: a.titleMn,
    summaryMn: a.summaryMn,
    bodyMn: a.bodyMn,
    fbHook: a.fbHook,
    fbText: a.fbText,
    sourceText: a.sourceText,
    publishedAtSource: a.publishedAtSource,
    sourceName: a.source?.name ?? null,
  });
}

/** LLM шүүгч — нэг нийтлэлийн бүх claim-ийг нэг дуудлагаар */
export async function judgeClaims(
  a: Row,
  opts: { chat?: typeof chatJson } = {},
): Promise<{ claims: ClaimIssue[]; costUsd: number }> {
  const chat = opts.chat ?? chatJson;
  if (!a.sourceText || !a.titleMn || !a.bodyMn) return { claims: [], costUsd: 0 };

  const out = await chat<{ claims: ClaimIssue[] }>({
    model: JUDGE_MODEL,
    system: CLAIMS_SYSTEM,
    user: claimsUser({
      titleMn: a.titleMn,
      summaryMn: a.summaryMn ?? "",
      bodyMn: a.bodyMn,
      sourceText: a.sourceText,
    }),
    schema: CLAIMS_SCHEMA,
    maxTokens: 2_000,
    temperature: 0,
    reasoning: false,
  });
  return { claims: normalizeClaims(out.data), costUsd: out.costUsd };
}

export interface AuditResult {
  checked: number;
  judged: number;
  rows: AuditRow[];
  costUsd: number;
  /** Төсөв дүүрсэн тул шалгагдаагүй нийтлэлүүд */
  skippedForBudget: string[];
  /** Нэг үйл явдлыг хоёр удаа нийтэлсэн хосууд */
  duplicates: DuplicatePair[];
}

export async function runAudit(opts: {
  days?: number;
  slug?: string;
  judge?: boolean;
  budget?: number;
  chat?: typeof chatJson;
} = {}): Promise<AuditResult> {
  const rows = await publishedSince(opts.days ?? 30, opts.slug);
  const budget = opts.budget ?? DEFAULT_AUDIT_BUDGET;
  const out: AuditRow[] = [];
  const skippedForBudget: string[] = [];
  let costUsd = 0;
  let judged = 0;

  for (const a of rows) {
    const text = [a.titleMn, a.summaryMn, a.bodyMn, a.fbHook, a.fbText].filter(Boolean).join("\n");
    const issues = mechanical(a);
    const topics = riskTopics(text);
    const row: AuditRow = {
      slug: a.slug,
      titleMn: a.titleMn ?? "(гарчиггүй)",
      publishedAt: a.publishedAt,
      sourceName: a.source?.name ?? "?",
      sourceUrl: a.sourceUrl,
      topics,
      issues,
      claims: [],
      costUsd: 0,
    };

    const { judge } = needsJudge({ slug: a.slug, text, issues });
    if (opts.judge && judge && a.sourceText) {
      if (costUsd >= budget) {
        skippedForBudget.push(a.slug);
      } else {
        try {
          const r = await judgeClaims(a, { chat: opts.chat });
          row.claims = r.claims;
          row.costUsd = r.costUsd;
          costUsd += r.costUsd;
          judged++;
        } catch (e) {
          console.warn(`  ⚠ ${a.slug}: шүүгч ажиллсангүй — ${(e as Error).message.slice(0, 120)}`);
        }
      }
    }
    out.push(row);
  }

  // Нэг үйл явдал хоёр нийтлэл болсон эсэх — LLM-гүй, $0
  const duplicates = duplicatePairs(
    rows
      .filter((a) => a.kind === "NEWS")
      .map((a) => ({
        slug: a.slug, titleMn: a.titleMn ?? "", summaryMn: a.summaryMn ?? "",
        category: a.category, companies: a.companies.map((c) => c.name), publishedAt: a.publishedAt,
      })),
    (x, y) => sameEvent(x, y),
  );

  return { checked: rows.length, judged, rows: out, costUsd, skippedForBudget, duplicates };
}

// ---------- Тайлан ----------

function ub(d: Date | null): string {
  return d ? new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10) : "—";
}

function wrap(text: string, width = 94, indent = "      "): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + w).length > width) { lines.push(line.trimEnd()); line = ""; }
    line += `${w} `;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.map((l) => indent + l).join("\n");
}

export function printReport(
  r: AuditResult,
  sources: Map<string, string>,
  texts: Map<string, Record<string, string>> = new Map(),
): void {
  const ranked = rankRows(r.rows);

  console.log(`\nШалгасан: ${r.checked} нийтлэл · зөрчилтэй: ${ranked.length} · ` +
    `LLM шүүгч: ${r.judged} ($${r.costUsd.toFixed(4)})`);
  if (r.skippedForBudget.length > 0) {
    console.log(`⚠ төсөв дүүрсэн тул ${r.skippedForBudget.length} нийтлэл шүүгчгүй үлдэв`);
  }

  if (ranked.length === 0) {
    console.log("\n✓ зөрчил олдсонгүй");
    return;
  }

  for (const [i, row] of ranked.entries()) {
    const worst = worstSeverity(row);
    console.log(`\n${"═".repeat(96)}`);
    console.log(`${i + 1}. [${worst}] ${row.titleMn}`);
    console.log(`   /medee/${row.slug} · ${ub(row.publishedAt)} · ${row.sourceName}`);
    if (row.topics.length) console.log(`   эрсдэлтэй сэдэв: ${row.topics.join(", ")}`);

    const source = sources.get(row.slug) ?? "";

    for (const issue of groupIssues(row.issues)) {
      console.log(`\n   ⚠ [${issue.severity}] ${issue.rule} — ${issue.fields.join(", ")}`);
      console.log(wrap(issue.detail));
      // Дүрмийг барьсан ЯГ ТЭР өгүүлбэр — «биет/таамаг→баталгаа» гэдэг нь
      // 2,000 тэмдэгтийн хаана асуудал байгааг хэлэхгүй
      const text = texts.get(row.slug)?.[issue.fields[0] as string] ?? null;
      const sentence = text ? offendingSentence(issue.rule as never, text, source) : null;
      if (sentence) {
        console.log("      манай текст:");
        console.log(wrap(sentence, 90, "        › "));
      }
      const ev = evidence(source, RULE_EVIDENCE[issue.rule] ?? []);
      if (ev) {
        console.log("      эх сурвалж:");
        console.log(wrap(ev, 90, "        › "));
      }
    }

    for (const c of row.claims) {
      console.log(`\n   ⚠ [${c.severity}] шүүгч`);
      console.log("      манай текст:");
      console.log(wrap(c.claim, 90, "        › "));
      if (c.source) {
        console.log("      эх сурвалж:");
        console.log(wrap(c.source, 90, "        › "));
      } else {
        console.log("        › (эх сурвалжид байхгүй)");
      }
      console.log(wrap(`засвар: ${c.problem}`));
    }

    console.log(`\n   засах: npm run article:fix -- --slug ${row.slug}`);
  }

  console.log(`\n${"═".repeat(96)}`);
  const bad = ranked.filter((x) => worstSeverity(x) === "ноцтой").length;
  console.log(`ноцтой ${bad} · анхаарах ${ranked.length - bad}`);

  if (r.duplicates.length > 0) {
    console.log(`\nНЭГ ҮЙЛ ЯВДЛЫГ ХОЁР УДАА НИЙТЭЛСЭН: ${r.duplicates.length} хос`);
    for (const d of r.duplicates) {
      console.log(`\n  · давхцал ${d.score} (${d.shared} ижил үндэс)`);
      console.log(`    /medee/${d.a.slug}  ${ub(d.a.publishedAt)}  ${d.a.titleMn}`);
      console.log(`    /medee/${d.b.slug}  ${ub(d.b.publishedAt)}  ${d.b.titleMn}`);
      console.log(`    хожим гарсан нь: /medee/${d.later} — нуух:`);
      console.log(`      npm run article:fix -- --hide --slugs ${d.later}`);
    }
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (isEntry("audit.ts")) {
  await runCli(async () => {
    const days = Number(arg("days") ?? 30);
    const slug = arg("slug");
    const judge = process.argv.includes("--judge");
    const budget = Number(arg("budget") ?? DEFAULT_AUDIT_BUDGET);

    console.log(
      slug ? `Аудит: /medee/${slug}` : `Аудит: сүүлийн ${days} хоногийн нийтлэлүүд`,
    );
    console.log(`LLM шүүгч: ${judge ? `тийм (дээд тал нь $${budget.toFixed(2)})` : "үгүй ($0)"}\n`);

    const result = await runAudit({ days, slug, judge, budget });

    // Тайланд эх сурвалжийн ишлэл харуулахад л хэрэгтэй — санах ойд үлдээнэ
    const rows = await publishedSince(days, slug);
    const sources = new Map(rows.map((a) => [a.slug, (a.sourceText ?? "").slice(0, 8_000)]));
    const texts = new Map(rows.map((a) => [a.slug, {
      "гарчиг": a.titleMn ?? "",
      "хураангуй": a.summaryMn ?? "",
      "биет": a.bodyMn ?? "",
      "Гол баримт": a.bodyMn ?? "",
      "Монголд юу гэсэн үг": a.bodyMn ?? "",
      "картын гарчиг": a.fbHook ?? "",
      "FB текст": a.fbText ?? "",
    }]));

    printReport(result, sources, texts);

    // IG тайлбар нь fbText-ээс гардаг — тусад нь шалгах шаардлагагүй, гэхдээ
    // API-аар засагддаггүй тул гараар засах жагсаалтыг тусад нь гаргана
    const igFixes = rankRows(result.rows)
      .filter((r) => rows.find((x) => x.slug === r.slug)?.igMediaId)
      .filter((r) => [...r.issues, ...r.claims].some((x) => x.severity === "ноцтой"));
    if (igFixes.length > 0) {
      console.log(`\nIG тайлбарыг ГАРААР засах (API-аар засагдахгүй): ${igFixes.length}`);
      for (const r of igFixes) {
        const a = rows.find((x) => x.slug === r.slug)!;
        console.log(`  · https://www.instagram.com/p/… (media ${a.igMediaId}) — /medee/${r.slug}`);
        if (a.fbText) console.log(`    одоогийн эхний мөр: ${buildCaption(a.fbText).split("\n")[0]}`);
      }
    }

    await prisma.$disconnect();
  });
}

export { AUDIT_BODY_CHARS };
