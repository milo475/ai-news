import Link from "next/link";
import { getLatestNews, getLeaderboard, getSourceNote } from "@/data";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { NewsList } from "@/components/NewsList";
import { fmtDate } from "@/components/format";

export const revalidate = 3600; // 1 цаг тутам дахин үүсгэнэ

export default async function Home() {
  const [{ date, rows }, note, news] = await Promise.all([getLeaderboard(10), getSourceNote(), getLatestNews(5)]);
  const movers = [...rows].filter((r) => r.rankDelta !== null).sort((a, b) => (b.rankDelta ?? 0) - (a.rankDelta ?? 0));
  const top = movers[0];
  const bottom = movers[movers.length - 1];

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted">{fmtDate(date)} · өдөр тутам шинэчлэгдэнэ</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
          Дэлхийн хамгийн их хэрэглэгддэг AI моделиуд — өнөөдрийн байдлаар
        </h1>
        <p className="text-muted max-w-2xl">
          Хөгжүүлэгчид бодитоор ямар AI-г хамгийн их ашиглаж байгааг өдөр бүр хэмжиж, монгол хэлээр хүргэнэ.
          Байрны өөрчлөлт өмнөх өдөртэй харьцуулагдана.
        </p>
      </section>

      {top && bottom && top !== bottom && (
        <section className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-line p-4">
            <p className="text-xs text-muted mb-1">Өнөөдрийн хамгийн их өсөлт</p>
            <p className="font-medium">
              <span className="text-up">▲ {top.rankDelta}</span> · {top.model.name}
              <span className="text-muted"> — {top.company.name}</span>
            </p>
          </div>
          <div className="rounded-lg border border-line p-4">
            <p className="text-xs text-muted mb-1">Өнөөдрийн хамгийн их уналт</p>
            <p className="font-medium">
              <span className="text-down">▼ {Math.abs(bottom.rankDelta ?? 0)}</span> · {bottom.model.name}
              <span className="text-muted"> — {bottom.company.name}</span>
            </p>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Топ 10</h2>
          <Link href="/jagsaalt" className="text-sm text-accent hover:underline">Бүтэн жагсаалт →</Link>
        </div>
        <LeaderboardTable rows={rows} compact />
        <p className="text-xs text-muted">{note}</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Сүүлийн мэдээ</h2>
          <Link href="/medee" className="text-sm text-accent hover:underline">Бүх мэдээ →</Link>
        </div>
        {news.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
            Мэдээний agent удахгүй нэмэгдэнэ. Дэлхийн AI мэдээг өдөр бүр монгол хэлээр хураангуйлан хүргэх болно.
          </div>
        ) : (
          <NewsList items={news} />
        )}
      </section>
    </div>
  );
}
