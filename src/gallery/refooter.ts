/**
 * Картын хөлийг дахин зурна — LLM ба зураг үүсгэх дуудлага ХИЙХГҮЙ.
 *
 *   npm run cards:footer -- --dry                      # юу засагдахыг харуулна
 *   npm run cards:footer -- --since 2026-09-25         # тэр өдрөөс хойшхыг засна
 *   npm run cards:footer -- --slug a,b,c               # зөвхөн эдгээрийг
 *
 * Хадгалсан `heroImageData` (текстгүй суурь зураг) дээр шинэ давхаргыг зурж
 * `fbImageData`-г дарж бичнэ. `fbImageAt` шинэчлэгдэнэ — ETag/кэш шинэчлэгдэх ёстой.
 * Аль хэдийн тавигдсан FB/IG постын зураг ТЭР ЧИГТЭЭ үлдэнэ (Meta өөртөө хуулсан).
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { UB_OFFSET_MS } from "../jobs/day";
import { creditText, CTA_FB } from "../publish/card.api";
import { renderCard } from "../publish/card";
import { BROKEN_FOOTER_SINCE, planFooters, usedSourceImage, type FooterRow } from "./refooter.api";

export interface FooterResult {
  redrawn: { slug: string; cta: string }[];
  skipped: { slug: string; reason: string }[];
  failed: { slug: string; error: string }[];
}

/** УБ огнооны 00:00-ийг UTC Date болгоно */
export function ubDayStart(label: string): Date {
  const [y, m, d] = label.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Огноо «${label}» буруу — 2026-09-25 хэлбэрээр бичнэ үү`);
  return new Date(Date.UTC(y, m - 1, d) - UB_OFFSET_MS);
}

export async function candidates(opts: { since?: string; slugs?: string[] }): Promise<FooterRow[]> {
  const where = opts.slugs?.length
    ? { slug: { in: opts.slugs } }
    : { fbImageAt: { gte: ubDayStart(opts.since ?? BROKEN_FOOTER_SINCE) } };

  const rows = await prisma.article.findMany({
    where: { ...where, fbImageKind: "card" },
    orderBy: { fbImageAt: "desc" },
    select: {
      id: true, slug: true, fbHook: true, fbImagePrompt: true,
      heroImageData: true, fbImageData: true,
    },
  });
  return rows.map((a) => ({
    id: a.id, slug: a.slug, fbHook: a.fbHook, fbImagePrompt: a.fbImagePrompt,
    hasHero: a.heroImageData !== null, hasCard: a.fbImageData !== null,
  }));
}

/** Нэг картын хөлийг дахин зурна */
export async function redrawFooter(articleId: string, cta = CTA_FB): Promise<string> {
  const a = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    select: {
      heroImageData: true, fbHook: true, fbImagePrompt: true,
      source: { select: { name: true } },
    },
  });
  if (!a.heroImageData) throw new Error("суурь зураг алга");
  const headline = (a.fbHook ?? "").trim();
  if (!headline) throw new Error("гарчиг алга");

  const credit = usedSourceImage(a.fbImagePrompt) ? creditText(a.source.name) : undefined;
  const card = await renderCard(Buffer.from(a.heroImageData), headline, { cta, credit });

  await prisma.article.update({
    where: { id: articleId },
    // heroImageData-г ХӨНДӨХГҮЙ — суурь зураг хэвээр. fbImageAt нь кэшийг шинэчилнэ.
    data: { fbImageData: new Uint8Array(card), fbImageAt: new Date() },
  });
  return headline;
}

export async function fixFooters(opts: {
  since?: string;
  slugs?: string[];
  dryRun?: boolean;
  cta?: string;
}): Promise<FooterResult> {
  const rows = await candidates(opts);
  const plan = planFooters(rows);
  const r: FooterResult = { redrawn: [], skipped: plan.skipped, failed: [] };
  const cta = opts.cta ?? CTA_FB;

  for (const a of plan.redraw) {
    if (opts.dryRun) {
      r.redrawn.push({ slug: a.slug, cta });
      console.log(`  (dry) ${a.slug} — ${a.fbHook}`);
      continue;
    }
    try {
      const headline = await redrawFooter(a.id, cta);
      r.redrawn.push({ slug: a.slug, cta });
      console.log(`  ✓ ${a.slug} — ${headline}`);
    } catch (e) {
      r.failed.push({ slug: a.slug, error: (e as Error).message.slice(0, 160) });
      console.error(`  ✗ ${a.slug}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return r;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (isEntry("refooter.ts")) {
  await runCli(async () => {
    const slugs = (arg("slug") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const since = arg("since") ?? BROKEN_FOOTER_SINCE;
    const dryRun = process.argv.includes("--dry");

    console.log(
      slugs.length
        ? `Картын хөл засах — ${slugs.length} slug${dryRun ? " (dry)" : ""}`
        : `Картын хөл засах — ${since}-аас хойш${dryRun ? " (dry)" : ""}`,
    );
    console.log(`Шинэ хөл: «${CTA_FB}»\n`);

    const r = await fixFooters({ since, slugs, dryRun });

    console.log("");
    console.log(`${dryRun ? "засагдах" : "засав"}: ${r.redrawn.length}`);
    if (r.skipped.length) {
      console.log(`алгасав: ${r.skipped.length}`);
      for (const s of r.skipped) console.log(`  · ${s.slug} — ${s.reason}`);
    }
    if (r.failed.length) throw new Error(`${r.failed.length} карт засагдсангүй`);
    if (dryRun && r.redrawn.length) console.log("\nҮнэхээр засах: --dry-г хасаад дахин ажиллуул.");
  });
}
