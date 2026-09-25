import Link from "next/link";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import { BENCH_CATEGORY_LABEL } from "@/bench/task.api";
import { finalScore } from "@/bench/judge.api";
import { monthLabel } from "@/bench/summary.api";
import { saveTaskAction, scoreResultAction, startBenchAction, toggleTaskAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Бенчмарк — админ" };

const input = "w-full rounded border border-line bg-transparent px-2 py-1 text-sm";
const btn = "rounded border border-line px-2.5 py-1 text-xs hover:bg-line/40";

export default async function AdminBenchmark({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; msg?: string; run?: string; model?: string }>;
}) {
  const sp = await searchParams;

  const [runs, tasks, job] = await Promise.all([
    prisma.benchRun.findMany({
      orderBy: { month: "desc" },
      take: 12,
      select: {
        id: true, month: true, startedAt: true, finishedAt: true, status: true, costUsd: true,
        judgeModel: true, note: true, articleId: true,
        _count: { select: { results: true, summaries: true } },
      },
    }),
    prisma.benchTask.findMany({
      orderBy: [{ category: "asc" }, { slug: "asc" }],
      select: {
        id: true, slug: true, title: true, category: true, prompt: true, reference: true,
        rubric: true, checker: true, weight: true, isActive: true, isPublic: true,
      },
    }),
    prisma.jobRun.findFirst({ where: { job: "bench" }, orderBy: { startedAt: "desc" } }),
  ]);

  const selectedRun = sp.run ? runs.find((r) => r.id === sp.run) : runs[0];
  const summaries = selectedRun
    ? await prisma.benchModelSummary.findMany({ where: { runId: selectedRun.id }, orderBy: { rank: "asc" } })
    : [];
  const results = selectedRun && sp.model
    ? await prisma.benchResult.findMany({
        where: { runId: selectedRun.id, modelSlug: sp.model },
        orderBy: { judgeScore: "asc" },
        select: {
          id: true, output: true, judgeScore: true, judgeScore2: true, judgeNotes: true,
          checkerPass: true, humanScore: true, humanNote: true, error: true, latencyMs: true,
          task: { select: { slug: true, title: true, category: true } },
        },
      })
    : [];

  const running = job && !job.finishedAt;

  return (
    <div className="space-y-5">
      {running && <meta httpEquiv="refresh" content="15" />}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Бенчмарк</h1>
        </div>
        <Link href="/benchmark" className="text-sm text-accent hover:underline">Нийтийн хуудас →</Link>
      </div>

      {sp.msg && <p className="rounded border border-line px-3 py-2 text-sm">{sp.msg}</p>}

      <section className="rounded-lg border border-line p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Хэмжилт эхлүүлэх</h2>
          <form action={startBenchAction}>
            <button className={btn} disabled={Boolean(running)}>
              {running ? "Ажиллаж байна…" : "Одоо ажиллуулах"}
            </button>
          </form>
        </div>
        <p className="text-xs text-muted">
          Энэ сарын хэмжилт ажиллана (BENCH_BUDGET_USD төсвийн дотор). Хэдэн арван минут үргэлжилнэ —
          хуудас өөрөө шинэчлэгдэнэ.
        </p>
        {job && (
          <p className="text-xs text-muted">
            Сүүлийн ажиллагаа: {fmtDate(job.startedAt)} ·{" "}
            {job.finishedAt ? (job.ok ? "дууссан" : `алдаа: ${job.error?.slice(0, 120)}`) : "ажиллаж байна"}
            {job.itemsOut > 0 && ` · ${job.itemsOut}/${job.itemsIn} үр дүн`}
            {job.logFile && (
              <>
                {" · "}
                <Link href={`/admin/logs/${job.id}`} className="text-accent hover:underline">лог</Link>
              </>
            )}
          </p>
        )}
      </section>

      {runs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Ажиллагаанууд</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className={`border-b border-line last:border-0 ${r.id === selectedRun?.id ? "bg-line/30" : ""}`}>
                    <td className="py-1.5 pr-2">
                      <Link href={`/admin/benchmark?run=${r.id}`} className="hover:text-accent">
                        {monthLabel(r.month)}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 text-xs text-muted">{r.status}</td>
                    <td className="py-1.5 px-2 text-xs text-muted tabular-nums">
                      {r._count.summaries} модель · {r._count.results} үр дүн
                    </td>
                    <td className="py-1.5 px-2 text-xs text-muted tabular-nums">${r.costUsd.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-xs text-muted">{r.judgeModel}</td>
                    <td className="py-1.5 pl-2 text-xs text-muted text-right">
                      {r.finishedAt ? fmtDate(r.finishedAt) : "…"}
                      {r.articleId && (
                        <>
                          {" · "}
                          <Link href={`/medee/${r.articleId}`} className="text-accent hover:underline">нийтлэл</Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedRun?.note && <p className="text-xs text-warn">{selectedRun.note}</p>}
        </section>
      )}

      {summaries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            {selectedRun && monthLabel(selectedRun.month)} — дүн
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-2 tabular-nums text-muted w-8">{s.rank}</td>
                    <td className="py-1.5 pr-2">
                      <Link
                        href={`/admin/benchmark?run=${selectedRun!.id}&model=${encodeURIComponent(s.modelSlug)}`}
                        className="hover:text-accent"
                      >
                        {s.modelSlug}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-medium">{s.avgScore.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-muted text-xs">
                      {(s.avgLatency / 1000).toFixed(1)}с
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-muted text-xs">
                      ${s.costPer1kMn.toFixed(3)}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-muted text-xs">{s.completed} даалгавар</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">{sp.model} — үр дүн (оноо багаас нь)</h2>
            <Link href={`/admin/benchmark?run=${selectedRun!.id}`} className="text-xs text-muted hover:text-ink">
              хаах
            </Link>
          </div>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.id} className="rounded-lg border border-line p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-sm">{r.task.title}</span>
                  <span className="text-muted">{BENCH_CATEGORY_LABEL[r.task.category]}</span>
                  <span className="tabular-nums">
                    эцсийн {finalScore(r).toFixed(1)}
                    {r.judgeScore !== null && <span className="text-muted"> (шүүгч {r.judgeScore.toFixed(1)}</span>}
                    {r.judgeScore2 !== null && <span className="text-muted">, 2-р {r.judgeScore2.toFixed(1)}</span>}
                    {r.judgeScore !== null && <span className="text-muted">)</span>}
                  </span>
                  {r.checkerPass === false && <span className="text-down">шалгалт унасан</span>}
                  {r.error && <span className="text-down">алдаа: {r.error.slice(0, 80)}</span>}
                  <span className="ml-auto text-muted tabular-nums">{(r.latencyMs / 1000).toFixed(1)}с</span>
                </div>
                {r.judgeNotes && <p className="text-xs text-muted">{r.judgeNotes}</p>}
                <details>
                  <summary className="cursor-pointer text-xs text-muted">Хариулт</summary>
                  <pre className="mt-2 text-xs whitespace-pre-wrap break-words font-mono max-h-80 overflow-y-auto">
                    {r.output || "(хоосон)"}
                  </pre>
                </details>
                <form action={scoreResultAction} className="flex flex-wrap gap-2 items-end">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="text-xs text-muted space-y-1">
                    <span>Гар оноо (0–10, хоосон = LLM-ийнх)</span>
                    <input
                      name="humanScore" defaultValue={r.humanScore ?? ""} className={`${input} w-28`}
                      inputMode="decimal" placeholder="—"
                    />
                  </label>
                  <label className="text-xs text-muted space-y-1 flex-1 min-w-48">
                    <span>Тэмдэглэл</span>
                    <input name="humanNote" defaultValue={r.humanNote ?? ""} className={input} />
                  </label>
                  <button className={btn}>Хадгалах</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Даалгаврууд <span className="text-muted font-normal">{tasks.filter((t) => t.isActive).length}/{tasks.length} идэвхтэй</span>
        </h2>
        <ul className="space-y-2">
          {tasks.map((t) => {
            const open = sp.open === t.id;
            return (
              <li key={t.id} className="rounded-lg border border-line">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span className={`text-xs rounded px-1.5 py-0.5 border ${t.isActive ? "border-up/50 text-up" : "border-line text-muted"}`}>
                    {t.isActive ? "идэвхтэй" : "идэвхгүй"}
                  </span>
                  <span className="font-medium text-sm">{t.title}</span>
                  <span className="text-xs text-muted">
                    {BENCH_CATEGORY_LABEL[t.category]} · жин {t.weight}
                    {t.isPublic && " · нээлттэй"}
                    {!t.reference && " · лавлахгүй"}
                  </span>
                  <span className="ml-auto flex gap-2">
                    <form action={toggleTaskAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className={btn}>{t.isActive ? "идэвхгүй болгох" : "идэвхжүүлэх"}</button>
                    </form>
                    <Link href={open ? "/admin/benchmark" : `/admin/benchmark?open=${t.id}`} className={btn}>
                      {open ? "хаах" : "засах"}
                    </Link>
                  </span>
                </div>

                {open && (
                  <form action={saveTaskAction} className="border-t border-line p-3 space-y-2">
                    <input type="hidden" name="id" value={t.id} />
                    <label className="block text-xs text-muted space-y-1">
                      <span>Гарчиг</span>
                      <input name="title" defaultValue={t.title} className={input} />
                    </label>
                    <label className="block text-xs text-muted space-y-1">
                      <span>Даалгавар</span>
                      <textarea name="prompt" defaultValue={t.prompt} rows={10} className={`${input} font-mono`} />
                    </label>
                    <label className="block text-xs text-muted space-y-1">
                      <span>Лавлах хариулт (шүүгчид өгнө — гараар засаж болно)</span>
                      <textarea name="reference" defaultValue={t.reference ?? ""} rows={10} className={`${input} font-mono`} />
                    </label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <label className="text-xs text-muted space-y-1">
                        <span>Шалгуур (JSON: [{"{ name, weight, hint }"}])</span>
                        <textarea name="rubric" rows={6} className={`${input} font-mono`} defaultValue={JSON.stringify(t.rubric, null, 1)} />
                      </label>
                      <label className="text-xs text-muted space-y-1">
                        <span>Тодорхой шалгалт (JSON эсвэл хоосон)</span>
                        <textarea
                          name="checker" rows={6} className={`${input} font-mono`}
                          defaultValue={t.checker ? JSON.stringify(t.checker, null, 1) : ""}
                          placeholder={'{"kind":"maxWords","limit":60}'}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-4 items-end">
                      <label className="text-xs text-muted space-y-1">
                        <span>Жин</span>
                        <input name="weight" defaultValue={t.weight} className={`${input} w-20`} inputMode="numeric" />
                      </label>
                      <label className="flex gap-2 items-center text-xs text-muted pb-1">
                        <input type="checkbox" name="isPublic" defaultChecked={t.isPublic} className="accent-accent" />
                        <span>Нийтэд нээлттэй жишээ</span>
                      </label>
                      <button className={`${btn} ml-auto`}>Хадгалах</button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
