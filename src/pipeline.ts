/**
 * Бүх шатыг дараалуулан ажиллуулна — cron-д зориулав.
 *
 *   npx tsx src/pipeline.ts
 *   npx tsx src/pipeline.ts --skip openrouter,facebook
 *   npx tsx src/pipeline.ts --only rss          # зөвхөн нэг алхам ("pipeline" = бүгд)
 *
 * Нэг алхам унасан ч дараагийнх нь ажиллана; төгсгөлд дүнг хүснэгтээр хэвлээд,
 * ямар нэг алхам унасан бол exit 1.
 */
import "dotenv/config";
import { runAgent } from "./agent/process";
import { prisma } from "./db";
import { openRouterKey } from "./env";
import { runOpenRouter } from "./fetchers/openrouter";
import { runRss } from "./fetchers/rss";
import { postPending } from "./publish/facebook";

interface Step {
  name: string;
  run: () => Promise<string>;
}

const STEPS: Step[] = [
  {
    name: "openrouter",
    run: async () => {
      const r = await runOpenRouter(7);
      return `${r.models} модель, ${r.rows} мөр`;
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
      const summary = `${r.scored} үнэлсэн → ${r.drafted} DRAFT, алдаа ${r.failed}`;
      // Нийтлэл бүр унасан бол алхам өөрөө унасан гэж үзнэ — cron дээр эвдрэл нуугдахгүй
      if (r.scored > 0 && r.failed === r.scored) throw new Error(`бүх нийтлэл унасан — ${summary}`);
      return summary;
    },
  },
  {
    name: "facebook",
    run: async () => {
      const r = await postPending();
      return r.skipped ? "тохируулаагүй, алгасав" : `${r.posted} постлосон, алдаа ${r.failed}`;
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
