/**
 * `npm run cost:report` — сүүлийн өдрүүдийн LLM зардлыг алхам бүрээр харуулна.
 *
 *   npm run cost:report              # 3 хоног
 *   npm run cost:report -- --days 7
 *
 * DB-ээс ЗӨВХӨН УНШИНА — юу ч бичихгүй. Production дээр аюулгүй ажиллана.
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { recentCosts } from "./cost";
import { dailyLlmBudget, UNCAPPED_STEPS, unrecorded, type DayCost } from "./cost.api";
import { openRouterBalance } from "../lib/balance";

const DEFAULT_DAYS = 3;

/** Бүх өдрийн алхмуудын нэгдэл — хүснэгтийн мөрүүд */
export function allJobs(days: DayCost[]): string[] {
  const seen = new Map<string, number>();
  for (const d of days) {
    for (const s of d.steps) seen.set(s.job, (seen.get(s.job) ?? 0) + s.usd);
  }
  return [...seen].sort((a, b) => b[1] - a[1]).map(([job]) => job);
}

export function labelOf(days: DayCost[], job: string): string {
  for (const d of days) {
    const s = d.steps.find((x) => x.job === job);
    if (s) return s.label;
  }
  return job;
}

if (isEntry("cost-report.ts")) {
  await runCli(async () => {
    const i = process.argv.indexOf("--days");
    const days = i > -1 ? Math.max(1, Math.min(31, Number(process.argv[i + 1]) || DEFAULT_DAYS)) : DEFAULT_DAYS;

    const rows = await recentCosts(days);
    const budget = dailyLlmBudget();
    const jobs = allJobs(rows);

    console.log(`LLM зардал — сүүлийн ${days} хоног (УБ цагаар)`);
    console.log(`Өдрийн хязгаар: $${budget.toFixed(2)} · бенчмарк хамаарахгүй\n`);

    // Толгой
    const head = ["Алхам".padEnd(26), ...rows.map((d) => d.day.slice(5).padStart(9))];
    console.log(head.join(" "));
    console.log("─".repeat(26 + rows.length * 10));

    for (const job of jobs) {
      const label = labelOf(rows, job) + (UNCAPPED_STEPS.has(job) ? " *" : "");
      const cells = rows.map((d) => {
        const s = d.steps.find((x) => x.job === job);
        return (s ? `$${s.usd.toFixed(4)}` : "—").padStart(9);
      });
      console.log(label.padEnd(26) + " " + cells.join(" "));
    }

    console.log("─".repeat(26 + rows.length * 10));
    console.log(
      "Хязгаарт тооцогдох".padEnd(26) + " " +
        rows.map((d) => `$${d.capped.toFixed(3)}`.padStart(9)).join(" "),
    );
    console.log(
      "НИЙТ".padEnd(26) + " " +
        rows.map((d) => `$${d.total.toFixed(3)}`.padStart(9)).join(" "),
    );

    if (jobs.some((j) => UNCAPPED_STEPS.has(j))) {
      console.log("\n* өдрийн хязгаарт тооцогдохгүй (өөрийн төсөвтэй)");
    }

    // Ажилласан ч $0 гэж бүртгэгдсэн LLM алхмууд
    console.log("\nЗардал бүртгэгдээгүй LLM алхмууд:");
    let found = false;
    for (const d of rows) {
      const miss = unrecorded(d.steps);
      if (miss.length === 0) continue;
      found = true;
      for (const job of miss) {
        const s = d.steps.find((x) => x.job === job)!;
        console.log(`  ⚠ ${d.day}  ${s.label} — ${s.runs} удаа ажилласан ч $0.0000`);
      }
    }
    if (!found) console.log("  ✓ алга — бүх LLM алхам зардлаа бүртгэж байна");

    const balance = await openRouterBalance();
    if (balance !== null) {
      const spent = rows.reduce((n, d) => n + d.total, 0);
      console.log(
        `\nOpenRouter үлдэгдэл: $${balance.toFixed(2)} · ` +
          `${days} хоногт бүртгэгдсэн $${spent.toFixed(3)}`,
      );
    }
    await prisma.$disconnect();
  });
}
