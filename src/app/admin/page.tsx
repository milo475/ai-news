import Link from "next/link";
import { studioStats } from "@/studio/stats";
import { studioWindows } from "@/studio/funnel";
import { balanceMessage, levelOf, openRouterBalance, openRouterUsage } from "@/lib/balance";
import { drift, driftMessage } from "@/lib/spend.api";
import { recentCosts } from "@/admin/cost";
import {
  dailyLlmBudget, isLocalDb, limitMessage, UNCAPPED_STEPS, unrecorded, USAGE_LABEL,
} from "@/admin/cost.api";
import { prisma } from "@/db";
import { CATEGORY_LABEL } from "@/agent/category";
import { humanDelay, nextPublishAt, publishTimes, timeLabel } from "@/jobs/mode.api";
import { publishedToday } from "@/agent/quota";
import { dailyPublishLimit } from "@/agent/quota.api";
import { fmtDate } from "@/components/format";
import { MAX_ATTEMPTS, postsPerRun } from "@/publish/facebook.api";
import { igUserId, MAX_IG_ATTEMPTS } from "@/publish/instagram.api";
import { emptySearches, topSearches } from "@/queries/search-stats";
import { dashboard } from "@/admin/dashboard";
import { Dashboard } from "./Dashboard";
import {
  postArticleToFacebookFromList, postArticleToInstagramFromList, publishArticle, rejectArticle, runJob,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Админ" };

const TABS = ["DRAFT", "RAW", "PUBLISHED", "REJECTED", "SKIPPED"] as const;
type Status = (typeof TABS)[number];

const JOBS = ["pipeline", "rss", "agent", "improve", "publish", "openrouter", "arena", "digest", "insights"] as const;

const RUN_BUTTONS = [
  { job: "rss", label: "Мэдээ татах" },
  { job: "agent", label: "Агент бичүүлэх" },
  { job: "improve", label: "Нийтлэл бэлдэх" },
  { job: "publish", label: "Одоо нийтлэх" },
  { job: "arena", label: "Arena татах" },
  { job: "digest", label: "Digest бичүүлэх" },
  { job: "insights", label: "Хүрэлт татах" },
  { job: "pipeline", label: "Бүгд" },
] as const;

function hhmm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** Оролдсоны талаас илүү нь унасан бол — дууссан ч анхаарал хэрэгтэй */
function mostlyFailed(run: { attempted: number; failed: number }): boolean {
  return run.attempted > 0 && run.failed * 2 > run.attempted;
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const status: Status = TABS.includes(sp.status as Status) ? (sp.status as Status) : "DRAFT";

  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL?.trim().replace(/\/+$/, "") || null;

  const [board, counts, jobs, articles, searches, empties, todayCount, fbQueue, readyCount, studio, balance, costs, usage, funnels] = await Promise.all([
    dashboard(),
    prisma.article.groupBy({ by: ["status"], _count: true }),
    Promise.all(
      JOBS.map((job) =>
        prisma.jobRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" } }).then((r) => ({ job, run: r })),
      ),
    ),
    prisma.article.findMany({
      where: { status },
      orderBy: status === "PUBLISHED" ? { publishedAt: "desc" } : { createdAt: "desc" },
      take: 100,
      select: {
        id: true, titleMn: true, sourceTitle: true, relevance: true, createdAt: true, category: true,
        publishedAtSource: true, sourceText: true, reviewedBy: true, source: { select: { name: true } },
        fbPostId: true, fbPostedAt: true, fbAttempts: true, fbError: true,
        fbImageUrl: true, igPostedAt: true, igMediaId: true, igAttempts: true, igError: true,
        fbReach: true, fbLikes: true, fbShares: true, fbComments: true, fbStatsAt: true,
        igReach: true, igLikes: true, igComments: true, fbHookType: true,
      },
    }),
    topSearches(),
    emptySearches(),
    publishedToday(),
    prisma.article.count({
      where: {
        status: "PUBLISHED", fbPostedAt: null, fbPostId: null, fbAttempts: { lt: MAX_ATTEMPTS },
      },
    }),
    prisma.article.count({ where: { status: "DRAFT", readyAt: { not: null } } }),
    studioStats(),
    openRouterBalance(),
    recentCosts(2),
    openRouterUsage(),
    studioWindows(),
  ]);
  const next = nextPublishAt(new Date(), publishTimes());
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const anyRunning = jobs.some(({ run }) => run && !run.finishedAt);
  const dailyLimit = dailyPublishLimit();
  const igOn = igUserId() !== null;

  return (
    <div className="space-y-6">
      {/* Ажиллаж байгаа зүйл байвал л шинэчилнэ */}
      {anyRunning && <meta httpEquiv="refresh" content="10" />}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Админ</h1>
        <span className="flex gap-4">
          <Link href="/admin/hereglee" className="text-sm text-accent hover:underline">Хэрэглээний жагсаалт →</Link>
          <Link href="/admin/newsletter" className="text-sm text-accent hover:underline">Newsletter →</Link>
          <Link href="/admin/zaavar" className="text-sm text-accent hover:underline">Заавар →</Link>
          <Link href="/admin/prompt" className="text-sm text-accent hover:underline">Prompt →</Link>
          <Link href="/admin/benchmark" className="text-sm text-accent hover:underline">Бенчмарк →</Link>
          <Link href="/admin/hereglel" className="text-sm text-accent hover:underline">Хэрэгсэл →</Link>
          <Link href="/admin/mongol" className="text-sm text-accent hover:underline">Монгол →</Link>
          <Link href="/admin/songolt" className="text-sm text-accent hover:underline">Асуулга →</Link>
          <Link href="/admin/hereglegch" className="text-sm text-accent hover:underline">Хэрэглэгчид →</Link>
          <Link href="/admin/tarhalt" className="text-sm text-accent hover:underline">Тархалт →</Link>
          <Link href="/admin/aldaa" className="text-sm text-accent hover:underline">Алдаа →</Link>
          {umamiUrl && (
            <a
              href={umamiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline"
            >
              Аналитик →
            </a>
          )}
        </span>
      </div>

      <BalanceBanner balance={balance} />
      <CostBreakdown days={costs} usage={usage} />

      <Dashboard d={board} dailyLimit={dailyLimit} igOn={igOn} />

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {TABS.map((s) => (
          <div key={s} className="rounded-lg border border-line p-3">
            <p className="text-xs text-muted">{s}</p>
            <p className="text-2xl font-semibold tabular-nums">{countOf(s)}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-line p-3">
          <p className="text-xs text-muted">Дараагийн нийтлэх (УБ)</p>
          <p className="text-2xl font-semibold tabular-nums">
            {timeLabel(next.time)} <span className="text-muted text-base">({humanDelay(next.minutes)})</span>
          </p>
          <p className="text-xs text-muted">
            {publishTimes().map(timeLabel).join(" · ")} — бэлэн {readyCount} нийтлэл
          </p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-xs text-muted">Өнөөдөр нийтэлсэн (УБ цагаар)</p>
          <p className="text-2xl font-semibold tabular-nums">
            {todayCount}
            <span className="text-muted">/{dailyLimit}</span>
          </p>
          {todayCount >= dailyLimit && dailyLimit > 0 && (
            <p className="text-xs text-muted">квот дүүрсэн — өнөөдөр нэмж нийтлэхгүй</p>
          )}
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-xs text-muted">FB дараалалд</p>
          <p className="text-2xl font-semibold tabular-nums">{fbQueue}</p>
          <p className="text-xs text-muted">slot бүрт {postsPerRun()} пост</p>
        </div>
      </section>

      <StudioPanel s={studio} />
      <StudioFunnel windows={funnels} />

      <section className="rounded-lg border border-line p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {RUN_BUTTONS.map((b) => (
            <form key={b.job} action={runJob}>
              <input type="hidden" name="job" value={b.job} />
              <button className="rounded border border-line px-3 py-1.5 text-sm hover:bg-line/40">
                {b.label}
              </button>
            </form>
          ))}
          {sp.msg && <span className="text-xs text-muted">{sp.msg}</span>}
        </div>

        <div className="space-y-1 text-sm">
          {jobs.map(({ job, run }) => (
            <p key={job} className="flex flex-wrap items-baseline gap-2">
              <span className="text-muted w-24 shrink-0">
                {job}
                {run?.mode && <span className="ml-1 text-[10px] uppercase opacity-60">{run.mode}</span>}
              </span>
              {!run ? (
                <span className="text-muted">ажиллаагүй</span>
              ) : !run.finishedAt ? (
                <span className="text-accent">● ажиллаж байна… ({hhmm(run.startedAt)}-д эхэлсэн)</span>
              ) : run.ok && mostlyFailed(run) ? (
                <span className="text-warn" title={`${run.failed} / ${run.attempted} нэгж унасан`}>
                  ⚠ дууссан {hhmm(run.finishedAt)} · {run.itemsIn} → {run.itemsOut} · {run.failed}/
                  {run.attempted} унасан
                </span>
              ) : run.ok ? (
                <span className="text-up">
                  ✓ дууссан {hhmm(run.finishedAt)} · {run.itemsIn} → {run.itemsOut}
                </span>
              ) : (
                <span className="text-down" title={run.error ?? ""}>
                  ✗ {(run.error ?? "алдаа").slice(0, 120)}
                </span>
              )}
              {run?.logFile && (
                <Link href={`/admin/logs/${run.id}`} className="text-xs text-accent hover:underline">
                  лог
                </Link>
              )}
            </p>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SearchStats
          title="Сүүлийн 7 хоногийн топ 20 хайлт"
          rows={searches}
          empty="Хайлт бүртгэгдээгүй байна."
        />
        <SearchStats
          title="Үр дүнгүй хайлтууд (7 хоног)"
          rows={empties}
          empty="Бүх хайлт үр дүнтэй байлаа."
          hint="Эдгээр үгээр контент алга — нийтлэл, хэрэгсэл нэмэх боломж."
        />
      </section>

      <nav className="flex gap-4 text-sm border-b border-line">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            className={`pb-2 -mb-px border-b-2 ${s === status ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {s} <span className="tabular-nums">{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      {articles.length === 0 ? (
        <p className="text-sm text-muted">Энэ төлөвт нийтлэл алга.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted border-b border-line">
              <tr>
                <th className="text-left px-3 py-2">Гарчиг</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Эх сурвалж</th>
                <th className="text-right px-3 py-2 w-16">Оноо</th>
                <th className="text-center px-3 py-2 w-14">Текст</th>
                <th className="text-left px-3 py-2 w-28 hidden md:table-cell">Нийтлэгдсэн</th>
                <th className="text-left px-3 py-2 w-28 hidden md:table-cell">Татсан</th>
                {status === "PUBLISHED" && <th className="text-left px-3 py-2 w-56">Facebook</th>}
                {status === "PUBLISHED" && igOn && <th className="text-left px-3 py-2 w-48">Instagram</th>}
                {status === "DRAFT" && <th className="text-right px-3 py-2 w-44">Үйлдэл</th>}
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 hover:bg-line/30">
                  <td className="px-3 py-2">
                    <Link href={`/admin/${a.id}`} className="font-medium hover:text-accent">
                      {a.titleMn ?? a.sourceTitle}
                    </Link>
                    <span className="ml-2 text-xs rounded px-1.5 py-0.5 border border-line text-muted">
                      {CATEGORY_LABEL[a.category]}
                    </span>
                    {a.reviewedBy === "auto" && (
                      <span className="ml-2 text-xs rounded px-1.5 py-0.5 border border-accent/50 text-accent">
                        авто
                      </span>
                    )}
                    {a.titleMn && <span className="block text-xs text-muted">{a.sourceTitle}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted hidden sm:table-cell">{a.source.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.relevance || "—"}</td>
                  <td className="px-3 py-2 text-center" title={a.sourceText ? "бүтэн текст байгаа" : "зөвхөн хураангуй"}>
                    {a.sourceText ? <span className="text-up">●</span> : <span className="text-muted">○</span>}
                  </td>
                  <td className="px-3 py-2 text-muted tabular-nums hidden md:table-cell">{fmtDate(a.publishedAtSource)}</td>
                  <td className="px-3 py-2 text-muted tabular-nums hidden md:table-cell">{fmtDate(a.createdAt)}</td>
                  {status === "PUBLISHED" && (
                    <td className="px-3 py-2">
                      <FbCell article={a} />
                    </td>
                  )}
                  {status === "PUBLISHED" && igOn && (
                    <td className="px-3 py-2">
                      <IgCell article={a} />
                    </td>
                  )}
                  {status === "DRAFT" && (
                    <td className="px-3 py-2">
                      <div className="flex gap-2 justify-end">
                        <form action={publishArticle}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="text-xs rounded border border-up/50 text-up px-2 py-1 hover:bg-up/10">
                            Нийтлэх
                          </button>
                        </form>
                        <form action={rejectArticle}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="text-xs rounded border border-line text-muted px-2 py-1 hover:bg-line/40">
                            Хаях
                          </button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Нэг нийтлэлийн Facebook төлөв + гараар постлох товч */
function FbCell({
  article,
}: {
  article: {
    id: string; fbPostId: string | null; fbPostedAt: Date | null; fbAttempts: number;
    fbError: string | null;
    fbReach?: number; fbLikes?: number; fbShares?: number; fbComments?: number;
    fbStatsAt?: Date | null;
  };
}) {
  if (article.fbPostedAt || article.fbPostId) {
    const engagement = (article.fbLikes ?? 0) + (article.fbShares ?? 0) + (article.fbComments ?? 0);
    return (
      <span className="text-xs text-up">
        ✓ {article.fbPostedAt ? fmtDate(article.fbPostedAt) : "постлосон"}
        {article.fbPostId && (
          <a
            href={`https://facebook.com/${article.fbPostId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-accent hover:underline"
          >
            пост →
          </a>
        )}
        {/* Хүрэлтийг постлосноос 24 цагийн дараа татдаг (insights алхам) */}
        {article.fbStatsAt ? (
          <span className="ml-2 tabular-nums text-muted" title="хүрэлт · reaction/хуваалцалт/коммент">
            {article.fbReach ?? 0} хүн · {engagement}
          </span>
        ) : (
          <span className="ml-2 text-muted">хүрэлт хүлээгдэж байна</span>
        )}
      </span>
    );
  }

  const stuck = article.fbAttempts >= MAX_ATTEMPTS;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs ${stuck ? "text-down" : "text-muted"}`} title={article.fbError ?? ""}>
        {stuck ? `✗ ${MAX_ATTEMPTS} удаа алдаа` : "хүлээгдэж байна"}
        {!stuck && article.fbAttempts > 0 && ` (${article.fbAttempts} алдаа)`}
      </span>
      <form action={postArticleToFacebookFromList}>
        <input type="hidden" name="id" value={article.id} />
        <button className="text-xs rounded border border-accent/50 text-accent px-2 py-1 hover:bg-accent/10">
          Одоо FB-д постлох
        </button>
      </form>
    </div>
  );
}

/** Нэг нийтлэлийн Instagram төлөв + гараар постлох товч */
function IgCell({
  article,
}: {
  article: {
    id: string; igMediaId: string | null; igPostedAt: Date | null; igAttempts: number;
    igReach?: number; igLikes?: number; igComments?: number;
    igError: string | null; fbImageUrl: string | null;
  };
}) {
  if (article.igPostedAt || article.igMediaId) {
    return (
      <span className="text-xs text-up">
        ✓ {article.igPostedAt ? fmtDate(article.igPostedAt) : "постлосон"}
        {(article.igReach ?? 0) > 0 && (
          <span className="ml-2 tabular-nums text-muted">
            {article.igReach} хүн · {(article.igLikes ?? 0) + (article.igComments ?? 0)}
          </span>
        )}
      </span>
    );
  }
  if (!article.fbImageUrl) return <span className="text-xs text-muted">зураггүй</span>;

  const stuck = article.igAttempts >= MAX_IG_ATTEMPTS;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs ${stuck ? "text-down" : "text-muted"}`} title={article.igError ?? ""}>
        {stuck ? `✗ ${MAX_IG_ATTEMPTS} удаа алдаа` : "хүлээгдэж байна"}
        {!stuck && article.igAttempts > 0 && ` (${article.igAttempts})`}
      </span>
      <form action={postArticleToInstagramFromList}>
        <input type="hidden" name="id" value={article.id} />
        <button className="text-xs rounded border border-accent/50 text-accent px-2 py-1 hover:bg-accent/10">
          IG-д постлох
        </button>
      </form>
    </div>
  );
}

/** Хайлтын үгсийн жижиг хүснэгт — DB-ээс шууд, Umami-гаас хамааралгүй */
function SearchStats({
  title,
  rows,
  empty,
  hint,
}: {
  title: string;
  rows: { q: string; count: number; lastAt: Date }[];
  empty: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line p-4 space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.q} className="border-b border-line last:border-0">
                <td className="py-1 pr-2 break-all">
                  <Link href={`/hailt?q=${encodeURIComponent(r.q)}`} className="hover:text-accent">
                    {r.q}
                  </Link>
                </td>
                <td className="py-1 text-right tabular-nums w-12">{r.count}</td>
                <td className="py-1 text-right tabular-nums text-muted w-24 hidden sm:table-cell">
                  {fmtDate(r.lastAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Промпт студийн өдрийн хэрэглээ ба чанар */
function StudioPanel({ s }: { s: Awaited<ReturnType<typeof studioStats>> }) {
  const over = s.spentToday >= s.budget;
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-lg border border-line p-3">
        <p className="text-xs text-muted">Студи — өнөөдөр</p>
        <p className="text-2xl font-semibold tabular-nums">{s.countToday}</p>
        <p className="text-xs text-muted">7 хоногт {s.week}</p>
      </div>
      <div className={`rounded-lg border p-3 ${over ? "border-warn/60" : "border-line"}`}>
        <p className="text-xs text-muted">Өнөөдрийн зардал</p>
        <p className="text-2xl font-semibold tabular-nums">
          ${s.spentToday.toFixed(3)}
          <span className="text-muted text-base">/{s.budget.toFixed(2)}</span>
        </p>
        <p className="text-xs text-muted">{over ? "төсөв дүүрсэн — студи хаалттай" : `нэг бүтээл $${s.avgCost.toFixed(4)}`}</p>
      </div>
      <div className="rounded-lg border border-line p-3">
        <p className="text-xs text-muted">👍 (7 хоног)</p>
        <p className="text-2xl font-semibold tabular-nums">
          {s.thumbsUpPct === null ? "—" : `${s.thumbsUpPct}%`}
        </p>
        <p className="text-xs text-muted">{s.rated} үнэлгээ</p>
      </div>
      <div className="rounded-lg border border-line p-3">
        <p className="text-xs text-muted">Татгалзсан (7 хоног)</p>
        <p className="text-2xl font-semibold tabular-nums">{s.rejected}</p>
        <p className="text-xs text-muted">{s.revisions} засвар</p>
      </div>

      <div className={`rounded-lg border p-3 ${s.p90 > 45 ? "border-warn/60" : "border-line"}`}>
        <p className="text-xs text-muted">Гаргалтын хугацаа</p>
        <p className="text-2xl font-semibold tabular-nums">
          {s.p50}с <span className="text-base text-muted">p50</span>
        </p>
        <p className="text-xs text-muted">
          p90 {s.p90}с (зорилт 45с){s.overTarget ? ` · ${s.overTarget} удаа 30с давсан` : ""}
        </p>
      </div>

      <div className={`rounded-lg border p-3 ${s.staleDocs > 0 ? "border-warn/60" : "border-line"}`}>
        <p className="text-xs text-muted">Мэдлэгийн сан</p>
        <p className="text-2xl font-semibold tabular-nums">
          {s.staleDocs === 0 ? "шинэ" : `⚠ ${s.staleDocs}`}
        </p>
        <p className="text-xs text-muted">
          {s.staleDocs === 0 ? "60 хоногийн дотор шалгасан" : "файл хуучирсан — npm run studio:kb-check"}
        </p>
      </div>

      <div className={`rounded-lg border p-3 ${s.stripped > 0 ? "border-warn/60" : "border-line"}`}>
        <p className="text-xs text-muted">Зохиомол тоо (7 хоног)</p>
        <p className="text-2xl font-semibold tabular-nums">{s.stripped}</p>
        <p className="text-xs text-muted">лавлахад байхгүй тул хасагдсан</p>
      </div>
    </section>
  );
}

/** OpenRouter-ийн үлдэгдэл бага үед улаан баннер — цэнэглэхгүй бол pipeline зогсоно */
function BalanceBanner({ balance }: { balance: number | null }) {
  const message = balanceMessage(balance);
  if (!message) return null;
  const halted = levelOf(balance) === "halt";
  return (
    <a
      href="https://openrouter.ai/settings/credits"
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border p-3 text-sm ${
        halted ? "border-down bg-down/10 text-down" : "border-warn bg-warn/10 text-warn"
      }`}
    >
      ⚠ {message} <span className="underline">Цэнэглэх →</span>
    </a>
  );
}

/** Өдрийн LLM зардал алхам бүрээр — хаана мөнгө явж байгааг харах */
function CostBreakdown({
  days, usage,
}: {
  days: Awaited<ReturnType<typeof recentCosts>>;
  usage: Awaited<ReturnType<typeof openRouterUsage>>;
}) {
  const budget = dailyLlmBudget();
  const today = days[0];
  if (!today) return null;
  // Бенчмарк нь сард нэг удаа ~$4 зарцуулдаг тул өдрийн хязгаарт ОРОХГҮЙ
  const warn = limitMessage(today.capped, budget);
  const missing = unrecorded(today.steps);

  return (
    <section className="rounded-lg border border-line p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Өдрийн LLM зардал</h2>
        <span className={`text-sm tabular-nums ${warn ? "text-warn" : "text-muted"}`}>
          ${today.capped.toFixed(3)} / ${budget.toFixed(2)}
          {today.total !== today.capped && (
            <span className="text-muted"> · нийт ${today.total.toFixed(3)}</span>
          )}
        </span>
      </div>
      {warn && <p className="text-xs text-warn">{warn}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 pr-3 font-normal">Алхам</th>
              {days.map((d) => (
                <th key={d.day} className="py-1 pr-3 text-right font-normal tabular-nums">{d.day.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {today.steps.map((s) => (
              <tr key={s.job} className="border-t border-line">
                <td className="py-1.5 pr-3">
                  {s.label}
                  {!s.llm && <span className="ml-1 text-xs text-muted">(LLM-гүй)</span>}
                  {UNCAPPED_STEPS.has(s.job) && (
                    <span className="ml-1 text-xs text-muted">(хязгаараас чөлөөтэй)</span>
                  )}
                </td>
                {days.map((d) => {
                  const row = d.steps.find((x) => x.job === s.job);
                  return (
                    <td key={d.day} className="py-1.5 pr-3 text-right tabular-nums">
                      {row ? `$${row.usd.toFixed(4)}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-1.5 pr-3 text-muted">Хязгаарт тооцогдох</td>
              {days.map((d) => (
                <td key={d.day} className="py-1.5 pr-3 text-right tabular-nums text-muted">
                  ${d.capped.toFixed(3)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line font-medium">
              <td className="py-1.5 pr-3">Нийт</td>
              {days.map((d) => (
                <td key={d.day} className="py-1.5 pr-3 text-right tabular-nums">${d.total.toFixed(3)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {missing.length > 0 && (
        <p className="text-xs text-warn">
          ⚠ Зардал бүртгэгдээгүй алхам: {missing.join(", ")} — LLM дуудсан ч $0 гэж бичигдсэн байна.
        </p>
      )}

      {usage && <DriftNote recorded={today.utcTotal} actual={usage.daily} />}
    </section>
  );
}

/** Бүртгэгдсэн ба OpenRouter-ийн бодит зарцуулалтын зөрүү */
function DriftNote({ recorded, actual }: { recorded: number; actual: number }) {
  // Локал DB нь production-ийн ажлуудыг агуулдаггүй — зөрүү ямагт 100% гарна
  if (isLocalDb()) {
    return <p className="text-xs text-muted">⊘ локал DB — OpenRouter-тэй харьцуулалт хийгдэхгүй</p>;
  }
  const d = drift(recorded, actual);
  if (!d) return null;
  const msg = driftMessage(d);
  return (
    <p className={`text-xs ${msg ? "text-warn" : "text-muted"}`}>
      {msg
        ? `${msg} (${USAGE_LABEL.daily})`
        : `✓ ${USAGE_LABEL.daily} бодит $${d.actual.toFixed(3)} — зөрүү ${Math.round(d.ratio * 100)}%`}
    </p>
  );
}

/** Студийн юүлүүр — 7 ба 30 хоног. IP, хүсэлтийн текст ЭНД ГАРАХГҮЙ. */
function StudioFunnel({ windows }: { windows: Awaited<ReturnType<typeof studioWindows>> }) {
  const [w7, w30] = windows;
  if (!w7 || !w30) return null;
  if (w30.funnel.sessions === 0) {
    return (
      <section className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
        Студи — 30 хоногт сесс алга. Мэргэжлийн хуудас, «Долоо хоногийн промпт» пост нь эхний
        хэрэглэгчдийг авчрах ёстой.
      </section>
    );
  }

  const rows: [string, string, string][] = [
    ["Сесс", `${w7.funnel.sessions}`, `${w30.funnel.sessions}`],
    ["Сесс/өдөр", `${w7.funnel.perDay}`, `${w30.funnel.perDay}`],
    ["Дуусгалт", `${w7.funnel.completedPct}%`, `${w30.funnel.completedPct}%`],
    ["Хуулсан", `${w7.funnel.copiedPct}%`, `${w30.funnel.copiedPct}%`],
    ["Засвар ашигласан", `${w7.funnel.revisedPct}%`, `${w30.funnel.revisedPct}%`],
    ["Гаргалт p50 / p90", `${w7.funnel.p50}с / ${w7.funnel.p90}с`, `${w30.funnel.p50}с / ${w30.funnel.p90}с`],
    ["Сесс тутмын зардал", `$${w7.funnel.costPerSession.toFixed(4)}`, `$${w30.funnel.costPerSession.toFixed(4)}`],
  ];

  return (
    <section className="rounded-lg border border-line p-4 space-y-4">
      <h2 className="text-sm font-medium">Студи — хэрэглээ</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 pr-3 font-normal">Үзүүлэлт</th>
              <th className="py-1 pr-3 text-right font-normal">7 хоног</th>
              <th className="py-1 text-right font-normal">30 хоног</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b]) => (
              <tr key={label} className="border-t border-line">
                <td className="py-1.5 pr-3">{label}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{a}</td>
                <td className="py-1.5 text-right tabular-nums">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <BucketList title="Эх сурвалж (30 хоног)" items={w30.sources} />
        <BucketList title="Мэргэжил (топ 10)" items={w30.personas} empty="хуудсаар ирээгүй" />
        <BucketList title="Хэрэгсэл (топ 10)" items={w30.tools} />
      </div>
    </section>
  );
}

function BucketList({
  title, items, empty = "алга",
}: {
  title: string;
  items: { key: string; count: number; completedPct: number }[];
  empty?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {items.map((b) => (
            <li key={b.key} className="flex justify-between gap-2">
              <span className="truncate">{b.key}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {b.count} · {b.completedPct}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
