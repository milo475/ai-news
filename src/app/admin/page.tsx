import Link from "next/link";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import { publishArticle, rejectArticle } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Админ" };

const TABS = ["DRAFT", "RAW", "PUBLISHED", "REJECTED"] as const;
type Status = (typeof TABS)[number];

const JOBS = ["openrouter", "rss", "agent"] as const;

export default async function Admin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const asked = (await searchParams).status;
  const status: Status = TABS.includes(asked as Status) ? (asked as Status) : "DRAFT";

  const [counts, jobs, articles] = await Promise.all([
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
        id: true, titleMn: true, sourceTitle: true, relevance: true, createdAt: true,
        publishedAtSource: true, sourceText: true, source: { select: { name: true } },
      },
    }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Админ</h1>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TABS.map((s) => (
          <div key={s} className="rounded-lg border border-line p-3">
            <p className="text-xs text-muted">{s}</p>
            <p className="text-2xl font-semibold tabular-nums">{countOf(s)}</p>
          </div>
        ))}
      </section>

      <section className="grid sm:grid-cols-3 gap-3 text-sm">
        {jobs.map(({ job, run }) => (
          <div key={job} className="rounded-lg border border-line p-3 space-y-1">
            <p className="text-xs text-muted">{job}</p>
            {run ? (
              <>
                <p className="tabular-nums">{run.startedAt.toISOString().slice(0, 16).replace("T", " ")}</p>
                <p className={run.ok === false ? "text-down" : run.ok ? "text-up" : "text-muted"}>
                  {run.ok === false ? "алдаа" : run.ok ? `ok · ${run.itemsIn} → ${run.itemsOut}` : "явцад"}
                </p>
                {run.error && <p className="text-xs text-down break-words">{run.error.slice(0, 160)}</p>}
              </>
            ) : (
              <p className="text-muted">ажиллаагүй</p>
            )}
          </div>
        ))}
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
                    {a.titleMn && <span className="block text-xs text-muted">{a.sourceTitle}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted hidden sm:table-cell">{a.source.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.relevance || "—"}</td>
                  <td className="px-3 py-2 text-center" title={a.sourceText ? "бүтэн текст байгаа" : "зөвхөн хураангуй"}>
                    {a.sourceText ? <span className="text-up">●</span> : <span className="text-muted">○</span>}
                  </td>
                  <td className="px-3 py-2 text-muted tabular-nums hidden md:table-cell">{fmtDate(a.publishedAtSource)}</td>
                  <td className="px-3 py-2 text-muted tabular-nums hidden md:table-cell">{fmtDate(a.createdAt)}</td>
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
