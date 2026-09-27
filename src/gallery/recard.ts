/**
 * Картыг нуух / дахин үүсгэх — буруу гарчигтай карт гарсан үед.
 *
 *   npm run cards:fix -- --slug a,b,c --hide            # зөвхөн /barimt-аас нууна
 *   npm run cards:fix -- --slug a,b,c --regenerate      # шинэ дүрмээр дахин үүсгэж, ил гаргана
 *   npm run cards:fix -- --slug a,b,c --regenerate --keep-hidden
 *   npm run cards:fix -- --slug a,b,c --show            # нуусныг буцаан ил гаргана
 *   npm run cards:fix -- --hidden                       # нуугдсан картуудыг жагсаана
 *   npm run cards:fix -- --find "950"                   # гарчгаар хайж slug-ийг олно
 *
 * `--hide` нь зургийг устгахгүй — зөвхөн галерейгаас нууна (`Article.cardHidden`).
 * Аль хэдийн тавигдсан FB/IG пост нь тэр чигтээ үлдэнэ (тэднийг гараар устгана).
 *
 * `--regenerate` нь гарчиг, зургийг ШИНЭЭР үүсгэнэ — fidelity шүүгч, scene preset
 * зэрэг шинэ дүрмүүд хэрэгжинэ. Зургийн квотоос иднэ.
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { cardForArticle, saveCard } from "../publish/card";
import { recentImagePrompts } from "../publish/fbimage";

export interface FixResult {
  hidden: string[];
  shown: string[];
  regenerated: { slug: string; headline: string; costUsd: number }[];
  failed: { slug: string; error: string }[];
  notFound: string[];
}

export interface FixOptions {
  slugs: string[];
  hide?: boolean;
  show?: boolean;
  regenerate?: boolean;
  /** Дахин үүсгэсний дараа ч нуулттай үлдээх */
  keepHidden?: boolean;
}

export async function fixCards(opts: FixOptions): Promise<FixResult> {
  const r: FixResult = { hidden: [], shown: [], regenerated: [], failed: [], notFound: [] };

  const rows = await prisma.article.findMany({
    where: { slug: { in: opts.slugs } },
    select: { id: true, slug: true, titleMn: true, fbHook: true },
  });
  const found = new Set(rows.map((a) => a.slug));
  r.notFound = opts.slugs.filter((s) => !found.has(s));

  for (const a of rows) {
    // 1. Нуух — дахин үүсгэхээс ӨМНӨ, буруу карт хормын дотор ч харагдахгүй
    if (opts.hide || opts.regenerate) {
      await prisma.article.update({ where: { id: a.id }, data: { cardHidden: true } });
      r.hidden.push(a.slug);
      console.log(`  ⊘ нуув: ${a.slug}`);
    }

    if (opts.regenerate) {
      try {
        console.log(`\n── ${a.slug} ──\n  хуучин гарчиг: ${a.fbHook ?? "—"}`);
        const built = await cardForArticle(a.id, { recentPrompts: await recentImagePrompts() });
        await saveCard(a.id, built);
        r.regenerated.push({ slug: a.slug, headline: built.headline, costUsd: built.costUsd });
        console.log(`  шинэ гарчиг:   ${built.headline}`);

        if (!opts.keepHidden) {
          await prisma.article.update({ where: { id: a.id }, data: { cardHidden: false } });
          r.hidden = r.hidden.filter((s) => s !== a.slug);
          r.shown.push(a.slug);
        }
      } catch (e) {
        r.failed.push({ slug: a.slug, error: (e as Error).message.slice(0, 200) });
        console.error(`  ✗ ${a.slug}: ${(e as Error).message.slice(0, 160)}`);
      }
      continue;
    }

    if (opts.show) {
      await prisma.article.update({ where: { id: a.id }, data: { cardHidden: false } });
      r.shown.push(a.slug);
      console.log(`  ✓ ил гаргав: ${a.slug}`);
    }
  }
  return r;
}

/** Картын гарчиг эсвэл нийтлэлийн гарчгаар хайна — slug мэдэхгүй үед */
export async function findCards(text: string) {
  return prisma.article.findMany({
    where: {
      fbImageAt: { not: null },
      OR: [
        { fbHook: { contains: text, mode: "insensitive" } },
        { titleMn: { contains: text, mode: "insensitive" } },
        { slug: { contains: text, mode: "insensitive" } },
      ],
    },
    orderBy: { fbImageAt: "desc" },
    take: 20,
    select: { slug: true, titleMn: true, fbHook: true, cardHidden: true },
  });
}

/** Нуугдсан картууд — юуг нь буцааж ил гаргахаа мэдэхэд */
export async function listHidden() {
  return prisma.article.findMany({
    where: { cardHidden: true },
    orderBy: { fbImageAt: "desc" },
    select: { slug: true, fbHook: true, fbImageAt: true },
  });
}

if (isEntry("recard.ts")) {
  await runCli(async () => {
    const argv = process.argv;
    const at = argv.indexOf("--slug");
    const slugs = at > -1 ? (argv[at + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : [];

    const findAt = argv.indexOf("--find");
    if (findAt > -1) {
      const text = (argv[findAt + 1] ?? "").trim();
      if (!text) throw new Error("--find дараа хайх текстээ бичнэ үү");
      const rows = await findCards(text);
      if (rows.length === 0) {
        console.log(`«${text}» гэсэн карт олдсонгүй.`);
        return;
      }
      console.log(`${rows.length} карт олдлоо:\n`);
      for (const a of rows) {
        console.log(`  ${a.slug}${a.cardHidden ? "  [нуусан]" : ""}`);
        console.log(`    нийтлэл: ${a.titleMn ?? "—"}`);
        console.log(`    карт:    ${a.fbHook ?? "—"}\n`);
      }
      return;
    }

    if (argv.includes("--hidden")) {
      const rows = await listHidden();
      if (rows.length === 0) {
        console.log("Нуугдсан карт алга.");
        return;
      }
      console.log(`${rows.length} нуугдсан карт:`);
      for (const a of rows) console.log(`  ${a.slug}\n    ${a.fbHook ?? "—"}`);
      return;
    }

    if (slugs.length === 0) {
      throw new Error(
        "Хэрэглээ: npm run cards:fix -- --slug <slug1,slug2> [--hide | --show | --regenerate [--keep-hidden]]\n" +
          "         npm run cards:fix -- --find <текст>\n" +
          "         npm run cards:fix -- --hidden",
      );
    }
    const hide = argv.includes("--hide");
    const show = argv.includes("--show");
    const regenerate = argv.includes("--regenerate");
    if (!hide && !show && !regenerate) throw new Error("--hide, --show эсвэл --regenerate сонгоно уу");

    const r = await fixCards({
      slugs, hide, show, regenerate, keepHidden: argv.includes("--keep-hidden"),
    });

    console.log("");
    if (r.notFound.length) console.warn(`⚠ олдсонгүй: ${r.notFound.join(", ")}`);
    if (r.hidden.length) console.log(`⊘ нуусан: ${r.hidden.length}`);
    if (r.shown.length) console.log(`✓ ил: ${r.shown.length}`);
    if (r.regenerated.length) {
      const cost = r.regenerated.reduce((n, x) => n + x.costUsd, 0);
      console.log(`↻ дахин үүсгэсэн: ${r.regenerated.length} — $${cost.toFixed(3)}`);
    }
    if (r.failed.length) {
      console.error(`✗ амжилтгүй: ${r.failed.map((f) => `${f.slug} (${f.error})`).join("; ")}`);
      throw new Error(`${r.failed.length} карт дахин үүссэнгүй`);
    }
  });
}
