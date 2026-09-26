/**
 * bench:reset-ийн цэвэр хэсэг (DB-гүй, тесттэй).
 */

/** "2026-09" хэлбэр — өөр бүх зүйлийг татгалзана */
export function isMonth(raw: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(raw)) return false;
  const m = Number(raw.slice(5));
  return m >= 1 && m <= 12;
}

export interface ResetArgs {
  month?: string;
  yes: boolean;
  /** Нийтлэгдсэн нийтлэлийг ч устгах (аюултай, зориуд) */
  withPublished: boolean;
}

export function parseArgs(argv: string[]): ResetArgs {
  const at = argv.indexOf("--month");
  const raw = at > -1 ? (argv[at + 1] ?? "").trim() : "";
  return {
    month: raw || undefined,
    yes: argv.includes("--yes"),
    withPublished: argv.includes("--with-published"),
  };
}

export interface Plan {
  month: string;
  runId: string;
  status: string;
  results: number;
  summaries: number;
  /** Устгах нийтлэлийн slug (DRAFT байвал) */
  articleSlug: string | null;
  /** Нийтлэгдсэн тул хөндөхгүй нийтлэлийн slug */
  keptArticleSlug: string | null;
}

/** Хүнд уншуулах тайлбар */
export function describePlan(p: Plan): string[] {
  const lines = [
    `${p.month} — run ${p.runId} (${p.status})`,
    `  ${p.results} үр дүн, ${p.summaries} дүгнэлт устана`,
  ];
  if (p.articleSlug) lines.push(`  DRAFT нийтлэл /medee/${p.articleSlug} устана`);
  if (p.keptArticleSlug) {
    lines.push(`  ⚠ /medee/${p.keptArticleSlug} нь НИЙТЛЭГДСЭН тул хөндөхгүй (--with-published гэвэл устгана)`);
  }
  if (!p.articleSlug && !p.keptArticleSlug) lines.push("  нийтлэл үүсээгүй байна");
  return lines;
}
