/**
 * `npm run publish:sim` — шинэ сонголтын дүрмийг ХУУЧИН өгөгдөл дээр давтана.
 *
 *   npm run publish:sim                # сүүлийн 14 хоног
 *   npm run publish:sim -- --days 30
 *
 * DB-ээс ЗӨВХӨН УНШИНА. Нийтлэгдэх үеийн насны тархалтыг ОДОО байгаа дүрэм
 * (оноо → эх сурвалжийн шинэ мэдээ) болон ШИНЭ дүрэм (оноо + шинэлэг байдал,
 * хуучирсныг эхнээс нь хасах) хоёрт тус тусад нь гаргаж харьцуулна.
 *
 * ХЯЗГААРЛАЛТ (шударгаар): энэ нь бүрэн дахин тоглуулалт БИШ. Тухайн агшинд
 * ямар ноорог байсныг DB-ийн `createdAt` / `publishedAt`-аар сэргээдэг тул
 * REJECTED болсон нийтлэлүүд, зургийн квот, FB-ийн дараалал зэрэг нөлөө
 * тооцогдохгүй. Насны тархалтын ЧИГ ХАНДЛАГА-г харуулахад хангалттай.
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import type { ArticleCategory } from "../generated/prisma/enums";
import { ubDayRange } from "../jobs/day";
import { upcomingSlots } from "./slot.api";
import { ageHours, selectForPublish, minScoreFor, type PublishCandidate } from "../agent/quota.api";
import { newsMaxAgeHours, TIMELESS_CATEGORIES } from "./prepublish.api";
import { ageStats, checkTarget, type AgeStats } from "./freshness.api";

interface Row {
  id: string;
  relevance: number;
  sourceId: string;
  category: ArticleCategory;
  tags: string[];
  publishedAtSource: Date | null;
  createdAt: Date;
  publishedAt: Date | null;
  status: string;
  models: { slug: string }[];
  companies: { slug: string }[];
}

function toCandidate(a: Row): PublishCandidate {
  return {
    id: a.id, relevance: a.relevance, sourceId: a.sourceId, category: a.category, tags: a.tags,
    publishedAtSource: a.publishedAtSource, createdAt: a.createdAt,
    modelSlugs: a.models.map((m) => m.slug),
    companySlugs: a.companies.map((c) => c.slug),
  };
}

export async function loadPool(days: number): Promise<Row[]> {
  // Цонхны эхлэлээс 7 хоногийн өмнөх ноорог ч нэр дэвшинэ — буфер тэрнээс бүрдэнэ
  const since = new Date(Date.now() - (days + 7) * 86_400_000);
  return prisma.article.findMany({
    where: {
      kind: "NEWS", isLocal: false, createdAt: { gte: since },
      status: { in: ["DRAFT", "PUBLISHED"] },
      titleMn: { not: null },
    },
    select: {
      id: true, relevance: true, sourceId: true, category: true, tags: true,
      publishedAtSource: true, createdAt: true, publishedAt: true, status: true,
      models: { select: { slug: true } },
      companies: { select: { slug: true } },
    },
  }) as Promise<Row[]>;
}

const isTimeless = (c: ArticleCategory) => TIMELESS_CATEGORIES.has(c);

export interface SimOut {
  actual: AgeStats;
  simulated: AgeStats;
  /** Шинэ дүрмээр хоосон үлдэх байсан slot-ын тоо */
  emptySlots: number;
  events: number;
}

/**
 * Нийтлэх агшин бүрийг давтана.
 *
 * `useFreshness=false` бол `selectForPublish`-д `now`-г маш хол өгч шинэлэг
 * байдлын нөлөөг тэглэнэ — ингэснээр хоёр дүрмийг ИЖИЛ кодоор жиших боломжтой.
 */
export function simulate(rows: Row[], days: number, opts: { freshness: boolean; maxAgeH: number }): SimOut {
  const windowStart = new Date(Date.now() - days * 86_400_000);
  const events = rows
    .filter((r) => r.publishedAt && r.publishedAt >= windowStart)
    .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime());

  const actualAges: number[] = [];
  let actualTimeless = 0;
  for (const e of events) {
    if (isTimeless(e.category)) { actualTimeless++; continue; }
    if (!e.publishedAtSource) continue;
    actualAges.push((e.publishedAt!.getTime() - e.publishedAtSource.getTime()) / 3_600_000);
  }

  const picked = new Set<string>();
  const simAges: number[] = [];
  let simTimeless = 0;
  let emptySlots = 0;

  for (const e of events) {
    const at = e.publishedAt!;
    const { start } = ubDayRange(at);

    const pool = rows.filter((r) => {
      if (picked.has(r.id)) return false;
      if (r.createdAt > at) return false;                       // тэр үед байгаагүй
      if (r.publishedAt && r.publishedAt <= at) return false;    // аль хэдийн гарсан
      if (r.relevance < minScoreFor(r.category)) return false;
      if (isTimeless(r.category)) return true;
      if (!r.publishedAtSource) return true;                     // огноо мэдэгдэхгүй
      return ageHours(toCandidate(r), at) <= opts.maxAgeH;       // хуучирсныг хасна
    });

    const todayPicked = rows.filter((r) => picked.has(r.id) && r.publishedAt && r.publishedAt >= start);
    const slot = upcomingSlots(at, 1)[0];
    const chosen = selectForPublish(
      pool.map(toCandidate),
      1,
      todayPicked.map(toCandidate),
      slot?.categories ?? [],
      // Шинэлэг байдлыг унтраахын тулд «одоо» -г маш хол болгоно: бүх нэр
      // дэвшигчийн шинэлэг байдал 0 болж, эрэмбэ нь зөвхөн оноогоор тогтоно
      { now: opts.freshness ? at : new Date(at.getTime() + 365 * 86_400_000) },
    )[0];

    if (!chosen) { emptySlots++; continue; }
    picked.add(chosen.id);

    const row = rows.find((r) => r.id === chosen.id)!;
    if (isTimeless(row.category)) { simTimeless++; continue; }
    if (!row.publishedAtSource) continue;
    simAges.push((at.getTime() - row.publishedAtSource.getTime()) / 3_600_000);
  }

  return {
    actual: ageStats(actualAges, actualTimeless),
    simulated: ageStats(simAges, simTimeless),
    emptySlots,
    events: events.length,
  };
}

function line(label: string, s: AgeStats): void {
  const f = (v: number | null) => (v === null ? "—" : `${v}ц`);
  console.log(
    `  ${label.padEnd(22)} n=${String(s.n).padStart(3)}  ` +
      `p50 ${f(s.p50).padStart(7)}  p90 ${f(s.p90).padStart(7)}  ` +
      `дээд ${f(s.max).padStart(7)}  хугацаагүй ${s.timeless}`,
  );
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (isEntry("freshness-sim.ts")) {
  await runCli(async () => {
    const days = Number(arg("days") ?? 14);
    const maxAgeH = Number(arg("max-age") ?? newsMaxAgeHours());
    const rows = await loadPool(days);
    console.log(`Симуляц: сүүлийн ${days} хоног · нэр дэвшигчийн сан ${rows.length} нийтлэл`);
    console.log(`Насны хязгаар: ${maxAgeH}ц\n`);

    const withFresh = simulate(rows, days, { freshness: true, maxAgeH });
    const without = simulate(rows, days, { freshness: false, maxAgeH: 10_000 });

    console.log(`Нийтлэх агшин: ${withFresh.events}\n`);
    console.log("Нийтлэгдэх үеийн нас:");
    line("бодит (production)", withFresh.actual);
    line("одоогийн дүрэм", without.simulated);
    line("шинэ дүрэм", withFresh.simulated);

    console.log(`\nШинэ дүрмээр хоосон үлдэх slot: ${withFresh.emptySlots}/${withFresh.events}`);

    const verdict = checkTarget(withFresh.simulated);
    console.log(`\n${verdict.met ? "✓" : "⊘"} ${verdict.detail}`);
    if (verdict.recommendedMaxAgeH) {
      console.log(`   NEWS_MAX_AGE_H=${verdict.recommendedMaxAgeH}`);
    }

    console.log(
      "\nХЯЗГААРЛАЛТ: энэ нь бүрэн дахин тоглуулалт биш — REJECTED нийтлэл, зургийн квот,\n" +
        "FB-ийн дараалал тооцогдоогүй. Чиг хандлагыг харуулна, тоог баталгаа гэж үзэхгүй.",
    );
    await prisma.$disconnect();
  });
}
