import assert from "node:assert/strict";
import { test } from "node:test";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Бодит өгөгдөлтэй хутгалдахгүй сар */
const MONTH = "1999-01";

async function cleanup() {
  const { prisma } = await import("../db");
  const run = await prisma.benchRun.findUnique({ where: { month: MONTH }, select: { id: true } });
  if (run) await prisma.benchRun.delete({ where: { id: run.id } });
  await prisma.jobRun.deleteMany({ where: { job: "bench", itemsIn: 0, itemsOut: 0, ok: false } });
}

test(
  "бүх модель хариу өгөхгүй бол run FAILED, дүгнэлт ч нийтлэл ч үүсэхгүй",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { planReset, resetMonth } = await import("./reset");

    const tasks = await prisma.benchTask.count({ where: { isActive: true } });
    if (tasks === 0) return; // seed:bench ажиллаагүй орчинд шалгах зүйл алга

    await cleanup();
    try {
      const r = await runBenchmark({
        month: MONTH,
        models: ["test/alpha", "test/beta"],
        taskLimit: 2,
        // 401 биш энгийн алдаа — цикл дуустал үргэлжилж, эцэст нь FAILED болох ёстой
        text: async () => { throw new Error("тестийн алдаа"); },
        writeArticle: true,
      });

      assert.equal(r.status, "FAILED");
      assert.equal(r.models, 0, "нэг ч дүгнэлт гарах ёсгүй");
      assert.equal(r.articleSlug, undefined, "нийтлэл үүсэх ёсгүй");
      assert.match(r.note ?? "", /хариу өгсөнгүй/);

      const run = await prisma.benchRun.findUniqueOrThrow({
        where: { month: MONTH },
        select: { id: true, status: true, articleId: true, _count: { select: { summaries: true, results: true } } },
      });
      assert.equal(run.status, "FAILED");
      assert.equal(run.articleId, null);
      assert.equal(run._count.summaries, 0, "0/10 гэсэн хуурамч дүгнэлт бичигдсэн байна");
      assert.equal(run._count.results, 4, "2 модель × 2 даалгавар");

      // JobRun нь амжилтгүй гэж тэмдэглэгдсэн байх ёстой (cron үүнийг хардаг)
      const job = await prisma.jobRun.findFirst({
        where: { job: "bench" }, orderBy: { startedAt: "desc" },
        select: { ok: true, error: true },
      });
      assert.equal(job?.ok, false);

      // ——— bench:reset ———
      const plan = await planReset(MONTH);
      assert.equal(plan?.results, 4);
      assert.equal(plan?.summaries, 0);

      // --yes байхгүй бол устгахгүй
      const dry = await resetMonth(MONTH, {});
      assert.equal(dry.deleted, false);
      assert.ok(await prisma.benchRun.findUnique({ where: { month: MONTH } }), "урьдчилан харахад устсан байна");

      const done = await resetMonth(MONTH, { yes: true });
      assert.equal(done.deleted, true);
      assert.equal(await prisma.benchRun.findUnique({ where: { month: MONTH } }), null);
      assert.equal(await prisma.benchResult.count({ where: { runId: run.id } }), 0, "cascade ажиллаагүй");

      // Байхгүй сарыг устгахад алдаа гарахгүй
      const again = await resetMonth(MONTH, { yes: true });
      assert.equal(again.plan, null);
      await assert.rejects(() => resetMonth("хаа нэгтээ", { yes: true }), /Сар буруу/);
    } finally {
      await cleanup();
      await prisma.$disconnect();
    }
  },
);

test(
  "хариу өгөөгүй модель дүгнэлтэд орохгүй, бусад нь хэвийн",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { resetMonth } = await import("./reset");
    const { chatJson, chatText } = await import("../agent/llm");

    const tasks = await prisma.benchTask.count({ where: { isActive: true } });
    if (tasks === 0) return;

    await cleanup();
    try {
      const text = (async (o: Parameters<typeof chatText>[0]) => {
        if (o.model === "test/beta") throw new Error("тестийн алдаа");
        return { text: "Монгол хэл дээрх хариулт.", tokensIn: 10, tokensOut: 20, costUsd: 0, latencyMs: 5 };
      }) as typeof chatText;

      const chat = (async () => ({
        data: { score: 8, note: "сайн" }, tokens: 0, costUsd: 0,
      })) as unknown as typeof chatJson;

      const r = await runBenchmark({
        month: MONTH,
        models: ["test/alpha", "test/beta"],
        taskLimit: 2,
        text,
        chat,
        writeArticle: false,
      });

      assert.equal(r.status, "DONE");
      assert.equal(r.models, 1, "зөвхөн хариу өгсөн модель дүгнэгдэнэ");
      assert.equal(r.top[0]?.modelSlug, "test/alpha");
      assert.match(r.note ?? "", /хариу өгөөгүй: test\/beta/);

      const summaries = await prisma.benchModelSummary.findMany({
        where: { run: { month: MONTH } },
        select: { modelSlug: true, completed: true },
      });
      assert.deepEqual(summaries.map((s) => s.modelSlug), ["test/alpha"]);
      assert.equal(summaries[0]?.completed, 2);

      // Унасан моделийн үр дүн нь бүртгэлд үлдэнэ (яагаад унасныг харах)
      const beta = await prisma.benchResult.count({
        where: { run: { month: MONTH }, modelSlug: "test/beta", error: { not: null } },
      });
      assert.equal(beta, 2);
    } finally {
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup();
      await prisma.$disconnect();
    }
  },
);

test(
  "түлхүүрийн алдаа — эхний даалгавар дээр зогсож, run FAILED болно",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { LlmAuthError, isAuthError } = await import("../agent/llm");
    const { resetMonth } = await import("./reset");

    const tasks = await prisma.benchTask.count({ where: { isActive: true } });
    if (tasks === 0) return;

    await cleanup();
    try {
      let calls = 0;
      const text = (async () => {
        calls++;
        throw new LlmAuthError(401, "no auth credentials found");
      }) as never;

      await assert.rejects(
        () =>
          runBenchmark({
            month: MONTH,
            models: ["test/alpha", "test/beta"],
            taskLimit: 3,
            text,
            writeArticle: false,
          }),
        (e) => isAuthError(e),
      );

      assert.equal(calls, 1, "эхний алдааны дараа үргэлжлэх ёсгүй (2 × 3 = 6 биш)");

      const run = await prisma.benchRun.findUniqueOrThrow({
        where: { month: MONTH },
        select: { status: true, note: true, _count: { select: { summaries: true } } },
      });
      assert.equal(run.status, "FAILED", "RUNNING төлөвт үүрд үлдэх ёсгүй");
      assert.equal(run._count.summaries, 0);
      assert.match(run.note ?? "", /401/);
    } finally {
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup();
      await prisma.$disconnect();
    }
  },
);
