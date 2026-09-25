import Link from "next/link";
import { getLatestNews } from "@/data";
import { fmtDate } from "@/components/format";
import { MIN_QUERY, search } from "@/lib/search";
import { TrackEvent } from "@/components/Track";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  return { title: q ? `«${q}» хайлт` : "Хайлт" };
}

/** ts_headline-ийн <mark> тэгийг аюулгүйгээр үзүүлнэ */
function Headline({ html }: { html: string }) {
  const parts = html.split(/(<mark>|<\/mark>)/);
  let on = false;
  return (
    <p className="text-sm text-muted">
      {parts.map((p, i) => {
        if (p === "<mark>") { on = true; return null; }
        if (p === "</mark>") { on = false; return null; }
        return on ? <mark key={i} className="bg-accent/20 text-ink rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>;
      })}
    </p>
  );
}

export default async function Hailt({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const results = q.length >= MIN_QUERY ? await search(q, { limit: 25 }) : null;
  const fallback = results && results.total === 0 ? await getLatestNews(3) : [];

  return (
    <div className="space-y-6 max-w-3xl">
      {results && <TrackEvent event="search" data={{ query: q, resultCount: results.total }} />}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{q ? `«${q}»` : "Хайлт"}</h1>
        {results && <p className="text-sm text-muted">{results.total} үр дүн</p>}
      </div>

      {!results && (
        <p className="text-sm text-muted">
          Хайх үгээ бичнэ үү ({MIN_QUERY}-оос дээш тэмдэгт). Толгой хэсгийн хайлтын товч эсвэл{" "}
          <kbd className="rounded border border-line px-1">Ctrl</kbd>+<kbd className="rounded border border-line px-1">K</kbd>.
        </p>
      )}

      {results && results.total === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Юу ч олдсонгүй. Өөр үгээр оролдоно уу.</p>
          {fallback.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Сүүлийн мэдээ</h2>
              <ul className="space-y-1">
                {fallback.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/medee/${n.slug}`} className="text-sm text-accent hover:underline">{n.titleMn}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {results && results.articles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Мэдээ <span className="text-sm text-muted">{results.articles.length}</span></h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {results.articles.map((a) => (
              <li key={a.slug} className="p-3 hover:bg-line/30">
                <Link href={`/medee/${a.slug}`} className="font-medium hover:text-accent">{a.titleMn}</Link>
                <Headline html={a.headline} />
                <p className="text-xs text-muted mt-1">
                  {fmtDate(a.publishedAt)}{a.kind === "DIGEST" && " · Долоо хоногийн тойм"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.guides.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Заавар <span className="text-sm text-muted">{results.guides.length}</span></h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {results.guides.map((g) => (
              <li key={g.slug} className="p-3 hover:bg-line/30">
                <Link href={`/zaavar/${g.slug}`} className="font-medium hover:text-accent">{g.title}</Link>
                <Headline html={g.headline} />
                <p className="text-xs text-muted mt-1">{g.readMinutes} мин уншина</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.prompts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Prompt <span className="text-sm text-muted">{results.prompts.length}</span></h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {results.prompts.map((p) => (
              <li key={p.slug} className="p-3 hover:bg-line/30">
                <Link href={`/prompt/${p.slug}`} className="font-medium hover:text-accent">{p.title}</Link>
                <Headline html={p.headline} />
                <p className="text-xs text-muted mt-1">{p.copies} хуулсан</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.models.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Модель <span className="text-sm text-muted">{results.models.length}</span></h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {results.models.map((m) => (
              <li key={m.slug} className="p-3 hover:bg-line/30">
                <Link href={`/model/${m.slug}`} className="font-medium hover:text-accent">{m.name}</Link>
                <span className="ml-2 text-sm text-muted">{m.companyName}</span>
                {m.arenaOnly && <span className="ml-2 text-xs text-muted">зөвхөн Arena</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.tools.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Хэрэгсэл <span className="text-sm text-muted">{results.tools.length}</span></h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {results.tools.map((t) => (
              <li key={t.slug} className="p-3 hover:bg-line/30">
                <Link
                  href={t.useCaseSlug ? `/hereglee/${t.useCaseSlug}` : "/hereglee"}
                  className="font-medium hover:text-accent"
                >
                  {t.name}
                </Link>
                <span className="ml-2 text-sm text-muted">{t.vendor}</span>
                <p className="text-sm text-muted">{t.descriptionMn}</p>
                {t.useCaseName && <p className="text-xs text-muted mt-1">{t.useCaseName}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
