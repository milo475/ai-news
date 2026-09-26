import Link from "next/link";
import { BenchTable } from "@/components/BenchTable";
import { TrackEvent } from "@/components/Track";
import { fmtDate } from "@/components/format";
import { latestBoard, publicTasks } from "@/bench/queries";
import { BENCH_CATEGORIES, BENCH_CATEGORY_LABEL } from "@/bench/task.api";
import { datasetJsonLd, tableJsonLd } from "@/bench/seo.api";
import { monthLabel } from "@/bench/summary.api";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import type { BenchCategory } from "@/generated/prisma/enums";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const board = await latestBoard();
  const title = board
    ? `Монгол хэлээр хамгийн сайн AI модель — ${board.label}`
    : "Монгол хэлний AI бенчмарк";
  const description = board
    ? `${board.rows.length} моделийг монгол хэлний ${board.taskCount} бодит даалгавраар тестэлсэн үр дүн. ` +
      `Тэргүүлэгч: ${board.rows[0]?.name ?? ""}.`
    : "Хиймэл оюуны моделиудыг монгол хэлний бодит даалгавраар сар бүр тестэлнэ.";

  return {
    title,
    description: clamp(description, MAX_META_DESCRIPTION),
    alternates: { canonical: `${siteUrl()}/benchmark` },
    openGraph: {
      type: "website",
      title,
      description: clamp(description, MAX_META_DESCRIPTION),
      // Хуудас өөрийн openGraph зарлавал layout-ын зургийг өвлөхгүй — гараар зааж өгнө
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    },
  };
}

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<{ angilal?: string }>;
}) {
  const sp = await searchParams;
  const category = (BENCH_CATEGORIES as string[]).includes(sp.angilal ?? "")
    ? (sp.angilal as BenchCategory)
    : undefined;

  const [board, samples] = await Promise.all([latestBoard(), publicTasks()]);

  if (!board) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Монгол хэлний AI бенчмарк</h1>
        <p className="text-muted">
          Хиймэл оюуны моделиудыг монгол хэлний бодит даалгавраар сар бүр тестэлж эрэмбэлнэ.
          Эхний үр дүн удахгүй.
        </p>
        <Link href="/benchmark/argachlal" className="text-sm text-accent hover:underline">
          Хэрхэн хэмждэг вэ? →
        </Link>
      </div>
    );
  }

  const site = siteUrl();
  const best = board.rows[0];
  const ld = {
    month: board.month,
    siteUrl: site,
    rows: board.rows.map((r) => ({ rank: r.rank, name: r.name, company: r.company, avgScore: r.avgScore })),
    taskCount: board.taskCount,
    finishedAt: board.finishedAt,
  };

  return (
    <div className="space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Бенчмарк" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([datasetJsonLd(ld), tableJsonLd(ld)]) }}
      />
      <TrackEvent event="bench_view" data={{ month: board.month }} />

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted">
          {monthLabel(board.month)} · {board.rows.length} модель · {board.taskCount} даалгавар
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-3xl">
          Монголоор хамгийн сайн AI:{" "}
          <Link href={`/benchmark/${encodeURIComponent(best!.modelSlug)}`} className="text-accent hover:underline">
            {best!.name}
          </Link>
        </h1>
        <p className="text-muted max-w-2xl">
          {best!.company}-ийн {best!.name} нь монгол хэлний {board.taskCount} даалгаварт{" "}
          {best!.avgScore.toFixed(2)}/10 оноо авлаа. Орчуулга, товчлол, албан бичиг, тоон бодлого,
          монгол соёлын мэдлэгээр тестэлсэн.
        </p>
        <p className="text-xs text-muted">
          Шүүгч: {board.judgeModel}
          {board.finishedAt && ` · хэмжсэн ${fmtDate(board.finishedAt)}`}
          {" · "}
          <Link href="/benchmark/argachlal" className="text-accent hover:underline">аргачлал</Link>
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted w-16">Ангилал</span>
        <Link
          href="/benchmark"
          className={`rounded-full border px-2.5 py-1 text-xs ${
            category ? "border-line text-muted hover:text-ink" : "border-accent text-accent"
          }`}
        >
          Нийт оноо
        </Link>
        {BENCH_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={category === c ? "/benchmark" : `/benchmark?angilal=${c}`}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              category === c ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
            }`}
          >
            {BENCH_CATEGORY_LABEL[c]}
          </Link>
        ))}
      </div>

      <BenchTable rows={board.rows} category={category} />

      <p className="text-xs text-muted">
        Оноо 0–10. Δ нь өмнөх сартай харьцуулсан байрны өөрчлөлт. «1000 үг» нь монгол хэлээр 1000 үг
        үүсгэхэд гарах бодит зардал. Даалгаврууд нийтэд харагдахгүй — моделиуд урьдчилж сурахаас
        сэргийлнэ.
      </p>

      {samples.length > 0 && (
        <section className="space-y-3 border-t border-line pt-6">
          <h2 className="text-xl font-semibold">Нээлттэй жишээ даалгавар</h2>
          <p className="text-sm text-muted">
            Бусад {board.taskCount - samples.length} даалгаврыг нууцалсан. Эдгээрийг жишээ болгон нээв.
          </p>
          <div className="space-y-3">
            {samples.map((t) => (
              <details key={t.slug} className="rounded-lg border border-line p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {t.title}
                  <span className="ml-2 text-xs text-muted">{BENCH_CATEGORY_LABEL[t.category]}</span>
                </summary>
                <pre className="mt-3 text-xs whitespace-pre-wrap break-words font-mono text-muted">
                  {t.prompt}
                </pre>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
