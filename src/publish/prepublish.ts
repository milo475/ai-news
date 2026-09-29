/**
 * Нийтлэхийн өмнөх шалгалтын DB давхарга.
 *
 * Хоёр шат:
 *   1. Механик fidelity (зардалгүй) — гарчиг, бэлэн картын гарчиг, fbText.
 *      Зөрчилтэй бол картыг/текстийг ШИНЭ дүрмээр дахин үүсгэнэ.
 *   2. Сүүлийн 48 цагийн нийтлэлтэй давхардлын шалгалт.
 */
import { prisma } from "../db";
import {
  canRepair, checkAge, checkBeforePublish, checkDuplicate, newsMaxAgeHours, RECENT_HOURS,
  UPDATE_PREFIX, withUpdatePrefix,
  type DuplicateVerdict, type FieldIssue, type RecentArticle,
} from "./prepublish.api";

const SELECT = {
  id: true, slug: true, titleMn: true, summaryMn: true, bodyMn: true, category: true,
  fbHook: true, fbText: true, fbImageData: true, publishedAtSource: true,
  companies: { select: { name: true } },
} as const;

function toRecent(a: {
  slug: string;
  titleMn: string | null;
  summaryMn: string | null;
  category: string;
  companies: { name: string }[];
}): RecentArticle {
  return {
    slug: a.slug,
    titleMn: a.titleMn ?? "",
    summaryMn: a.summaryMn ?? "",
    category: a.category,
    companies: a.companies.map((c) => c.name),
  };
}

export interface GateResult {
  ok: boolean;
  /** Яагаад алгасах болсон (ok=false үед) */
  reason?: string;
  /** Илэрсэн fidelity зөрчлүүд */
  issues: FieldIssue[];
  /** Карт/текст дахин үүсгэсэн эсэх */
  repaired: boolean;
  duplicate: DuplicateVerdict;
  /** Гарчигт «Шинэчлэл:» нэмсэн эсэх */
  prefixed: boolean;
  costUsd: number;
}

/** Сүүлийн 48 цагт нийтлэгдсэн мэдээнүүд */
export async function recentlyPublished(now = new Date(), hours = RECENT_HOURS): Promise<RecentArticle[]> {
  const rows = await prisma.article.findMany({
    where: {
      kind: "NEWS", status: "PUBLISHED",
      publishedAt: { gte: new Date(now.getTime() - hours * 3_600_000) },
    },
    orderBy: { publishedAt: "desc" },
    take: 40,
    select: { slug: true, titleMn: true, summaryMn: true, category: true, companies: { select: { name: true } } },
  });
  return rows.map(toRecent);
}

/**
 * Нийтлэхийн өмнөх бүрэн шалгалт.
 *
 * `dryRun` үед DB-д юу ч бичихгүй — 3 бэлэн ноорог дээр шийдвэрийг урьдчилан харах.
 */
export async function gateBeforePublish(
  articleId: string,
  opts: { now?: Date; dryRun?: boolean } = {},
): Promise<GateResult> {
  const now = opts.now ?? new Date();
  const a = await prisma.article.findUniqueOrThrow({ where: { id: articleId }, select: SELECT });

  // ——— 0. Хуучирсан мэдээ (LLM-гүй, $0) ———
  const age = checkAge({
    category: a.category,
    publishedAtSource: a.publishedAtSource,
    now,
    maxAgeH: newsMaxAgeHours(),
  });
  if (age.stale) {
    return {
      ok: false, issues: [], repaired: false, costUsd: 0, prefixed: false,
      reason: age.reason ?? "хуучирсан",
      duplicate: { action: "skip", match: null, score: 0, newFacts: [], reason: "шалгаагүй" },
    };
  }

  // ——— 1. Механик fidelity ———
  let issues = checkBeforePublish(a);
  let repaired = false;
  let costUsd = 0;

  if (issues.length > 0) {
    console.warn(`  ⚠ нийтлэхийн өмнөх шалгалт: ${issues.map((i) => i.detail).join("; ")}`);

    if (!canRepair(issues)) {
      return {
        ok: false, issues, repaired: false, costUsd,
        reason: "нийтлэлийн ӨӨРИЙН гарчиг зөрчилтэй — карт дахин үүсгэж засахгүй",
        duplicate: { action: "skip", match: null, score: 0, newFacts: [], reason: "шалгаагүй" },
        prefixed: false,
      };
    }

    if (!opts.dryRun) {
      try {
        const fixed = await repair(articleId, issues);
        costUsd += fixed.costUsd;
        repaired = true;
        const after = await prisma.article.findUniqueOrThrow({ where: { id: articleId }, select: SELECT });
        issues = checkBeforePublish(after);
      } catch (e) {
        console.error(`  ✗ дахин үүсгэсэнгүй: ${(e as Error).message.slice(0, 160)}`);
      }
    }

    if (issues.length > 0) {
      return {
        ok: false, issues, repaired, costUsd,
        reason: `дахин үүсгэсний дараа ч зөрчилтэй: ${issues.map((i) => i.detail).join("; ")}`,
        duplicate: { action: "skip", match: null, score: 0, newFacts: [], reason: "шалгаагүй" },
        prefixed: false,
      };
    }
    console.log("  ✓ дахин үүсгэсний дараа шалгалтад тэнцлээ");
  }

  // ——— 2. Ижил үйл явдлын давхардал ———
  const duplicate = checkDuplicate(toRecent(a), await recentlyPublished(now));
  if (duplicate.action === "skip") {
    return { ok: false, reason: duplicate.reason, issues, repaired, duplicate, prefixed: false, costUsd };
  }

  let prefixed = false;
  if (duplicate.action === "update") {
    const title = withUpdatePrefix(a.titleMn ?? "");
    console.log(`  ↻ ${duplicate.reason}`);
    if (!opts.dryRun && title !== a.titleMn) {
      await prisma.article.update({ where: { id: articleId }, data: { titleMn: title } });
      prefixed = true;
    } else if (opts.dryRun) {
      prefixed = title !== a.titleMn;
    }
  }

  return { ok: true, issues, repaired, duplicate, prefixed, costUsd };
}

/** Зөрчилтэй талбарыг шинэ дүрмээр дахин үүсгэнэ */
async function repair(articleId: string, issues: FieldIssue[]): Promise<{ costUsd: number }> {
  let costUsd = 0;

  if (issues.some((i) => i.field === "картын гарчиг")) {
    const { cardForArticle, saveCard } = await import("./card");
    const { recentImagePrompts } = await import("./fbimage");
    console.log("  ↻ картыг шинэ дүрмээр дахин үүсгэж байна…");
    const built = await cardForArticle(articleId, { recentPrompts: await recentImagePrompts() });
    await saveCard(articleId, built);
    costUsd += built.costUsd;
  }

  if (issues.some((i) => i.field === "FB текст")) {
    const { generateFbCopy } = await import("./fbcopy");
    console.log("  ↻ FB текстийг дахин бичиж байна…");
    const r = await generateFbCopy(articleId);
    costUsd += r.costUsd;
  }

  return { costUsd };
}

export { UPDATE_PREFIX };
