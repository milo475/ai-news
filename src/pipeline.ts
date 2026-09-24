/**
 * Бүх шатыг дараалуулан ажиллуулна — cron-д зориулав.
 *
 *   npx tsx src/pipeline.ts
 *   npx tsx src/pipeline.ts --skip openrouter,facebook
 *   npx tsx src/pipeline.ts --only rss          # зөвхөн нэг алхам ("pipeline" = бүгд)
 *
 * Нэг алхам унасан ч дараагийнх нь ажиллана; төгсгөлд дүнг хүснэгтээр хэвлээд,
 * ямар нэг алхам унасан бол exit 1.
 *
 * Өдөрт 3 удаа ажиллана (Railway cron `0 1,5,11 * * *` UTC = УБ 09:00, 13:00, 19:00).
 * `oncePerDay` алхмууд (openrouter, arena, digest, newsletter) УБ цагаар тухайн өдөр
 * амжилттай ажилласан бол дахин ажиллахгүй. `--only <алхам>` гэж нэрлэвэл албадана.
 */
import "dotenv/config";
import { runDigest } from "./agent/digest";
import { isDigestDay } from "./agent/digest.api";
import { runAgent } from "./agent/process";
import { prisma } from "./db";
import { openRouterKey } from "./env";
import { ubDayRange } from "./jobs/day";
import { runArena } from "./fetchers/arena";
import { runOpenRouter } from "./fetchers/openrouter";
import { runRss } from "./fetchers/rss";
import { runNewsletter } from "./newsletter/send";
import { postPending } from "./publish/facebook";

interface Step {
  name: string;
  run: () => Promise<string>;
  /** УБ цагаар өдөрт нэг л удаа — өмнө нь амжилттай ажилласан бол алгасна */
  oncePerDay?: boolean;
}

/** Тухайн ажил УБ цагаар өнөөдөр амжилттай ажилласан уу */
async function ranToday(job: string, now = new Date()): Promise<boolean> {
  const { start, end } = ubDayRange(now);
  const run = await prisma.jobRun.findFirst({
    where: { job, ok: true, startedAt: { gte: start, lt: end } },
    select: { id: true },
  });
  return run !== null;
}

const STEPS: Step[] = [
  {
    name: "openrouter",
    oncePerDay: true,
    run: async () => {
      const r = await runOpenRouter(7);
      return `${r.models} модель, ${r.rows} мөр`;
    },
  },
  {
    name: "arena",
    oncePerDay: true,
    run: async () => {
      const r = await runArena();
      return `${r.matched} модель (шинэ ${r.created}), ${r.date}`;
    },
  },
  {
    name: "rss",
    run: async () => {
      const r = await runRss();
      const summary = `${r.items} item → ${r.saved} шинэ, алдаатай эх сурвалж ${r.failedSources}/${r.sources}`;
      // Эх сурвалж бүр унасан бол алхам өөрөө унасан гэж үзнэ
      if (r.sources > 0 && r.failedSources === r.sources) throw new Error(`бүх эх сурвалж унасан — ${summary}`);
      return summary;
    },
  },
  {
    name: "agent",
    run: async () => {
      const r = await runAgent(30);
      const summary = `${r.scored} үнэлсэн → ${r.drafted} DRAFT, ${r.published} нийтэлсэн, алдаа ${r.failed}`;
      // Нийтлэл бүр унасан бол алхам өөрөө унасан гэж үзнэ — cron дээр эвдрэл нуугдахгүй
      if (r.scored > 0 && r.failed === r.scored) throw new Error(`бүх нийтлэл унасан — ${summary}`);
      return summary;
    },
  },
  {
    name: "digest",
    oncePerDay: true,
    run: async () => {
      // Долоо хоногийн тойм — зөвхөн Ням гарагт (UTC)
      if (!isDigestDay(new Date())) return "Ням гараг биш, алгасав";
      const r = await runDigest(true);
      return r.created ? `"${r.title}" → /medee/${r.slug} (${r.items} мэдээ)` : `мэдээ цөөн (${r.items}), үүсгэсэнгүй`;
    },
  },
  {
    name: "newsletter",
    oncePerDay: true,
    run: async () => {
      // Зөвхөн Ням гарагт — тухайн өдөр гарсан digest-ийг илгээнэ
      if (!isDigestDay(new Date())) return "Ням гараг биш, алгасав";
      const r = await runNewsletter();
      return r.skipped ? (r.reason ?? "алгасав") : `${r.sent} хаяг руу илгээв (алдаа ${r.failed})`;
    },
  },
  {
    name: "facebook",
    run: async () => {
      const r = await postPending();
      return r.skipped
        ? "тохируулаагүй, алгасав"
        : `${r.slot}: ${r.posted} постлосон, алдаа ${r.failed}, дараалалд ${r.queue}` +
          (r.costUsd > 0 ? `, зураг $${r.costUsd.toFixed(3)}` : "");
    },
  },
];

interface Row {
  Алхам: string;
  Төлөв: string;
  "Үр дүн": string;
  Хугацаа: string;
}

function since(t0: number): string {
  return `${((Date.now() - t0) / 1000).toFixed(1)}с`;
}

async function main() {
  const skipArg = process.argv.indexOf("--skip");
  const skip = new Set(
    (skipArg > -1 ? (process.argv[skipArg + 1] ?? "") : "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > -1 ? (process.argv[onlyArg + 1] ?? "").trim() : "";
  // --only pipeline = бүх алхам
  const selected = only && only !== "pipeline" ? new Set([only]) : null;
  const willRun = (name: string) => !skip.has(name) && (!selected || selected.has(name));

  // LLM шаардлагатай алхам ажиллах гэж байвал түлхүүрийг эхлэхэд нь шалгана
  if (willRun("openrouter") || willRun("agent")) openRouterKey();

  const rows: Row[] = [];
  let failed = false;

  for (const step of STEPS) {
    if (!willRun(step.name)) {
      rows.push({
        Алхам: step.name,
        Төлөв: "алгасав",
        "Үр дүн": skip.has(step.name) ? "--skip" : `--only ${only}`,
        Хугацаа: "—",
      });
      continue;
    }
    // Өдөрт нэг удаагийн алхам — гараар «--only <алхам>» гэж дуудвал албадана
    if (step.oncePerDay && !selected?.has(step.name) && (await ranToday(step.name))) {
      console.log(`\n──── ${step.name} ──── өнөөдөр ажилласан, алгасав`);
      rows.push({ Алхам: step.name, Төлөв: "алгасав", "Үр дүн": "өнөөдөр ажилласан", Хугацаа: "—" });
      continue;
    }

    console.log(`\n──── ${step.name} ────`);
    const t0 = Date.now();
    try {
      rows.push({ Алхам: step.name, Төлөв: "ok", "Үр дүн": await step.run(), Хугацаа: since(t0) });
    } catch (e) {
      failed = true;
      const message = (e as Error).message.replace(/\s+/g, " ").slice(0, 100);
      console.error(`✗ ${step.name}: ${message}`);
      rows.push({ Алхам: step.name, Төлөв: "алдаа", "Үр дүн": message, Хугацаа: since(t0) });
    }
  }

  console.log("");
  console.table(rows);
  await prisma.$disconnect();
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
