/**
 * `npm run article:fix -- --slug <slug>` — нийтлэгдсэн нийтлэлийг эх сурвалжтай нь
 * тулгаж засварлана.
 *
 *   npm run article:fix -- --slug <slug>                    # DRY-RUN: юу ч бичихгүй
 *   npm run article:fix -- --slug <slug> --no-judge         # зөвхөн механик шалгалт
 *   npm run article:fix -- --slug <slug> --title "…"        # гарчгийг гараар (шүүгчээр дамжина)
 *   npm run article:fix -- --slug <slug> --card-title "…"
 *   npm run article:fix -- --audit serious --list           # аль нийтлэл сонгогдохыг ($0)
 *   npm run article:fix -- --audit serious                  # аудитын ноцтой бүх нийтлэл
 *   npm run article:fix -- --apply --slugs a,b,c            # зөвхөн сонгосныг засна
 *
 * АНХДАГЧ нь dry-run: DB-д ч, Facebook-д ч юу ч бичихгүй. `--apply` нь:
 *   1. titleMn / summaryMn / bodyMn / fbText -ийг шинэчилнэ
 *   2. «Засвар (<огноо>): …» тэмдэглэл нэмнэ (нийтлэлийн доор гарна)
 *   3. FB постын текстийг Graph API-аар засна
 *   4. IG тайлбарыг ЖАГСААЛТААР гаргана — IG-ийн API caption засахыг дэмждэггүй
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { chatJson } from "../agent/llm";
import { MAX_TITLE_CHARS } from "../agent/improve.api";
import { blocking, checkBeforePublish, type FieldIssue } from "./prepublish.api";
import { buildCaption } from "./instagram.api";
import { judgeClaims } from "./audit";
import { type ClaimIssue } from "./audit.api";
import {
  actorFeedback, checkFixed, correctionNote, diffLines, FIX_SCHEMA, fixSystem, fixUser, keepsActor,
  noteProblems, type FixOut,
} from "./fix.api";
import { judgeFidelity } from "./fidelity";
import {
  logFileName, planFileName, PLAN_VERSION, stateHash, validateStored, type StoredPlan,
} from "./fix-store.api";

const FIX_MODEL = process.env.WRITE_MODEL ?? "google/gemini-3.8-flash";

/** Картын гарчгийн дээд урт — картад багтах ёстой (card.api-ийн fitHeadline) */
const MAX_CARD_TITLE_CHARS = 110;

/** Саналуудыг хаана хадгалах вэ */
export function storeDir(): string {
  return process.env.ARTICLE_FIX_DIR?.trim() || join(homedir(), "article-fix");
}

/** Dry-run-ийн саналыг диск дээр хадгална */
export function savePlan(
  plan: FixPlan,
  articleState: {
    sourceText: string | null; titleMn: string | null; summaryMn: string | null;
    bodyMn: string | null; fbText: string | null; fbHook: string | null;
  },
  now: Date,
): string {
  if (!plan.fixed) throw new Error("хадгалах санал алга");
  const dir = storeDir();
  mkdirSync(dir, { recursive: true });
  const stored: StoredPlan = {
    version: PLAN_VERSION,
    slug: plan.slug,
    at: now.toISOString(),
    stateHash: stateHash(articleState),
    before: {
      titleMn: articleState.titleMn ?? "",
      summaryMn: articleState.summaryMn ?? "",
      bodyMn: articleState.bodyMn ?? "",
      fbText: articleState.fbText,
      fbHook: articleState.fbHook,
    },
    proposed: plan.fixed,
    issues: plan.issues,
    claims: plan.claims,
    blocking: blocking(plan.remaining),
    costUsd: plan.costUsd,
  };
  const file = join(dir, planFileName(now, plan.slug));
  writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
  return file;
}

/** Хадгалсан саналыг уншиж, одоогийн байдалтай тулгана */
export async function loadPlan(slug: string, now: Date): Promise<
  { ok: true; plan: StoredPlan; file: string } | { ok: false; reason: string }
> {
  const file = join(storeDir(), planFileName(now, slug));
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { ok: false, reason: `санал олдсонгүй: ${file} — эхлээд dry-run ажиллуулна уу` };
  }
  const a = await prisma.article.findUnique({
    where: { slug },
    select: { sourceText: true, titleMn: true, summaryMn: true, bodyMn: true, fbText: true, fbHook: true },
  });
  if (!a) return { ok: false, reason: `${slug}: олдсонгүй` };
  const v = validateStored(raw, { stateHash: stateHash(a), slug });
  return v.ok ? { ok: true, plan: v.plan, file } : { ok: false, reason: v.reason };
}

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
  /**
   * Тэмдэглэлийн УРЬДЧИЛСАН хувилбар. Бодит тэмдэглэл нь `--apply` хийсэн
   * АГШИНД дахин үүснэ — dry-run 23:50-д, apply нь 00:10-д хийгдвэл огноо
   * зөрүүтэй болно.
   */
  note: string | null;
  /** Гарчиг эх гарчгийн үйлдэгчийг хадгалсан эсэх */
  actorKept: { title: boolean; card: boolean };
  /** Гараар өгсөн гарчгийг шүүгч хүлээж авсан эсэх */
  overrideVerdict: { field: "гарчиг" | "картын гарчиг"; ok: boolean; issues: string[] }[];
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
  opts: {
    judge?: boolean;
    now?: Date;
    chat?: typeof chatJson;
    /** Гараар өгсөн гарчиг — шүүгчээр дамжина */
    title?: string;
    cardTitle?: string;
    /** Гараар өгсөн, уншигчид харагдах тэмдэглэл */
    note?: string;
  } = {},
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
  const noFix = {
    ...base, fixed: null, remaining: [], note: null,
    actorKept: { title: true, card: true }, overrideVerdict: [],
  };
  if (issues.length === 0 && claims.length === 0) return noFix;

  const userPrompt = fixUser({
    titleMn: a.titleMn,
    summaryMn: a.summaryMn ?? "",
    bodyMn: a.bodyMn,
    fbText: a.fbText,
    fbHook: a.fbHook,
    sourceText: a.sourceText,
    sourceName: a.source?.name ?? "эх сурвалж",
    issues,
    claims,
  });

  // Гарчиг үйлдэгчээ алдвал НЭГ УДАА дахин оролдоно — «Bloomberg мэдээлэв»
  // гэсэн гарчиг дамжуулалтаа сэргээсэн ч хэн юу хийснийг нь алддаг
  let out = await chat<FixOut>({
    model: FIX_MODEL, system: fixSystem(MAX_TITLE_CHARS), user: userPrompt,
    schema: FIX_SCHEMA, maxTokens: 8_000, temperature: 0.2, reasoning: false,
  });
  costUsd += out.costUsd;

  if (!keepsActor(a.titleMn, out.data.titleMn ?? "")) {
    const retry = await chat<FixOut>({
      model: FIX_MODEL,
      system: fixSystem(MAX_TITLE_CHARS),
      user: `${userPrompt}\n\n--- ДАХИН ОРОЛДОХ ШАЛТГААН ---\n${actorFeedback(a.titleMn, out.data.titleMn ?? "")}`,
      schema: FIX_SCHEMA, maxTokens: 8_000, temperature: 0.3, reasoning: false,
    });
    costUsd += retry.costUsd;
    if (keepsActor(a.titleMn, retry.data.titleMn ?? "")) out = retry;
  }

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
    changed: opts.note ? [opts.note] : out.data.changed,
  };

  // ——— Гараар өгсөн гарчиг: шүүгчээр дамжина ———
  const overrideVerdict: FixPlan["overrideVerdict"] = [];
  for (const o of [
    { field: "гарчиг" as const, value: opts.title },
    { field: "картын гарчиг" as const, value: opts.cardTitle },
  ]) {
    const value = o.value?.trim();
    if (!value) continue;

    // Урт нь эхлээд шалгагдана — шүүгчид $ зарцуулаад дараа нь хаях нь утгагүй
    const max = o.field === "гарчиг" ? MAX_TITLE_CHARS : MAX_CARD_TITLE_CHARS;
    if (value.length > max) {
      overrideVerdict.push({
        field: o.field, ok: false,
        issues: [`${value.length} тэмдэгт — дээд хязгаар ${max}`],
      });
      continue;
    }

    // Гараар өгсөн гарчгийг ЭХ НИЙТЛЭЛТЭЙ л тулгана. Засагдаагүй гарчиг,
    // хураангуйг шүүгчид өгвөл тэр нь «манай гарчиг Пентагон тогтоов гэж
    // байхад чи Bloomberg мэдээлэв гэж байна» гэж ЗӨРЧЛИЙГ ӨӨРИЙГ НЬ
    // жишиг болгож, зөв гарчгийг татгалздаг байв.
    const verdict = await judgeFidelity(
      { hook: value, kind: "гарчиг", titleMn: null, summaryMn: null, bodyMn: a.sourceText },
      { chat },
    );
    costUsd += verdict.costUsd;
    const ok = verdict.ok && verdict.faithful;
    overrideVerdict.push({
      field: o.field, ok,
      issues: verdict.ok ? verdict.issues : ["шүүгч ажиллсангүй"],
    });
    // fail-closed: шүүгчид тэнцээгүй гарчгийг хэрэглэхгүй
    if (!ok) continue;
    if (o.field === "гарчиг") fixed.titleMn = value;
    else fixed.fbHook = value;
  }

  const remaining = checkBeforePublish({
    ...checkInput,
    titleMn: fixed.titleMn,
    summaryMn: fixed.summaryMn,
    bodyMn: fixed.bodyMn,
    fbText: fixed.fbText || a.fbText,
    fbHook: fixed.fbHook || a.fbHook,
  });

  return {
    ...base, fixed, remaining, costUsd,
    note: correctionNote(now, opts.note ? [opts.note] : fixed.changed),
    actorKept: {
      title: keepsActor(a.titleMn, fixed.titleMn),
      card: !a.fbHook || !fixed.fbHook || keepsActor(a.fbHook, fixed.fbHook),
    },
    overrideVerdict,
  };
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
  fixed: FixOut,
  opts: { now?: Date } = {},
): Promise<ApplyResult> {
  const now = opts.now ?? new Date();
  const a = await prisma.article.findUniqueOrThrow({
    where: { slug },
    select: { ...SELECT, heroImageData: true },
  });

  await prisma.article.update({
    where: { slug },
    data: {
      titleMn: fixed.titleMn,
      summaryMn: fixed.summaryMn,
      bodyMn: fixed.bodyMn,
      ...(fixed.fbText ? { fbText: fixed.fbText } : {}),
      // Тэмдэглэлийн огноо нь --apply хийсэн АГШНЫ УБ огноо байх ёстой:
      // dry-run 23:50-д, apply нь 00:10-д хийгдвэл хуучин огноо бичигдэнэ
      correctionNote: correctionNote(now, fixed.changed),
      correctedAt: now,
    },
  });

  // ——— Карт: суурь зураг дээр шинэ гарчгийг дахин бичнэ ———
  let card: ApplyResult["card"] = "өөрчлөгдөөгүй";
  let cardError: string | undefined;
  const newHook = fixed.fbHook;
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

  if (!a.fbPostId || !fixed.fbText) return { fb: "постлогдоогүй", card, cardError };

  try {
    const { editPost } = await import("./facebook");
    await editPost(a.fbPostId, fixed.fbText);
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

  for (const v of plan.overrideVerdict) {
    console.log(
      v.ok
        ? `\n  ✓ гараар өгсөн ${v.field} шүүгчид тэнцлээ`
        : `\n  ✗ гараар өгсөн ${v.field} шүүгчид ТЭНЦСЭНГҮЙ, хэрэглэсэнгүй: ${v.issues.join("; ")}`,
    );
  }

  if (!plan.actorKept.title) {
    console.log(`\n  ⚠ ГАРЧИГ ҮЙЛДЭГЧЭЭ АЛДСАН — «${plan.titleMn}» дахь нэр шинэ гарчигт алга.`);
    console.log(`     Гараар өгөх: --title "…"`);
  }
  if (!plan.actorKept.card) {
    console.log("\n  ⚠ КАРТЫН ГАРЧИГ ҮЙЛДЭГЧЭЭ АЛДСАН — гараар өгөх: --card-title \"…\"");
  }

  console.log(`\n  Тэмдэглэл (--apply хийх өдрөөр дахин үүснэ): ${plan.note}`);
  const noteBad = noteProblems(plan.fixed.changed);
  if (noteBad.length > 0) {
    console.log(`  ⚠ тэмдэглэл уншигчид тохирохгүй: ${noteBad.join("; ")}`);
    console.log("     --apply-аас өмнө гараар засах: --note \"…\"");
  }

  // Ноцтой ба анхааруулгыг ТУСАД НЬ. Өмнө нь «0 ноцтой зөрчил: биет/модаль
  // сулрав» гэж өөртэйгөө зөрчилдсөн мөр гардаг байв: тоо нь зөвхөн ноцтойг
  // тоолж, жагсаалт нь бүгдийг хэвлэдэг байсан.
  const bad = blocking(plan.remaining);
  const warn = plan.remaining.filter((i) => i.severity === "анхаарах");
  if (bad.length > 0) {
    console.log(`\n  ✗ засварын дараа ч ${bad.length} НОЦТОЙ зөрчил үлдэв — --apply алгасна:`);
    for (const i of bad) console.log(`       ${i.field}/${i.rule}`);
    console.log("       хүчээр засах: --force");
  } else {
    console.log("\n  ✓ засварын дараа ноцтой зөрчил үлдээгүй");
  }
  if (warn.length > 0) {
    console.log(`  · ${warn.length} анхааруулга (нийтлэхийг зогсоохгүй): ` +
      warn.map((i) => `${i.field}/${i.rule}`).join(", "));
  }
  console.log(`  Зардал: $${plan.costUsd.toFixed(4)}`);
}

/**
 * Нийтлэлийг НУУНА — засагдахааргүй зөрчилтэй үед устгахын оронд.
 *
 * `status: "HIDDEN"` нь бүх `status: "PUBLISHED"` шүүлтээс автоматаар хасагдана:
 * нийтлэлийн хуудас 404, жагсаалт, sitemap, карт, RSS-д гарахгүй. `publishedAt`
 * хэвээр үлдэнэ — `--show` буцаахад хэрэгтэй. FB/IG дээрх пост хэвээр үлдэх тул
 * тэднийг гараар устгах шаардлагатайг мэдэгдэнэ.
 */
export async function hideArticle(
  slug: string,
  opts: { reason?: string; now?: Date } = {},
): Promise<{ fbPostId: string | null; igMediaId: string | null }> {
  const now = opts.now ?? new Date();
  const a = await prisma.article.findUniqueOrThrow({
    where: { slug },
    select: { status: true, fbPostId: true, igMediaId: true },
  });
  if (a.status !== "PUBLISHED") throw new Error(`${slug}: статус ${a.status} — нуух шаардлагагүй`);
  await prisma.article.update({
    where: { slug },
    data: {
      status: "HIDDEN",
      correctionNote: opts.reason?.trim() || HIDDEN_NOTE,
      correctedAt: now,
    },
  });
  return { fbPostId: a.fbPostId, igMediaId: a.igMediaId };
}

/** Нуусан нийтлэлийг буцаана */
export async function showArticle(slug: string): Promise<void> {
  const a = await prisma.article.findUniqueOrThrow({ where: { slug }, select: { status: true } });
  if (a.status !== "HIDDEN") throw new Error(`${slug}: статус ${a.status} — нуугдаагүй байна`);
  await prisma.article.update({ where: { slug }, data: { status: "PUBLISHED" } });
}

/** Нуусан нийтлэлийн анхдагч тайлбар — /admin дээр харагдана */
export const HIDDEN_NOTE = "Эх сурвалжтай тулгахад засагдахааргүй зөрчил илэрсэн тул нийтлэлийг түр хаав.";

/** Нийтлэлийг агуулсан НИЙТЛЭГДСЭН долоо хоногийн тоймууд */
export async function digestsContaining(slugs: string[]): Promise<
  { slug: string; titleMn: string | null; publishedAt: Date | null; fbPostId: string | null; items: string[] }[]
> {
  if (slugs.length === 0) return [];
  const rows = await prisma.article.findMany({
    where: {
      kind: "DIGEST", status: "PUBLISHED",
      digestItems: { some: { article: { slug: { in: slugs } } } },
    },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true, titleMn: true, publishedAt: true, fbPostId: true,
      digestItems: { select: { article: { select: { slug: true } } } },
    },
  });
  return rows.map((d) => ({
    slug: d.slug, titleMn: d.titleMn, publishedAt: d.publishedAt, fbPostId: d.fbPostId,
    items: d.digestItems.map((i) => i.article.slug).filter((sl) => slugs.includes(sl)),
  }));
}

export interface Inbound {
  /** Биедээ /medee/<slug> холбоос агуулсан нийтлэлүүд */
  articles: { slug: string; titleMn: string | null; kind: string; publishedAt: Date | null }[];
  /** Энэ нийтлэлийг агуулсан долоо хоногийн тоймууд */
  digests: { slug: string; titleMn: string | null; publishedAt: Date | null }[];
}

/**
 * Энэ нийтлэл рүү заасан бусад НИЙТЛЭГДСЭН агуулга.
 *
 * Нийтлэлийг нуувал тэдгээрийн холбоос 404 болно — нуухаас өмнө мэдэх ёстой.
 * Хоёр эх үүсвэр: (а) биед бичигдсэн /medee/<slug> холбоос (тоймын хэсгийн
 * мэдээний жагсаалт ингэж бичигддэг), (б) DigestItem хүснэгтийн холбоо.
 */
export async function inboundLinks(slug: string): Promise<Inbound> {
  const [articles, digests] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        slug: { not: slug },
        bodyMn: { contains: `/medee/${slug}` },
      },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, titleMn: true, kind: true, publishedAt: true },
    }),
    prisma.article.findMany({
      where: {
        kind: "DIGEST", status: "PUBLISHED",
        digestItems: { some: { article: { slug } } },
      },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, titleMn: true, publishedAt: true },
    }),
  ]);
  // Тоймыг хоёр удаа хэвлэхгүй
  const digestSlugs = new Set(digests.map((d) => d.slug));
  return { articles: articles.filter((a) => !digestSlugs.has(a.slug)), digests };
}

/** IG тайлбарыг хэвлэнэ — API-аар засагддаггүй тул гараар хуулна */
function printIgCaption(mediaId: string, fbText: string, indent = "     "): void {
  console.log(`${indent}IG media ${mediaId} — шинэ тайлбар:`);
  for (const line of buildCaption(fbText).split("\n")) console.log(`${indent}  ${line}`);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (isEntry("fix.ts")) {
  await runCli(async () => {
    const now = new Date();
    const apply = process.argv.includes("--apply");
    const force = process.argv.includes("--force");
    const judge = !process.argv.includes("--no-judge");
    const audit = arg("audit");
    const slugsArg = arg("slugs");
    const one = arg("slug");
    const hide = process.argv.includes("--hide");
    const show = process.argv.includes("--show");

    // ——— Аль нийтлэлүүд дээр ажиллах вэ ———
    let slugs: string[];
    if (slugsArg) {
      slugs = slugsArg.split(",").map((x) => x.trim()).filter(Boolean);
    } else if (audit) {
      if (audit !== "serious" && audit !== "all") {
        throw new Error("--audit нь «serious» эсвэл «all» байна");
      }
      const days = Number(arg("days") ?? 30);
      const budget = Number(arg("audit-budget") ?? 0.2);
      console.log(`Аудит: сүүлийн ${days} хоног (шүүгчийн дээд зардал $${budget.toFixed(2)})…`);
      const { runAudit } = await import("./audit");
      const { rankRows, worstSeverity } = await import("./audit.api");
      const result = await runAudit({ days, judge, budget });
      const ranked = rankRows(result.rows);
      slugs = (audit === "serious" ? ranked.filter((r) => worstSeverity(r) === "ноцтой") : ranked)
        .map((r) => r.slug);
      console.log(`Аудит: ${result.checked} шалгав, ${slugs.length} нийтлэл сонгогдов ` +
        `($${result.costUsd.toFixed(4)})\n`);
    } else if (one) {
      slugs = [one];
    } else {
      throw new Error(
        "Хэрэглээ:\n" +
          "  npm run article:fix -- --slug <slug> [--title \"…\"] [--apply]\n" +
          "  npm run article:fix -- --audit serious [--list]\n" +
          "  npm run article:fix -- --apply --slugs a,b,c   (dry-run-ийн саналыг хэрэглэнэ)\n" +
          "  npm run article:fix -- --hide --slugs a,b [--apply]\n" +
          "  npm run article:fix -- --show --slugs a,b [--apply]",
      );
    }
    if (slugs.length === 0) { console.log("Нийтлэл алга."); return; }

    // ——— Нуух / буцаах ———
    if (hide || show) {
      const verb = hide ? "нуух" : "буцаах";
      console.log(apply ? `ГОРИМ: --apply (${verb})` : `ГОРИМ: dry-run (${verb} — юу ч бичихгүй)`);
      for (const slug of slugs) {
        const a = await prisma.article.findUnique({
          where: { slug },
          select: { status: true, titleMn: true, fbPostId: true, igMediaId: true },
        });
        if (!a) { console.warn(`  ⚠ ${slug}: олдсонгүй`); continue; }
        const wanted = hide ? "PUBLISHED" : "HIDDEN";
        if (a.status !== wanted) {
          console.warn(`  ⚠ ${slug}: статус ${a.status} — ${verb} шаардлагагүй`);
          continue;
        }
        console.log(`\n  ${hide ? "⊘" : "↩"} /medee/${slug}`);
        console.log(`     ${a.titleMn}`);
        console.log(`     ${a.status} → ${hide ? "HIDDEN" : "PUBLISHED"}`);
        if (hide && (a.fbPostId || a.igMediaId)) {
          console.log("     ⚠ FB/IG дээрх постыг ГАРААР устгана:" +
            `${a.fbPostId ? ` FB ${a.fbPostId}` : ""}${a.igMediaId ? ` IG ${a.igMediaId}` : ""}`);
        }
        if (hide) {
          const links = await inboundLinks(slug);
          const total = links.articles.length + links.digests.length;
          if (total === 0) {
            console.log("     ✓ энэ нийтлэл рүү заасан бусад агуулга алга");
          } else {
            console.log(`     ⚠ ${total} нийтлэл/тойм энэ рүү заасан — нуувал холбоос нь 404 болно:`);
            for (const d of links.digests) {
              console.log(`        тойм  /medee/${d.slug} (${d.publishedAt?.toISOString().slice(0, 10) ?? "—"})`);
              console.log(`              ${d.titleMn}`);
            }
            for (const x of links.articles) {
              console.log(`        ${x.kind === "DIGEST" ? "тойм " : "мэдээ"} /medee/${x.slug} ` +
                `(${x.publishedAt?.toISOString().slice(0, 10) ?? "—"})`);
              console.log(`              ${x.titleMn}`);
            }
            if (links.digests.length > 0) {
              console.log("        Тоймыг дахин үүсгэх:");
              for (const d of links.digests) {
                console.log(`          ./scripts/prod.sh agent:digest -- --replace ${d.slug}`);
              }
            }
          }
        }
        if (!apply) continue;
        if (hide) await hideArticle(slug, { reason: arg("reason"), now });
        else await showArticle(slug);
        console.log("     ✓ бичигдлээ");
      }
      if (!apply) console.log(`\nХэрэглэх: npm run article:fix -- --${hide ? "hide" : "show"} --slugs ${slugs.join(",")} --apply`);
      await prisma.$disconnect();
      return;
    }

    console.log(apply ? "ГОРИМ: --apply (DB ба FB-д БИЧНЭ)" : "ГОРИМ: dry-run (юу ч бичихгүй)");

    // --list: аль нийтлэл сонгогдсоныг харуулаад гарна (LLM зарцуулахгүй)
    if (process.argv.includes("--list")) {
      console.log(`Сонгогдсон: ${slugs.length}`);
      for (const sl of slugs) console.log(`  · /medee/${sl}`);
      console.log(`\nЗасах: npm run article:fix -- --slugs ${slugs.join(",")}`);
      return;
    }

    // ═══ --apply: ХАДГАЛСАН саналыг хэрэглэнэ, LLM дуудахгүй ═══
    if (apply) {
      for (const slug of slugs) {
        const loaded = await loadPlan(slug, now);
        if (!loaded.ok) { console.error(`\n✗ ${slug}: ${loaded.reason}`); continue; }
        const stored = loaded.plan;

        // Хадгалсан `blocking`-д итгэхгүй — дүрэм өөрчлөгдсөн байж болно.
        // Саналыг ОДООГИЙН дүрмээр дахин шалгана (механик, $0).
        const cur = await prisma.article.findUniqueOrThrow({
          where: { slug },
          select: {
            sourceText: true, publishedAtSource: true, fbText: true, fbHook: true,
            source: { select: { name: true } },
          },
        });
        const bad = blocking(checkBeforePublish({
          titleMn: stored.proposed.titleMn,
          summaryMn: stored.proposed.summaryMn,
          bodyMn: stored.proposed.bodyMn,
          fbText: stored.proposed.fbText || cur.fbText,
          fbHook: stored.proposed.fbHook || cur.fbHook,
          sourceText: cur.sourceText,
          publishedAtSource: cur.publishedAtSource,
          sourceName: cur.source?.name ?? null,
        }));
        if (bad.length > 0 && !force) {
          console.warn(
            `\n⊘ ${slug}: засварын дараа ч ${bad.length} ноцтой зөрчил үлдэж байна — алгасав\n` +
              `   ${bad.map((i) => `${i.field}/${i.rule}`).join(", ")}\n` +
              `   Хүчээр: --force · эсвэл нуух: --hide --slugs ${slug}`,
          );
          continue;
        }

        const out = await applyFix(slug, stored.proposed, { now });
        console.log(`\n✓ ${slug} (санал: ${loaded.file})`);
        console.log(`  карт: ${out.card}${out.cardError ? ` — ${out.cardError}` : ""}`);
        console.log(`  FB текст: ${out.fb}${out.fbError ? ` — ${out.fbError}` : ""}`);
        if (out.card === "дахин зурав") {
          console.log("  ⚠ FB постын ЗУРГИЙГ Graph API солихыг дэмждэггүй — тэнд хуучин карт үлдэнэ");
        }
        const ig = await prisma.article.findUnique({ where: { slug }, select: { igMediaId: true } });
        if (ig?.igMediaId) printIgCaption(ig.igMediaId, stored.proposed.fbText || "", "  ");
      }

      const digests = await digestsContaining(slugs);
      if (digests.length > 0) {
        console.log(`\nДолоо хоногийн тоймыг ДАХИН ҮҮСГЭНЭ (засагдсан биеэс):`);
        for (const d of digests) {
          console.log(`  ./scripts/prod.sh agent:digest -- --replace ${d.slug}`);
        }
        console.log("  (тойм DRAFT болж үүснэ — /admin дээр хянаад --publish нэмнэ)");
      }
      await prisma.$disconnect();
      return;
    }

    // ═══ dry-run: саналыг үүсгэж, ХАДГАЛНА ═══
    const lines: string[] = [];
    const say = (...a: unknown[]) => { const t = a.join(" "); lines.push(t); console.log(t); };

    if (slugs.length > 1 && (arg("title") || arg("card-title"))) {
      throw new Error("--title / --card-title нь зөвхөн нэг нийтлэлд (--slug) хэрэглэгдэнэ");
    }

    const done: { slug: string; blocking: number; file: string }[] = [];
    const failed: { slug: string; why: string }[] = [];
    let costUsd = 0;

    for (const slug of slugs) {
      const a = await prisma.article.findUnique({
        where: { slug },
        select: {
          igMediaId: true, sourceText: true, titleMn: true, summaryMn: true, bodyMn: true,
          fbText: true, fbHook: true,
        },
      });
      if (!a) { failed.push({ slug, why: "олдсонгүй" }); continue; }
      try {
        const plan = await planFix(slug, {
          judge, title: arg("title"), cardTitle: arg("card-title"), note: arg("note"), now,
        });
        costUsd += plan.costUsd;
        // printPlan нь console.log хийдэг тул түүнийг мөн файлд авахын тулд
        // гаралтыг түр барина
        const orig = console.log;
        console.log = (...x: unknown[]) => { lines.push(x.join(" ")); orig(...x); };
        try { printPlan(plan); } finally { console.log = orig; }

        if (!plan.fixed) { failed.push({ slug, why: "зөрчилгүй — засах зүйл алга" }); continue; }
        if (a.igMediaId) {
          say("\n  IG тайлбар (API-аар засагдахгүй — гараар хуулна):");
          const capt = buildCaption(plan.fixed.fbText || a.fbText || "");
          say(`     IG media ${a.igMediaId} — шинэ тайлбар:`);
          for (const l of capt.split("\n")) say(`       ${l}`);
        }
        const file = savePlan(plan, { ...a }, now);
        say(`  Санал хадгалав: ${file}`);
        done.push({ slug, blocking: blocking(plan.remaining).length, file });
      } catch (e) {
        const why = (e as Error).message.slice(0, 220);
        failed.push({ slug, why });
        say(`\n✗ ${slug}: ${why}`);
      }
    }

    say(`\n${"═".repeat(96)}`);
    say(`Санал бэлэн: ${done.length}/${slugs.length} · LLM $${costUsd.toFixed(4)}`);

    const blocked = done.filter((d) => d.blocking > 0);
    if (blocked.length > 0) {
      say(`\n⊘ Засварын дараа ч ноцтой зөрчилтэй (--apply алгасна): ${blocked.length}`);
      for (const b of blocked) say(`  · ${b.slug} — ${b.blocking} зөрчил`);
    }
    if (failed.length > 0) {
      say(`\n✗ Санал гарсангүй: ${failed.length}`);
      for (const f of failed) say(`  · ${f.slug} — ${f.why}`);
      say("  Засаж болохгүй бол нуух: npm run article:fix -- --hide --slugs <slug>");
    }

    const digests = await digestsContaining(done.map((d) => d.slug));
    if (digests.length > 0) {
      say(`\nЭдгээр нийтлэлийг агуулсан долоо хоногийн тойм: ${digests.length}`);
      for (const d of digests) {
        say(`  · /medee/${d.slug} (${d.publishedAt?.toISOString().slice(0, 10) ?? "—"})` +
          `${d.fbPostId ? " · FB-д постлогдсон" : ""}`);
        say(`    засагдах нийтлэлүүд: ${d.items.join(", ")}`);
      }
      say("\n  --apply-ын ДАРАА тоймыг засагдсан биеэс дахин үүсгэнэ:");
      for (const d of digests) say(`    ./scripts/prod.sh agent:digest -- --replace ${d.slug}`);
    }

    const ready = done.filter((d) => d.blocking === 0).map((d) => d.slug);
    if (ready.length > 0) {
      say(`\nХэрэглэх: npm run article:fix -- --apply --slugs ${ready.join(",")}`);
    }

    // Бүтэн гаралтыг өдрийн файлд
    const dir = storeDir();
    mkdirSync(dir, { recursive: true });
    const logFile = join(dir, logFileName(now));
    writeFileSync(logFile, `${lines.join("\n")}\n`, { mode: 0o600, flag: "a" });
    console.log(`\nБүтэн гаралт: ${logFile}`);

    await prisma.$disconnect();
  });
}
