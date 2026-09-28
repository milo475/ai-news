/**
 * Нийтлэхийн өмнөх шалгалтыг бэлэн ноорог бүр дээр УРЬДЧИЛАН харуулна.
 *
 *   npm run publish:check            # бэлэн (readyAt) ноорогууд
 *   npm run publish:check -- --all   # бүх DRAFT
 *   npm run publish:check -- --apply # зөвхөн энэ үед DB-д бичнэ (карт дахин үүсгэх, «Шинэчлэл:»)
 *
 * `--apply` -гүйгээр DB-д ЮУ Ч БИЧИХГҮЙ — зөвхөн шийдвэрийг хэвлэнэ.
 */
import "dotenv/config";
import { prisma } from "../db";
import { isEntry, runCli } from "../lib/cli";
import { gateBeforePublish } from "./prepublish";

export async function precheck(opts: { all?: boolean; apply?: boolean; limit?: number } = {}) {
  const drafts = await prisma.article.findMany({
    where: {
      kind: "NEWS", status: "DRAFT", isLocal: false,
      ...(opts.all ? {} : { readyAt: { not: null } }),
    },
    orderBy: [{ relevance: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 10,
    select: {
      id: true, slug: true, titleMn: true, fbHook: true, category: true, relevance: true,
      fbImageAt: true,
    },
  });

  console.log(`${drafts.length} ноорог${opts.apply ? " (DB-д бичнэ)" : " (зөвхөн харуулна)"}\n`);
  const decisions: { slug: string; decision: string }[] = [];

  for (const d of drafts) {
    console.log("─".repeat(76));
    console.log(`${d.slug}  [${d.category} ${d.relevance}]`);
    console.log(`  нийтлэл: ${d.titleMn}`);
    console.log(`  карт:    ${d.fbHook ?? "—"} (${d.fbImageAt?.toISOString().slice(0, 16) ?? "картгүй"})`);

    const g = await gateBeforePublish(d.id, { dryRun: !opts.apply });
    console.log(`  fidelity:  ${g.issues.length ? g.issues.map((i) => `${i.field} — ${i.rule}`).join("; ") : "цэвэр"}`);
    console.log(`  давхардал: ${g.duplicate.action} — ${g.duplicate.reason}`);

    const decision = g.ok
      ? g.prefixed
        ? "НИЙТЛЭХ · «Шинэчлэл:» угтвартай"
        : g.repaired
          ? "НИЙТЛЭХ · карт дахин үүсгэсний дараа"
          : "НИЙТЛЭХ"
      : `АЛГАСАХ — ${g.reason}`;
    console.log(`  ШИЙДВЭР:   ${decision}`);
    decisions.push({ slug: d.slug, decision });
  }

  return decisions;
}

if (isEntry("precheck.ts")) {
  await runCli(async () => {
    const d = await precheck({
      all: process.argv.includes("--all"),
      apply: process.argv.includes("--apply"),
    });
    const skip = d.filter((x) => x.decision.startsWith("АЛГАСАХ")).length;
    console.log(`\n${d.length - skip} нийтлэгдэнэ, ${skip} алгасагдана`);
  });
}
