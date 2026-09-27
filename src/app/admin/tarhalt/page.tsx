import Link from "next/link";
import { CATEGORY_LABEL } from "@/agent/category";
import { weeklyReport } from "@/publish/insights";
import { vsOverall, type GroupStats } from "@/publish/insights.api";
import { prisma } from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Тархалт — админ" };

const DAYS = [7, 14, 30];

/** Hook загварын монгол нэр */
const HOOK_LABEL: Record<string, string> = {
  number: "тоо",
  question: "асуулт",
  contrast: "эсрэгцүүлэл",
  local: "монголд хамаатай",
  forecast: "ирээдүй",
  plain: "энгийн",
};

function Table({
  title,
  rows,
  overall,
  label,
  empty,
}: {
  title: string;
  rows: GroupStats[];
  overall: GroupStats;
  label: (key: string) => string;
  empty: string;
}) {
  return (
    <section className="rounded-lg border border-line p-4 space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted border-b border-line">
              <th className="py-1.5 text-left font-normal">Төрөл</th>
              <th className="py-1.5 text-right font-normal">Пост</th>
              <th className="py-1.5 text-right font-normal">FB хүрэлт</th>
              <th className="py-1.5 text-right font-normal">vs дундаж</th>
              <th className="py-1.5 text-right font-normal">Хариу</th>
              <th className="py-1.5 text-right font-normal">Хариу/хүрэлт</th>
              <th className="py-1.5 text-right font-normal">IG хүрэлт</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g, i) => {
              const delta = vsOverall(g, overall);
              return (
                <tr key={g.key} className="border-b border-line/50">
                  <td className="py-1.5">
                    {i === 0 && rows.length > 1 && <span className="text-up mr-1">★</span>}
                    {label(g.key)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{g.posts}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{g.avgReach}</td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${
                      delta?.startsWith("+") ? "text-up" : delta?.startsWith("-") ? "text-down" : "text-muted"
                    }`}
                  >
                    {delta ?? "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{g.avgEngagement}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">
                    {g.engagementRate === null ? "—" : `${g.engagementRate}%`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{g.avgIgReach}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function AdminTarhalt({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const raw = Number((await searchParams).days);
  const days = DAYS.includes(raw) ? raw : 7;

  const [report, lastSync] = await Promise.all([
    weeklyReport({ days }),
    prisma.jobRun.findFirst({
      where: { job: "insights" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, ok: true, itemsOut: true },
    }),
  ]);

  const hasReach = report.overall.avgReach > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Тархалт</h1>
        </div>
        <span className="flex gap-2">
          {DAYS.map((d) => (
            <Link
              key={d}
              href={`/admin/tarhalt?days=${d}`}
              className={`text-sm rounded px-2.5 py-1 ${
                d === days ? "bg-accent text-white" : "text-muted hover:bg-line/40 hover:text-ink"
              }`}
            >
              {d} хоног
            </Link>
          ))}
        </span>
      </div>

      <p className="text-sm text-muted">
        {report.posts} пост · дундаж FB хүрэлт{" "}
        <span className="font-medium text-ink tabular-nums">{report.overall.avgReach}</span> · хариу{" "}
        <span className="font-medium text-ink tabular-nums">{report.overall.avgEngagement}</span>
        {report.overall.engagementRate !== null && ` (${report.overall.engagementRate}%)`}
        {lastSync && (
          <>
            {" · "}хүрэлт сүүлд татсан:{" "}
            {new Date(lastSync.startedAt.getTime() + 8 * 3_600_000).toISOString().replace("T", " ").slice(0, 16)}
            {!lastSync.ok && <span className="text-down"> (унасан)</span>}
          </>
        )}
      </p>

      {!hasReach && (
        <div className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
          Хүрэлтийн тоо хараахан алга. Хүрэлтийг постлосноос <b>24 цагийн дараа</b> татдаг
          (pipeline-ийн <code>insights</code> алхам). Гараар:{" "}
          <code>railway run --service cron npx tsx src/publish/insights.ts</code>
        </div>
      )}

      <Table
        title="Ангиллаар"
        rows={report.byCategory}
        overall={report.overall}
        label={(k) => CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ?? k}
        empty="Тухайн хугацаанд пост алга."
      />

      <Table
        title="Гарчгийн загвараар"
        rows={report.byHookType}
        overall={report.overall}
        label={(k) => HOOK_LABEL[k] ?? k}
        empty="Гарчгийн загвар тэмдэглэгдсэн пост алга (шинэ картуудад автоматаар тэмдэглэгдэнэ)."
      />

      <p className="text-xs text-muted">
        <b>Хүрэлт</b> — постыг хэдэн өөр хүн харсан (FB: post_impressions_unique, IG: reach).{" "}
        <b>Хариу</b> — reaction + хуваалцалт + коммент. <b>★</b> — хамгийн сайн ажилласан.
        Нэг постын тоо санамсаргүй тул 2-оос дээш постын бүлэгт л дүгнэлт хийнэ.
      </p>
    </div>
  );
}
