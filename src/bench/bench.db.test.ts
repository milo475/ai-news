import assert from "node:assert/strict";
import { test } from "node:test";
import { nextPublishAt, publishTimes } from "../jobs/mode.api";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Бодит өгөгдөлтэй хутгалдахгүй сар */
/**
 * Тест бүр ӨӨРИЙН сартай — `BenchRun.month` нь unique тул ижил түлхүүр хуваасан
 * тестүүд зэрэг ажиллахад хааяа мөргөлддөг байсан (npm test нь файлуудыг зэрэг
 * ажиллуулдаг).
 */
/**
 * НИЙТЛЭХ цонхны хамгаалалтаас хол агшин.
 *
 * `runBenchmark` нь slot-ын 45 минутын дотор шинэ хэсэг эхлүүлдэггүй тул бодит
 * цагаар ажиллуулбал тест өдрийн аль цагт ажилласнаас хамаарч хааяа унана.
 *
 * Тогтмол огноо (жишээ нь 2026-10-05) БОЛОХГҮЙ: `BenchRun.startedAt` нь бодит
 * цагаар бичигддэг тул 3 хоногийн «хуучирсан» шалгалт дээр мөргөлдөнө. Тиймээс
 * бодит цагийг авч, шаардвал цонхноос гарах хүртэл л зөөнө.
 */
function safeNow(): Date {
  let t = new Date();
  for (let i = 0; i < 8 && nextPublishAt(t, publishTimes()).minutes < 60; i++) {
    t = new Date(t.getTime() + 30 * 60_000);
  }
  return t;
}
const SAFE_NOW = safeNow();

let monthSeq = 0;
const nextMonth = () => `1999-${String((monthSeq++ % 12) + 1).padStart(2, "0")}`;

async function cleanup(month: string) {
  const { prisma } = await import("../db");
  const run = await prisma.benchRun.findUnique({ where: { month }, select: { id: true } });
  if (run) await prisma.benchRun.delete({ where: { id: run.id } });
  await prisma.jobRun.deleteMany({ where: { job: "bench", itemsIn: 0, itemsOut: 0, ok: false } });
}

test(
  "бүх модель хариу өгөхгүй бол run FAILED, дүгнэлт ч нийтлэл ч үүсэхгүй",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { planReset, resetMonth } = await import("./reset");

    const tasks = await prisma.benchTask.count({ where: { isActive: true } });
    if (tasks === 0) return; // seed:bench ажиллаагүй орчинд шалгах зүйл алга

    await cleanup(MONTH);
    try {
      const r = await runBenchmark({
        month: MONTH,
        skipBalanceCheck: true,
        now: SAFE_NOW,
        models: ["test/alpha", "test/beta"],
        taskLimit: 2,
        // 401 биш энгийн алдаа — цикл дуустал үргэлжилж, эцэст нь FAILED болох ёстой
        text: async () => { throw new Error("тестийн алдаа"); },
        writeArticle: true,
      });

      assert.equal(r.status, "FAILED");
      assert.equal(r.models, 0, "нэг ч дүгнэлт гарах ёсгүй");
      assert.equal(r.articleSlug, undefined, "нийтлэл үүсэх ёсгүй");
      assert.match(r.note ?? "", /90%-д оноо авсангүй/);

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
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);

test(
  "хариу өгөөгүй модель дүгнэлтэд орохгүй, бусад нь хэвийн",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { resetMonth } = await import("./reset");
    const { chatJson, chatText } = await import("../agent/llm");

    const tasks = await prisma.benchTask.count({ where: { isActive: true } });
    if (tasks === 0) return;

    await cleanup(MONTH);
    try {
      const text = (async (o: Parameters<typeof chatText>[0]) => {
        if (o.model === "test/beta") throw new Error("тестийн алдаа");
        return {
          text: "Монгол хэл дээрх хариулт.", tokensIn: 10, tokensOut: 20, costUsd: 0,
          latencyMs: 5, finishReason: "stop", reasoningTokens: 0,
        };
      }) as typeof chatText;

      const chat = (async () => ({
        data: { score: 8, note: "сайн" }, tokens: 0, costUsd: 0,
      })) as unknown as typeof chatJson;

      const r = await runBenchmark({
        month: MONTH,
        skipBalanceCheck: true,
        now: SAFE_NOW,
        models: ["test/alpha", "test/beta"],
        taskLimit: 2,
        text,
        chat,
        writeArticle: false,
      });

      assert.equal(r.status, "DONE");
      assert.equal(r.models, 1, "зөвхөн хариу өгсөн модель дүгнэгдэнэ");
      assert.equal(r.top[0]?.modelSlug, "test/alpha");
      assert.match(r.note ?? "", /дутуу \(нийтлэгдээгүй\): test\/beta/);

      // Нийтэд гарах дүн — зөвхөн бүрэн хэмжигдсэн модель
      const summaries = await prisma.benchModelSummary.findMany({
        where: { run: { month: MONTH }, incomplete: false },
        select: { modelSlug: true, completed: true, scored: true },
      });
      assert.deepEqual(summaries.map((s) => s.modelSlug), ["test/alpha"]);
      assert.equal(summaries[0]?.completed, 2);
      assert.equal(summaries[0]?.scored, 2);

      // Дутуу дүн нь /admin-д харагдахаар хадгалагдана, гэхдээ incomplete тэмдэгтэй
      const hidden = await prisma.benchModelSummary.findMany({
        where: { run: { month: MONTH }, incomplete: true },
        select: { modelSlug: true },
      });
      assert.deepEqual(hidden.map((s) => s.modelSlug), ["test/beta"]);

      // Унасан моделийн үр дүн нь бүртгэлд үлдэнэ (яагаад унасныг харах)
      const beta = await prisma.benchResult.count({
        where: { run: { month: MONTH }, modelSlug: "test/beta", error: { not: null } },
      });
      assert.equal(beta, 2);
    } finally {
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);

test(
  "түлхүүрийн алдаа — эхний даалгавар дээр зогсож, run FAILED болно",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { LlmAuthError, isAuthError } = await import("../agent/llm");
    const { resetMonth } = await import("./reset");

    const tasks = await prisma.benchTask.count({ where: { isActive: true } });
    if (tasks === 0) return;

    await cleanup(MONTH);
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
            skipBalanceCheck: true,
            now: SAFE_NOW,
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
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);

test(
  "хугацаа дуусахад хийсэн хэсгээ хадгалж, дараагийн run үргэлжлүүлнэ",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { resetMonth } = await import("./reset");
    const { chatJson, chatText } = await import("../agent/llm");

    if ((await prisma.benchTask.count({ where: { isActive: true } })) < 3) return;
    await cleanup(MONTH);

    /** Дуудлага бүр 1 «секунд» зарцуулдаг мэт — тестийн цаг хурдан */
    const text = (async () => ({
      text: "Монгол хэл дээрх бүрэн хариулт.", tokensIn: 10, tokensOut: 20, costUsd: 0,
      latencyMs: 5, finishReason: "stop", reasoningTokens: 0,
    })) as typeof chatText;
    const chat = (async () => ({ data: { score: 8, note: "сайн" }, tokens: 0, costUsd: 0 })) as unknown as typeof chatJson;

    try {
      // 1-р хэсэг: chunkMs = 0 → эхний хосын дараа шууд зогсоно
      const first = await runBenchmark({
        month: MONTH, skipBalanceCheck: true, now: SAFE_NOW, chunkMs: 0,
        models: ["test/alpha"], taskLimit: 3, text, chat, writeArticle: false,
      });
      assert.equal(first.status, "RUNNING", "дутуу run нь RUNNING хэвээр");
      assert.ok(first.pending > 0, `үлдсэн ${first.pending}`);
      assert.equal(first.models, 0, "дутуу үед дүгнэлт гарахгүй");

      const mid = await prisma.benchRun.findUniqueOrThrow({
        where: { month: MONTH },
        select: { id: true, status: true, _count: { select: { summaries: true, results: true } } },
      });
      assert.equal(mid.status, "RUNNING");
      assert.equal(mid._count.summaries, 0, "дутуу run дүгнэлт бичих ёсгүй");
      const afterFirst = mid._count.results;
      assert.ok(afterFirst > 0 && afterFirst < 3, `эхний хэсэгт ${afterFirst} үр дүн`);

      // 2-р хэсэг: хугацаа хангалттай → үлдсэнийг дуусгана
      const second = await runBenchmark({
        month: MONTH, skipBalanceCheck: true, now: SAFE_NOW,
        models: ["test/alpha"], taskLimit: 3, text, chat, writeArticle: false,
      });
      assert.equal(second.status, "DONE");
      assert.equal(second.pending, 0);
      assert.equal(second.results, 3, "өмнөх хэсгийн үр дүн ч дүгнэлтэд орно");
      assert.equal(second.models, 1);

      const end = await prisma.benchRun.findUniqueOrThrow({
        where: { month: MONTH },
        select: { id: true, status: true, _count: { select: { summaries: true, results: true } } },
      });
      assert.equal(end.id, mid.id, "ижил run үргэлжилсэн байх ёстой");
      assert.equal(end.status, "DONE");
      assert.equal(end._count.results, 3, "давхар үр дүн бичигдсэн байна");
      assert.equal(end._count.summaries, 1);
    } finally {
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);

test(
  "НИЙТЛЭХ цонхны өмнө шинэ хэсэг эхлүүлэхгүй",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { resetMonth } = await import("./reset");
    const { chatText } = await import("../agent/llm");
    const { publishTimes, nextPublishAt } = await import("../jobs/mode.api");

    if ((await prisma.benchTask.count({ where: { isActive: true } })) < 2) return;
    await cleanup(MONTH);

    // НИЙТЛЭХ цагаас 10 минутын өмнөх агшин
    const slot = nextPublishAt(new Date(), publishTimes()).at;
    const justBefore = new Date(slot.getTime() - 10 * 60_000);

    try {
      const r = await runBenchmark({
        month: MONTH, skipBalanceCheck: true, now: justBefore,
        models: ["test/alpha"], taskLimit: 2, writeArticle: false,
        text: (async () => { throw new Error("дуудагдах ёсгүй"); }) as typeof chatText,
      });
      assert.equal(r.status, "RUNNING");
      assert.match(r.note ?? "", /НИЙТЛЭХ цонх/);
      // Run огт үүсээгүй байх ёстой
      assert.equal(await prisma.benchRun.findUnique({ where: { month: MONTH } }), null);
    } finally {
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);

test(
  "3 хоногт дуусаагүй run FAILED болно",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { resetMonth } = await import("./reset");
    const { chatText } = await import("../agent/llm");

    if ((await prisma.benchTask.count({ where: { isActive: true } })) < 2) return;
    await cleanup(MONTH);

    try {
      await prisma.benchRun.create({
        data: {
          month: MONTH, judgeModel: "test/judge", status: "RUNNING",
          startedAt: new Date(Date.now() - 4 * 86_400_000),
        },
      });

      await assert.rejects(
        () =>
          runBenchmark({
            month: MONTH, skipBalanceCheck: true,
            models: ["test/alpha"], taskLimit: 2, writeArticle: false,
            text: (async () => { throw new Error("дуудагдах ёсгүй"); }) as typeof chatText,
          }),
        /3 хоногт дуусаагүй/,
      );

      const run = await prisma.benchRun.findUniqueOrThrow({
        where: { month: MONTH }, select: { status: true, finishedAt: true },
      });
      assert.equal(run.status, "FAILED");
      assert.ok(run.finishedAt, "үүрд RUNNING үлдэх ёсгүй");
    } finally {
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);

test(
  "зэрэг ажиллахаас хамгаална — хоёр дахь процесс алгасна",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark, benchLockName } = await import("./run");
    const { resetMonth } = await import("./reset");
    const { tryLock } = await import("../lib/lock");
    const { chatText } = await import("../agent/llm");

    if ((await prisma.benchTask.count({ where: { isActive: true } })) < 2) return;
    await cleanup(MONTH);

    // Өөр процесс аль хэдийн ажиллаж байгаа мэт
    const other = await tryLock(benchLockName(MONTH));
    assert.ok(other, "тестийн түгжээ авагдсангүй");

    try {
      const r = await runBenchmark({
        month: MONTH, skipBalanceCheck: true, now: SAFE_NOW,
        models: ["test/alpha"], taskLimit: 2, writeArticle: false,
        text: (async () => { throw new Error("дуудагдах ёсгүй"); }) as typeof chatText,
      });
      assert.equal(r.status, "RUNNING");
      assert.match(r.note ?? "", /өөр процесс ажиллаж байна/);
      // Run огт үүсээгүй байх ёстой
      assert.equal(await prisma.benchRun.findUnique({ where: { month: MONTH } }), null);
    } finally {
      await other!.release();
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);

test(
  "давхардсан үр дүнг алгасна, run FAILED болохгүй",
  { skip: !hasDb && "DATABASE_URL алга" },
  async () => {
    const MONTH = nextMonth();
    const { prisma } = await import("../db");
    const { runBenchmark } = await import("./run");
    const { resetMonth } = await import("./reset");
    const { chatJson, chatText } = await import("../agent/llm");

    const tasks = await prisma.benchTask.findMany({
      where: { isActive: true }, take: 2, select: { id: true },
    });
    if (tasks.length < 2) return;
    await cleanup(MONTH);

    const text = (async () => ({
      text: "Монгол хэл дээрх бүрэн хариулт.", tokensIn: 10, tokensOut: 20, costUsd: 0,
      latencyMs: 5, finishReason: "stop", reasoningTokens: 0,
    })) as typeof chatText;
    const chat = (async () => ({ data: { score: 8, note: "сайн" }, tokens: 0, costUsd: 0 })) as unknown as typeof chatJson;

    try {
      // Өөр процесс аль хэдийн НЭГ хосыг бичсэн мэт
      const run = await prisma.benchRun.create({
        data: { month: MONTH, judgeModel: "test/judge", status: "RUNNING" },
      });
      await prisma.benchResult.create({
        data: {
          runId: run.id, modelSlug: "test/alpha", taskId: tasks[0]!.id,
          output: "өмнөх процессын бичсэн", judgeScore: 9,
        },
      });

      const r = await runBenchmark({
        month: MONTH, skipBalanceCheck: true, now: SAFE_NOW,
        models: ["test/alpha"], taskLimit: 2, text, chat, writeArticle: false,
      });

      assert.notEqual(r.status, "FAILED", `unique зөрчил run-ыг унагаасан: ${r.note}`);
      // Давхардсан хос дахин бичигдээгүй
      const count = await prisma.benchResult.count({
        where: { runId: run.id, modelSlug: "test/alpha", taskId: tasks[0]!.id },
      });
      assert.equal(count, 1);
      // Нийт 2 даалгавар — нэг нь өмнөхөөс, нэг нь шинэ
      assert.equal(await prisma.benchResult.count({ where: { runId: run.id } }), 2);
    } finally {
      await resetMonth(MONTH, { yes: true }).catch(() => {});
      await cleanup(MONTH);
      await prisma.$disconnect();
    }
  },
);
