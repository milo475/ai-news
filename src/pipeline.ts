/**
 * Бүх шатыг дараалуулан ажиллуулна — cron-д зориулав.
 *
 *   npx tsx src/pipeline.ts                     # цагаас хамаарч горимоо сонгоно
 *   npx tsx src/pipeline.ts --mode publish      # горим албадах
 *   npx tsx src/pipeline.ts --only rss          # зөвхөн нэг алхам (горим, өдрийн шалгалтыг алгасна)
 *   npx tsx src/pipeline.ts --skip openrouter,arena
 *
 * Cron цаг бүр ажиллана (`0 * * * *` UTC), код нь УБ цагаар горимоо сонгоно:
 *
 *   НИЙТЛЭХ (publish) — УБ 07:00, 15:00, 19:00 (PUBLISH_HOURS_UB): бэлэн нийтлэлийг сайтад
 *     гаргаад тэр дор нь FB-д постлоно. RSS, үнэлгээ хийхгүй тул нэг минутын дотор дуусна.
 *   БЭЛТГЭХ (prepare) — бусад цагт: мэдээ татах, үнэлэх, дараагийн slot-д текст/зураг бэлдэх.
 *     Өдөрт нэг удаагийн алхмууд (openrouter, arena, digest, newsletter) УБ DAILY_HOUR_UB (3)
 *     цагаас хойших эхний prepare run дээр ажиллана.
 *
 * Нэг алхам унасан ч дараагийнх нь ажиллана; төгсгөлд дүнг хүснэгтээр хэвлээд,
 * ямар нэг алхам унасан бол exit 1. Давхар ажиллахаас JobRun-ийн lock хамгаална.
 */
import "dotenv/config";
import { runDigest } from "./agent/digest";
import { isDigestDay } from "./agent/digest.api";
import { runImprove } from "./agent/improve";
import { runAgent } from "./agent/process";
import { prisma } from "./db";
import { openRouterKey } from "./env";
import { ubDayRange } from "./jobs/day";
import { dailyHour, modeFor, publishHours, type Mode } from "./jobs/mode.api";
import { runArena } from "./fetchers/arena";
import { runOpenRouter } from "./fetchers/openrouter";
import { runRss } from "./fetchers/rss";
import { runNewsletter } from "./newsletter/send";
import { postPendingInstagram } from "./publish/instagram";
import { runPublishSlot } from "./publish/slot-run";
import { ubHour } from "./publish/slot.api";

/** Үүнээс удсан дуусаагүй pipeline-ийг үхсэн гэж үзнэ */
const LOCK_STALE_MS = 50 * 60_000;

interface Step {
  name: string;
  /** Аль горимд ажиллах вэ */
  mode: Mode;
  /** УБ цагаар өдөрт нэг л удаа — өмнө нь амжилттай ажилласан бол алгасна */
  oncePerDay?: boolean;
  run: () => Promise<string>;
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
  // ——— НИЙТЛЭХ ———
  {
    name: "publish",
    mode: "publish",
    run: async () => {
      const r = await runPublishSlot();
      return `${r.slot}: ${r.action} — ${r.detail}` + (r.costUsd > 0 ? ` ($${r.costUsd.toFixed(3)})` : "");
    },
  },

  {
    // Өмнөх slot-д унасан IG постуудыг дахин оролдоно (slot дээрх шинэ нийтлэл аль хэдийн явсан)
    name: "instagram",
    mode: "publish",
    run: async () => {
      const r = await postPendingInstagram();
      return r.skipped
        ? (r.reason ?? "тохируулаагүй, алгасав")
        : `${r.posted} постлосон, алдаа ${r.failed}, дараалалд ${r.queue}`;
    },
  },

  // ——— БЭЛТГЭХ ———
  {
    name: "openrouter",
    mode: "prepare",
    oncePerDay: true,
    run: async () => {
      const r = await runOpenRouter(7);
      return `${r.models} модель, ${r.rows} мөр`;
    },
  },
  {
    name: "arena",
    mode: "prepare",
    oncePerDay: true,
    run: async () => {
      const r = await runArena();
      return `${r.matched} модель (шинэ ${r.created}), ${r.date}`;
    },
  },
  {
    name: "rss",
    mode: "prepare",
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
    mode: "prepare",
    run: async () => {
      const r = await runAgent();
      if (r.skipped) return `алгасав — ${r.skipped}`;
      const summary = `${r.scored} үнэлсэн → ${r.drafted} DRAFT, алдаа ${r.failed} ($${r.costUsd.toFixed(3)})`;
      // Нийтлэл бүр унасан бол алхам өөрөө унасан гэж үзнэ — cron дээр эвдрэл нуугдахгүй
      if (r.scored > 0 && r.failed === r.scored) throw new Error(`бүх нийтлэл унасан — ${summary}`);
      return summary;
    },
  },
  {
    name: "improve",
    mode: "prepare",
    run: async () => {
      const r = await runImprove();
      return `бэлэн ${r.ready}, шинээр ${r.prepared.length}` +
        (r.imagesAdded > 0 ? `, зураг +${r.imagesAdded}` : "") +
        (r.costUsd > 0 ? ` ($${r.costUsd.toFixed(3)})` : "");
    },
  },
  {
    name: "digest",
    mode: "prepare",
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
    mode: "prepare",
    oncePerDay: true,
    run: async () => {
      // Зөвхөн Ням гарагт — тухайн өдөр гарсан digest-ийг илгээнэ
      if (!isDigestDay(new Date())) return "Ням гараг биш, алгасав";
      const r = await runNewsletter();
      return r.skipped ? (r.reason ?? "алгасав") : `${r.sent} хаяг руу илгээв (алдаа ${r.failed})`;
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

/** Өмнөх run дуусаагүй байвал энэ удаад алгасна (давхар ажиллахаас хамгаална) */
async function acquireLock(mode: Mode): Promise<{ id: string } | null> {
  await prisma.jobRun.updateMany({
    where: { job: "pipeline", finishedAt: null, startedAt: { lt: new Date(Date.now() - LOCK_STALE_MS) } },
    data: { finishedAt: new Date(), ok: false, error: "timeout — процесс дуусаагүй" },
  });
  const running = await prisma.jobRun.findFirst({
    where: { job: "pipeline", finishedAt: null },
    select: { id: true, mode: true, startedAt: true },
  });
  if (running) {
    console.log(
      `Өмнөх pipeline (${running.mode ?? "?"}, ${running.startedAt.toISOString().slice(11, 16)}) ` +
        `дуусаагүй байна — энэ удаад алгасав.`,
    );
    return null;
  }
  return prisma.jobRun.create({ data: { job: "pipeline", mode: mode.toUpperCase() }, select: { id: true } });
}

async function main() {
  const arg = (name: string): string => {
    const i = process.argv.indexOf(name);
    return i > -1 ? (process.argv[i + 1] ?? "").trim() : "";
  };
  const skip = new Set(arg("--skip").split(",").map((s) => s.trim()).filter(Boolean));
  const only = arg("--only");
  // --only pipeline = бүх алхам
  const selected = only && only !== "pipeline" ? new Set([only]) : null;

  const forced = arg("--mode").toLowerCase();
  const now = new Date();
  const mode: Mode =
    forced === "publish" || forced === "prepare" ? forced : modeFor(now, publishHours());
  // Алхмаа нэрлэсэн бол горимыг нь өөрөөс нь авна
  const stepMode = selected ? STEPS.find((s) => selected.has(s.name))?.mode : null;
  const activeMode = stepMode ?? mode;

  const willRun = (step: Step) =>
    !skip.has(step.name) && (selected ? selected.has(step.name) : step.mode === activeMode);

  console.log(
    `Горим: ${activeMode.toUpperCase()} (УБ ${String(ubHour(now)).padStart(2, "0")}:00` +
      `${forced ? ", албадсан" : ""})`,
  );

  // LLM шаардлагатай алхам ажиллах гэж байвал түлхүүрийг эхлэхэд нь шалгана
  const needsLlm = STEPS.filter((s) => ["openrouter", "agent", "improve"].includes(s.name)).some(willRun);
  if (needsLlm) openRouterKey();

  const lock = selected ? null : await acquireLock(activeMode);
  if (!lock && !selected) {
    await prisma.$disconnect();
    return;
  }
  // Алхмуудын JobRun-д ч горим бичигдэнэ (jobRunMeta уншина)
  process.env.JOB_MODE = activeMode.toUpperCase();

  const rows: Row[] = [];
  let failed = false;

  for (const step of STEPS) {
    if (!willRun(step)) continue;

    // Өдөрт нэг удаагийн алхам: заасан цагаас хойш, өнөөдөр ажиллаагүй бол
    if (step.oncePerDay && !selected) {
      if (ubHour(now) < dailyHour()) {
        rows.push({ Алхам: step.name, Төлөв: "алгасав", "Үр дүн": `УБ ${dailyHour()}:00-аас хойш`, Хугацаа: "—" });
        continue;
      }
      if (await ranToday(step.name)) {
        rows.push({ Алхам: step.name, Төлөв: "алгасав", "Үр дүн": "өнөөдөр ажилласан", Хугацаа: "—" });
        continue;
      }
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

  if (lock) {
    await prisma.jobRun.update({
      where: { id: lock.id },
      data: { finishedAt: new Date(), ok: !failed, itemsOut: rows.filter((r) => r.Төлөв === "ok").length },
    });
  }
  await prisma.$disconnect();
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
