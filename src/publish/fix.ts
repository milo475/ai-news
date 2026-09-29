/**
 * `npm run article:fix -- --slug <slug>` — нийтлэгдсэн нийтлэлийг эх сурвалжтай нь
 * тулгаж засварлана.
 *
 *   npm run article:fix -- --slug <slug>              # DRY-RUN: юу ч бичихгүй
 *   npm run article:fix -- --slug <slug> --no-judge   # зөвхөн механик шалгалт
 *   npm run article:fix -- --slug <slug> --apply      # DB + FB постыг засна
 *
 * АНХДАГЧ нь dry-run: DB-д ч, Facebook-д ч юу ч бичихгүй. `--apply` нь:
 *   1. titleMn / summaryMn / bodyMn / fbText -ийг шинэчилнэ
 *   2. «Засвар (<огноо>): …» тэмдэглэл нэмнэ (нийтлэлийн доор гарна)
 *   3. FB постын текстийг Graph API-аар засна
 *   4. IG тайлбарыг ЖАГСААЛТААР гаргана — IG-ийн API caption засахыг дэмждэггүй
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { chatJson } from "../agent/llm";
import { MAX_TITLE_CHARS } from "../agent/improve.api";
import { blocking, checkBeforePublish, type FieldIssue } from "./prepublish.api";
import { buildCaption } from "./instagram.api";
import { judgeClaims } from "./audit";
import { type ClaimIssue } from "./audit.api";
import {
  checkFixed, correctionNote, diffLines, FIX_SCHEMA, fixSystem, fixUser, type FixOut,
} from "./fix.api";

const FIX_MODEL = process.env.WRITE_MODEL ?? "google/gemini-3.8-flash";

const SELECT = {
  id: true, slug: true, titleMn: true, summaryMn: true, bodyMn: true, category: true,
  publishedAt: true, publishedAtSource: true, sourceUrl: true, sourceText: true,
  fbHook: true, fbText: true, fbPostId: true, igMediaId: true,
  correctionNote: true, correctedAt: true,
  source: { select: { name: true } },
} as const;

export interface FixPlan {
  slug: string;
  titleMn: string;
  /** Засварын өмнөх текстүүд — ялгааг харуулахад */
  summaryBefore: string;
  bodyBefore: string;
  fbBefore: string | null;
  hookBefore: string | null;
  issues: FieldIssue[];
  claims: ClaimIssue[];
  /** Засвар гарсан эсэх — зөрчилгүй бол LLM дуудахгүй */
  fixed: FixOut | null;
  /** Засварын дараах механик шалгалт */
  remaining: FieldIssue[];
  note: string | null;
  costUsd: number;
}

/**
 * Засварыг БОДОЖ гаргана — DB-д юу ч бичихгүй.
 *
 * Механик шалгалт + (сонголтоор) LLM шүүгчийн олсон зөрчлүүдийг нэг дуудлагаар
 * засуулж, гарсан текстийг ДАХИН механик шалгалтаар шалгана: засвар нь шинэ
 * зөрчил үүсгэсэн эсэхийг мэдэхгүй бол засах нь эрсдэлтэй.
 */
export async function planFix(
  slug: string,
  opts: { judge?: boolean; now?: Date; chat?: typeof chatJson } = {},
): Promise<FixPlan> {
  const now = opts.now ?? new Date();
  const chat = opts.chat ?? chatJson;
  const a = await prisma.article.findUniqueOrThrow({ where: { slug }, select: SELECT });
  if (!a.titleMn || !a.bodyMn) throw new Error(`${slug}: монгол текстгүй (RAW нийтлэл?)`);
  if (!a.sourceText) throw new Error(`${slug}: эх текстгүй — тулгах зүйл алга`);

  const checkInput = {
    titleMn: a.titleMn, summaryMn: a.summaryMn, bodyMn: a.bodyMn,
    fbHook: a.fbHook, fbText: a.fbText, sourceText: a.sourceText,
    publishedAtSource: a.publishedAtSource, sourceName: a.source?.name ?? null,
  };
  const issues = checkBeforePublish(checkInput);

  let claims: ClaimIssue[] = [];
  let costUsd = 0;
  if (opts.judge !== false) {
    const r = await judgeClaims(a as never, { chat });
    claims = r.claims;
    costUsd += r.costUsd;
  }

  const base = {
    slug, titleMn: a.titleMn, summaryBefore: a.summaryMn ?? "", bodyBefore: a.bodyMn,
    fbBefore: a.fbText, hookBefore: a.fbHook, issues, claims, costUsd,
  };
  if (issues.length === 0 && claims.length === 0) {
    return { ...base, fixed: null, remaining: [], note: null };
  }

  const out = await chat<FixOut>({
    model: FIX_MODEL,
    system: fixSystem(MAX_TITLE_CHARS),
    user: fixUser({
      titleMn: a.titleMn,
      summaryMn: a.summaryMn ?? "",
      bodyMn: a.bodyMn,
      fbText: a.fbText,
      fbHook: a.fbHook,
      sourceText: a.sourceText,
      sourceName: a.source?.name ?? "эх сурвалж",
      issues,
      claims,
    }),
    schema: FIX_SCHEMA,
    maxTokens: 8_000,
    temperature: 0.2,
    reasoning: false,
  });
  costUsd += out.costUsd;

  const check = checkFixed({ titleMn: a.titleMn, bodyMn: a.bodyMn }, out.data, MAX_TITLE_CHARS);
  if (!check.ok) {
    throw new Error(`засварыг хүлээж авсангүй: ${check.problems.join("; ")}`);
  }

  const fixed: FixOut = {
    titleMn: out.data.titleMn.trim(),
    summaryMn: out.data.summaryMn.trim(),
    bodyMn: out.data.bodyMn.trim(),
    fbText: out.data.fbText.trim(),
    fbHook: out.data.fbHook.trim(),
    changed: out.data.changed,
  };

  const remaining = checkBeforePublish({
    ...checkInput,
    titleMn: fixed.titleMn,
    summaryMn: fixed.summaryMn,
    bodyMn: fixed.bodyMn,
    fbText: fixed.fbText || a.fbText,
    fbHook: fixed.fbHook || a.fbHook,
  });

  return { ...base, fixed, remaining, note: correctionNote(now, fixed.changed), costUsd };
}

export interface ApplyResult {
  fb: "засав" | "алдаа" | "постлогдоогүй";
  fbError?: string;
  /** Картыг шинэ гарчгаар дахин зурсан эсэх */
  card: "дахин зурав" | "суурь зураг алга" | "өөрчлөгдөөгүй" | "алдаа";
  cardError?: string;
}

/**
 * Засварыг DB, карт, Facebook-д бичнэ.
 *
 * Картыг ХАДГАЛСАН СУУРЬ ЗУРАГ дээр дахин бичнэ — зураг үүсгэхгүй тул зардалгүй.
 * FB дээрх постын ЗУРГИЙГ солих боломжгүй (Graph API дэмждэггүй) тул тэнд хуучин
 * карт үлдэнэ: FB постын ТЕКСТ л засагдана.
 */
export async function applyFix(
  slug: string,
  plan: FixPlan,
  opts: { now?: Date } = {},
): Promise<ApplyResult> {
  if (!plan.fixed) throw new Error("засвар алга — хэрэглэх зүйл байхгүй");
  const now = opts.now ?? new Date();
  const a = await prisma.article.findUniqueOrThrow({
    where: { slug },
    select: { ...SELECT, heroImageData: true },
  });

  await prisma.article.update({
    where: { slug },
    data: {
      titleMn: plan.fixed.titleMn,
      summaryMn: plan.fixed.summaryMn,
      bodyMn: plan.fixed.bodyMn,
      ...(plan.fixed.fbText ? { fbText: plan.fixed.fbText } : {}),
      correctionNote: plan.note,
      correctedAt: now,
    },
  });

  // ——— Карт: суурь зураг дээр шинэ гарчгийг дахин бичнэ ———
  let card: ApplyResult["card"] = "өөрчлөгдөөгүй";
  let cardError: string | undefined;
  const newHook = plan.fixed.fbHook;
  if (newHook && newHook !== a.fbHook) {
    if (!a.heroImageData) {
      card = "суурь зураг алга";
    } else {
      try {
        const { renderCard } = await import("./card");
        const { hookTypeOf } = await import("./card.api");
        const image = await renderCard(Buffer.from(a.heroImageData), newHook);
        await prisma.article.update({
          where: { slug },
          data: {
            fbHook: newHook,
            fbHookType: hookTypeOf(newHook),
            fbImageData: new Uint8Array(image),
            fbImageAt: now,
          },
        });
        card = "дахин зурав";
      } catch (e) {
        card = "алдаа";
        cardError = (e as Error).message.slice(0, 200);
      }
    }
  }

  if (!a.fbPostId || !plan.fixed.fbText) return { fb: "постлогдоогүй", card, cardError };

  try {
    const { editPost } = await import("./facebook");
    await editPost(a.fbPostId, plan.fixed.fbText);
    return { fb: "засав", card, cardError };
  } catch (e) {
    return { fb: "алдаа", fbError: (e as Error).message.slice(0, 200), card, cardError };
  }
}

// ---------- Хэвлэх ----------

function block(label: string, text: string, mark: string): void {
  console.log(`   ${label}`);
  for (const line of text.split("\n")) console.log(`     ${mark} ${line}`);
}

export function printPlan(plan: FixPlan): void {
  console.log(`\n═══ /medee/${plan.slug} ═══`);
  console.log(`${plan.titleMn}\n`);

  const all = [
    ...plan.issues.map((i) => `[${i.severity}] ${i.rule} (${i.field}): ${i.detail}`),
    ...plan.claims.map((c) => `[${c.severity}] шүүгч: ${c.problem}`),
  ];
  console.log(`Зөрчил: ${all.length}`);
  for (const line of all) console.log(`  · ${line}`);

  if (!plan.fixed) {
    console.log("\n✓ зөрчилгүй — засах зүйл алга");
    return;
  }

  console.log("\n─── ӨМНӨ → ДАРАА ───");
  if (plan.titleMn !== plan.fixed.titleMn) {
    console.log("\n  Гарчиг:");
    console.log(`     − ${plan.titleMn}`);
    console.log(`     + ${plan.fixed.titleMn}`);
  }

  if (plan.summaryBefore !== plan.fixed.summaryMn) {
    console.log("\n  Хураангуй:");
    console.log(`     − ${plan.summaryBefore}`);
    console.log(`     + ${plan.fixed.summaryMn}`);
  }

  if (plan.fixed.fbHook && plan.fixed.fbHook !== plan.hookBefore) {
    console.log("\n  Картын гарчиг:");
    console.log(`     − ${plan.hookBefore ?? "(байхгүй)"}`);
    console.log(`     + ${plan.fixed.fbHook}`);
  }

  console.log("\n  Биет:");
  for (const d of diffLines(plan.bodyBefore, plan.fixed.bodyMn)) {
    if (d.before) console.log(`     − ${d.before}`);
    if (d.after) console.log(`     + ${d.after}`);
  }

  if (plan.fixed.fbText && plan.fixed.fbText !== plan.fbBefore) {
    console.log("\n  FB текст:");
    block("өмнө:", plan.fbBefore ?? "(байхгүй)", "−");
    block("дараа:", plan.fixed.fbText, "+");
  }

  console.log(`\n  Тэмдэглэл: ${plan.note}`);
  console.log(
    plan.remaining.length === 0
      ? "\n  ✓ засварын дараа механик шалгалт цэвэр"
      : `\n  ⚠ засварын дараа ч ${blocking(plan.remaining).length} ноцтой зөрчил: ` +
        plan.remaining.map((i) => `${i.field}/${i.rule}`).join(", "),
  );
  console.log(`  Зардал: $${plan.costUsd.toFixed(4)}`);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (isEntry("fix.ts")) {
  await runCli(async () => {
    const slug = arg("slug");
    if (!slug) throw new Error("Хэрэглээ: npm run article:fix -- --slug <slug> [--apply]");
    const apply = process.argv.includes("--apply");
    const judge = !process.argv.includes("--no-judge");

    console.log(apply ? "ГОРИМ: --apply (DB ба FB-д БИЧНЭ)" : "ГОРИМ: dry-run (юу ч бичихгүй)");

    const before = await prisma.article.findUniqueOrThrow({
      where: { slug },
      select: { igMediaId: true, fbPostId: true },
    });

    const plan = await planFix(slug, { judge });
    printPlan(plan);

    if (!plan.fixed) return;

    if (!apply) {
      console.log(`\n  Хэрэглэх: npm run article:fix -- --slug ${slug} --apply`);
      if (before.igMediaId) {
        console.log("\n  IG тайлбарыг ГАРААР засна (API-аар засагдахгүй):");
        console.log(`     media ${before.igMediaId}`);
        console.log("     шинэ тайлбар:");
        for (const line of buildCaption(plan.fixed.fbText || "").split("\n")) console.log(`       ${line}`);
      }
      return;
    }

    const out = await applyFix(slug, plan);
    console.log(`\n✓ DB шинэчлэгдлээ`);
    console.log(`  карт: ${out.card}${out.cardError ? ` — ${out.cardError}` : ""}`);
    console.log(`  FB текст: ${out.fb}${out.fbError ? ` — ${out.fbError}` : ""}`);
    if (out.card === "дахин зурав") {
      console.log("  ⚠ FB дээрх постын ЗУРГИЙГ Graph API солихыг дэмждэггүй — тэнд хуучин карт үлдэнэ");
    }
    if (before.igMediaId) {
      console.log(`\n⚠ IG тайлбарыг ГАРААР засна — media ${before.igMediaId}`);
      console.log("   шинэ тайлбар:");
      for (const line of buildCaption(plan.fixed.fbText || "").split("\n")) console.log(`     ${line}`);
    }
    await prisma.$disconnect();
  });
}
