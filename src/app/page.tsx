import Link from "next/link";
import { getLatestDigest, getLatestNews, getLeaderboard, getSourceNote, getUseCases } from "@/data";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { NewsList } from "@/components/NewsList";
import { NewsletterForm } from "@/components/NewsletterForm";
import { UseCaseIcon } from "@/components/UseCaseIcon";
import { fmtDate } from "@/components/format";
import { currentUser } from "@/auth/session";
import { getPreference, newsForInterests } from "@/bookmarks/preferences";
import { bookmarkedIds } from "@/bookmarks/queries";
import { showInterestBlock } from "@/bookmarks/preferences.api";
import { CATEGORY_LABEL } from "@/agent/category";
import { GuideGrid } from "@/components/GuideList";
import { latestGuides } from "@/guides/queries";
import { PromptOfDay } from "@/components/PromptOfDay";
import { promptOfTheDay } from "@/prompts/queries";
import { benchScores } from "@/bench/queries";
import { CardStrip } from "@/components/CardStrip";
import { latestCards } from "@/gallery/queries";
import { localNews } from "@/mongol/queries";

export const metadata = {
  // Гарчиг, тайлбарыг layout-ын үндсэн утгаас авна
  alternates: { canonical: "/" },
};

// Build үед DB байхгүй тул prerender хийхгүй — нүүр бүх үед шинэ өгөгдөл харуулна
export const dynamic = "force-dynamic";

/** ?tab=chanar → LMArena Elo */
const TABS = [
  { key: "", label: "Хэрэглээ", source: "OPENROUTER_USAGE" as const, metric: "tokens" as const },
  { key: "chanar", label: "Чанар", source: "ARENA_ELO" as const, metric: "elo" as const },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const asked = (await searchParams).tab ?? "";
  const tab = TABS.find((t) => t.key === asked) ?? TABS[0]!;
  const user = await currentUser();
  const [{ date, rows }, note, news, useCases, digest, pref, guides, prompt, cards, mongol] =
    await Promise.all([
    getLeaderboard(10, tab.source),
    getSourceNote(tab.source),
    getLatestNews(5),
    getUseCases(6),
    getLatestDigest(),
    user ? getPreference(user.id) : null,
    latestGuides(3),
    promptOfTheDay(),
    latestCards(3),
    localNews(3),
  ]);

  // "Таны сонирхол" — зөвхөн нэвтэрсэн, ангилал сонгосон хэрэглэгчид
  const mnScores = await benchScores(rows.map((r) => r.model.slug));
  const interest = pref ? await newsForInterests(pref.categories, 4) : [];
  const showInterest = showInterestBlock(user, pref?.categories ?? [], interest.length);
  const savedIds = user ? await bookmarkedIds(user.id, [...interest, ...news].map((n) => n.id)) : undefined;
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

      <section>
        <Link
          href="/songolt"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 hover:bg-accent/10"
        >
          <span className="font-medium">Танд ямар AI тохирох вэ?</span>
          <span className="text-sm text-muted">1 минутын асуулга — 5 асуулт</span>
          <span className="ml-auto text-accent text-sm">Эхлэх →</span>
        </Link>
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold">Топ 10</h2>
            <span className="flex gap-1 text-xs">
              {TABS.map((t) => (
                <Link
                  key={t.key || "hereglee"}
                  href={t.key ? `/?tab=${t.key}` : "/"}
                  className={`rounded-full border px-2.5 py-1 ${
                    t.key === tab.key ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </span>
          </div>
          <Link
            href={tab.key ? `/jagsaalt?tab=${tab.key}` : "/jagsaalt"}
            className="text-sm text-accent hover:underline"
          >
            Бүтэн жагсаалт →
          </Link>
        </div>
        <LeaderboardTable rows={rows} compact metric={tab.metric} benchScores={mnScores} />
        <p className="text-xs text-muted">{note}</p>
      </section>

      {useCases.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">AI-г юунд ашиглах вэ?</h2>
            <Link href="/hereglee" className="text-sm text-accent hover:underline">Бүх ангилал →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {useCases.map((c) => (
              <Link
                key={c.slug}
                href={`/hereglee/${c.slug}`}
                className="flex items-center gap-2 rounded-lg border border-line p-3 text-sm hover:bg-line/30"
              >
                <span className="text-accent shrink-0"><UseCaseIcon name={c.icon} size={18} /></span>
                <span className="font-medium">{c.nameMn}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {digest && (
        <Link
          href={`/medee/${digest.slug}`}
          className="block rounded-lg border border-accent/40 bg-accent/5 p-5 space-y-2 hover:bg-accent/10"
        >
          <p className="text-xs uppercase tracking-widest text-accent">Долоо хоногийн тойм</p>
          <p className="text-xl md:text-2xl font-semibold tracking-tight">{digest.titleMn}</p>
          <p className="text-sm text-muted">{digest.summaryMn}</p>
          <p className="text-xs text-muted">{fmtDate(digest.publishedAt)} · бүтнээр унших →</p>
        </Link>
      )}

      {showInterest && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Таны сонирхол</h2>
            <Link href="/profile/sonirhol" className="text-sm text-muted hover:text-ink">Сэдэв солих →</Link>
          </div>
          <p className="text-xs text-muted">
            {pref!.categories.map((c) => CATEGORY_LABEL[c]).join(" · ")}
          </p>
          <NewsList items={interest} savedIds={savedIds} path="/" />
        </section>
      )}

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
          <NewsList items={news} savedIds={savedIds} path="/" />
        )}
      </section>

      {mongol.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Монголд</h2>
            <Link href="/mongol" className="text-sm text-accent hover:underline">Бүх дотоод мэдээ →</Link>
          </div>
          <NewsList items={mongol} savedIds={savedIds} path="/" />
        </section>
      )}

      {cards.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Өдрийн баримт</h2>
            <Link href="/barimt" className="text-sm text-accent hover:underline">Бүх карт →</Link>
          </div>
          <CardStrip items={cards} />
        </section>
      )}

      {prompt && <PromptOfDay prompt={prompt} />}

      {guides.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Шинэ заавар</h2>
            <Link href="/zaavar" className="text-sm text-accent hover:underline">Бүх заавар →</Link>
          </div>
          <GuideGrid items={guides} />
        </section>
      )}

      <NewsletterForm />
    </div>
  );
}
