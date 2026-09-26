/**
 * Каталогийн 80 хэрэгслийг нэмж, LLM-ээр тайлбарыг бөглөж, логыг татна.
 *
 *   npm run seed:tools                 — байхгүйг нь нэмнэ (PUBLISHED)
 *   npm run seed:tools -- --only 5     — эхний 5
 *   npm run seed:tools -- --no-logo    — лого татахгүй (хурдан)
 *   npm run seed:tools -- --logos-only — байгаа хэрэгслүүдийн логыг л татна
 *
 * Давтан ажиллуулахад аюулгүй: Tool.topic-оор давхардлыг шалгана.
 */
import "dotenv/config";
import { prisma } from "../db";
import { slugify } from "../agent/slug";
import { cleanCategories, cleanPlatforms, normalizeWebsite } from "./tool.api";
import { enrichTool } from "./enrich";
import { uniqueToolSlug } from "./mutations";
import { SEED_TOOLS } from "./seed.api";
import type { MongolianSupport, ToolPlan } from "../generated/prisma/enums";

export interface SeedResult {
  created: { name: string; slug: string }[];
  skipped: string[];
  failed: { name: string; error: string }[];
  logos: number;
  noLogo: string[];
  deadSites: { name: string; status: number | null }[];
  blockedSites: string[];
  linked: number;
  costUsd: number;
}

export async function alreadyWritten(topic: string): Promise<boolean> {
  const found = await prisma.tool.findFirst({ where: { topic }, select: { id: true } });
  return found !== null;
}

export async function seedTools(
  opts: { only?: number; withLogo?: boolean; logosOnly?: boolean } = {},
): Promise<SeedResult> {
  const list = opts.only ? SEED_TOOLS.slice(0, opts.only) : SEED_TOOLS;
  const r: SeedResult = {
    created: [], skipped: [], failed: [], logos: 0, noLogo: [], deadSites: [], blockedSites: [],
    linked: 0, costUsd: 0,
  };

  const { fetchLogo, websiteAlive } = await import("./logo");

  if (!opts.logosOnly) {
    for (const [i, t] of list.entries()) {
      if (await alreadyWritten(t.name)) {
        console.log(`${i + 1}/${list.length} ⏭  ${t.name}`);
        r.skipped.push(t.name);
        continue;
      }

      const website = normalizeWebsite(t.website);
      if (!website) {
        r.failed.push({ name: t.name, error: "вэбсайтын хаяг танигдсангүй" });
        continue;
      }

      // Хаяг ажиллахгүй бол бичлэгийг үүсгэсэн ч логд тэмдэглэнэ — админ шалгана
      const alive = await websiteAlive(website);
      if (alive.blocked) {
        // Cloudflare гэх мэт ботыг хориглосон — сайт өөрөө ажиллаж байна
        r.blockedSites.push(t.name);
      } else if (!alive.ok) {
        r.deadSites.push({ name: t.name, status: alive.status });
        console.warn(`${i + 1}/${list.length} ⚠ ${t.name}: сайт ${alive.status ?? "хариу алга"}`);
      }

      console.log(`${i + 1}/${list.length} ✎ ${t.name}`);
      try {
        const e = await enrichTool(t.name, website, {
          hint: `Магадгүй ангилал: ${t.categories.join(", ")}`,
        });
        r.costUsd += e.costUsd;

        const slug = await uniqueToolSlug(slugify(t.name));
        const created = await prisma.tool.create({
          data: {
            slug,
            name: t.name,
            website,
            topic: t.name,
            tagline: e.tagline,
            descriptionMd: e.descriptionMd,
            // Seed-ийн ангилал нь баримт — LLM-ийнхтэй нэгтгэнэ
            categories: [...new Set([...t.categories, ...cleanCategories(e.categories)])],
            pricing: e.pricing as ToolPlan,
            priceFrom: e.priceFrom > 0 ? e.priceFrom : null,
            platforms: cleanPlatforms(e.platforms),
            mongolianSupport: e.mongolianSupport as MongolianSupport,
            mnNoteMd: e.mnNoteMd,
            status: "PUBLISHED",
            source: "SITE",
            publishedAt: new Date(),
          },
          select: { id: true, slug: true },
        });
        r.created.push({ name: t.name, slug: created.slug });
        console.log(`   ✓ /hereglel/${created.slug} ($${e.costUsd.toFixed(4)})`);
      } catch (e) {
        const error = (e as Error).message.slice(0, 160);
        r.failed.push({ name: t.name, error });
        console.warn(`   ✗ ${error}`);
      }
    }
  }

  // Лого — тайлбараас тусдаа, унасан ч хэрэгсэл үлдэнэ
  if (opts.withLogo !== false) {
    const needLogo = await prisma.tool.findMany({
      where: { source: "SITE", logoAt: null },
      select: { id: true, name: true, website: true },
    });
    for (const [i, t] of needLogo.entries()) {
      const logo = await fetchLogo(t.website);
      if (!logo) {
        r.noLogo.push(t.name);
        console.warn(`лого ${i + 1}/${needLogo.length} ✗ ${t.name}`);
        continue;
      }
      await prisma.tool.update({
        where: { id: t.id },
        data: { logoData: new Uint8Array(logo.data), logoType: logo.contentType, logoAt: new Date() },
      });
      r.logos++;
      console.log(`лого ${i + 1}/${needLogo.length} ✓ ${t.name} (${(logo.data.length / 1024).toFixed(0)} KB)`);
    }
  }

  r.linked = await linkAlternatives();
  return r;
}

/** Хувилбаруудыг нэрээр холбоно. Тэгш холбоос тул нэг тал тавихад хоёулаа харагдана. */
export async function linkAlternatives(): Promise<number> {
  const byName = new Map(
    (await prisma.tool.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]),
  );
  let linked = 0;

  for (const t of SEED_TOOLS) {
    const id = byName.get(t.name);
    if (!id || !t.alternatives?.length) continue;
    const ids = t.alternatives.flatMap((n) => {
      const other = byName.get(n);
      return other && other !== id ? [{ id: other }] : [];
    });
    if (ids.length === 0) continue;
    await prisma.tool.update({ where: { id }, data: { alternativesTo: { connect: ids } } });
    linked += ids.length;
  }
  return linked;
}

if (process.argv[1]?.endsWith("seed.ts") && process.argv[1]?.includes("tools")) {
  const onlyArg = process.argv.indexOf("--only");
  const r = await seedTools({
    only: onlyArg > -1 ? Number(process.argv[onlyArg + 1]) : undefined,
    withLogo: !process.argv.includes("--no-logo"),
    logosOnly: process.argv.includes("--logos-only"),
  });

  console.log(
    `\n${r.created.length} шинэ, ${r.skipped.length} алгассан, ${r.failed.length} амжилтгүй · ` +
    `${r.logos} лого татсан, ${r.noLogo.length} логогүй · ${r.linked} хувилбарын холбоос · ` +
    `$${r.costUsd.toFixed(3)}`,
  );
  if (r.deadSites.length > 0) {
    console.warn(`\n⚠ Хариу өгөөгүй сайтууд (админ шалгана уу):`);
    for (const d of r.deadSites) console.warn(`  ${d.name} — ${d.status ?? "холбогдсонгүй"}`);
  }
  if (r.blockedSites.length > 0) {
    console.log(`\nБотыг хориглосон (сайт нь зүгээр): ${r.blockedSites.join(", ")}`);
  }
  if (r.noLogo.length > 0) console.log(`\nЛого олдсонгүй (үсгэн avatar): ${r.noLogo.join(", ")}`);
  await prisma.$disconnect();
}
