import Link from "next/link";
import { NewsList } from "@/components/NewsList";
import { TrackEvent } from "@/components/Track";
import { currentUser } from "@/auth/session";
import { bookmarkedIds } from "@/bookmarks/queries";
import { localCounts, localNews, mongolProjects } from "@/mongol/queries";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Монголд хиймэл оюун, технологийн чиглэлд юу болж байна вэ — дотоодын хэвлэлээс " +
  "шүүсэн мэдээ, монгол AI төсөл, компаниуд.";

export const metadata = {
  title: "Монголд",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/mongol` },
};

export default async function MongolPage() {
  const [news, projects, counts, user] = await Promise.all([
    localNews(20),
    mongolProjects(),
    localCounts(),
    currentUser(),
  ]);
  const savedIds = user ? await bookmarkedIds(user.id, news.map((n) => n.id)) : undefined;

  return (
    <div className="space-y-8">
      <BreadcrumbLd crumbs={[{ name: "Монголын AI" }]} />
      <TrackEvent event="mongol_view" />

      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Монголд юу болж байна</h1>
        <p className="text-muted max-w-2xl">{DESCRIPTION}</p>
      </section>

      {projects.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Монголын AI төсөл, компаниуд</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className={`rounded-lg border p-4 space-y-1.5 ${
                  p.isFeatured ? "border-accent/40 bg-accent/5" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs rounded px-1.5 py-0.5 border border-line text-muted">
                    {p.category}
                  </span>
                </div>
                <p className="text-sm text-muted">{p.description}</p>
                <a
                  href={p.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:underline inline-block"
                >
                  {new URL(p.website).hostname.replace(/^www\./, "")} →
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Энэ жагсаалтыг <strong>гараар</strong> хөтөлдөг — зөвхөн баталгаажсан, вэбсайт нь
            ажилладаг төслүүд. Дутуу зүйл байвал{" "}
            <Link href="/hereglel/nemeh" className="text-accent hover:underline">санал болгоорой</Link>.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Дотоодын мэдээ</h2>
          {counts.published > 0 && (
            <span className="text-xs text-muted tabular-nums">{counts.published} мэдээ</span>
          )}
        </div>
        {news.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted space-y-2">
            <p>Дотоодын мэдээ удахгүй гарна.</p>
            <p className="text-xs">
              Монголын хэвлэлээс AI, технологийн сэдэвтэй нийтлэлийг шүүж, товчлон найруулж
              хүргэнэ. Эх сурвалж бүрийг нэрээр нь дурдана.
            </p>
          </div>
        ) : (
          <NewsList items={news} savedIds={savedIds} path="/mongol" />
        )}
      </section>

      <p className="text-xs text-muted border-t border-line pt-4">
        Дотоодын мэдээг iKon.mn, ITOIM, News.mn, Unread.today, Eguur.mn зэрэг хэвлэлээс
        авч, AI/технологийн сэдэвтэйг нь шүүж товчилдог. Бүтэн эх нийтлэлийг тухайн
        хэвлэлийн сайтаас уншина уу — холбоос нь мэдээ бүр дээр байна.
      </p>
    </div>
  );
}
