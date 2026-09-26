import Link from "next/link";
import { currentUser } from "@/auth/session";
import { bookmarkedGuideIds } from "@/bookmarks/queries";
import { GuideGrid } from "@/components/GuideList";
import { TrackEvent } from "@/components/Track";
import { guideFacets, listGuides } from "@/guides/queries";
import { LEVEL_LABEL, LEVELS } from "@/guides/write.api";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import type { GuideLevel } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "AI-г өдөр тутмын ажилдаа хэрхэн ашиглах вэ — алхам алхмаар бичсэн монгол гарын авлагууд. " +
  "Бэлэн prompt-уудтай, үнэгүй.";

export const metadata = {
  title: "Заавар",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/zaavar` },
};

type Search = { tuvshin?: string; hen?: string; heregsel?: string };

/** Шүүлтүүрийн товч — сонгосон нь дахин дарахад цуцлагдана */
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs ${
        active ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function GuidesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const level = (LEVELS as string[]).includes(sp.tuvshin ?? "") ? (sp.tuvshin as GuideLevel) : undefined;
  const audience = sp.hen?.trim() || undefined;
  const tool = sp.heregsel?.trim() || undefined;

  const [guides, facets, user] = await Promise.all([
    listGuides({ level, audience, tool }),
    guideFacets(),
    currentUser(),
  ]);
  const savedIds = user ? await bookmarkedGuideIds(user.id, guides.map((g) => g.id)) : undefined;

  /** Одоогийн шүүлтээс нэгийг нь сольсон хаяг */
  const withFilter = (key: keyof Search, value?: string) => {
    const next = new URLSearchParams();
    const current: Search = { tuvshin: level, hen: audience, heregsel: tool };
    for (const [k, v] of Object.entries({ ...current, [key]: value })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/zaavar?${qs}` : "/zaavar";
  };

  const filtered = Boolean(level || audience || tool);

  return (
    <div className="space-y-6">
      {filtered && (
        <TrackEvent
          event="guide_filter"
          data={{ level: level ?? "", audience: audience ?? "", tool: tool ?? "" }}
        />
      )}

      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Заавар</h1>
        <p className="text-muted max-w-2xl">{DESCRIPTION}</p>
      </section>

      {facets.levels.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted w-16">Түвшин</span>
            <Chip href={withFilter("tuvshin")} active={!level}>Бүгд</Chip>
            {LEVELS.filter((l) => facets.levels.includes(l)).map((l) => (
              <Chip key={l} href={withFilter("tuvshin", level === l ? undefined : l)} active={level === l}>
                {LEVEL_LABEL[l]}
              </Chip>
            ))}
          </div>

          {facets.audiences.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted w-16">Хэнд</span>
              <Chip href={withFilter("hen")} active={!audience}>Бүгд</Chip>
              {facets.audiences.map((a) => (
                <Chip key={a} href={withFilter("hen", audience === a ? undefined : a)} active={audience === a}>
                  {a}
                </Chip>
              ))}
            </div>
          )}

          {facets.tools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted w-16">Хэрэгсэл</span>
              <Chip href={withFilter("heregsel")} active={!tool}>Бүгд</Chip>
              {facets.tools.map((t) => (
                <Chip key={t} href={withFilter("heregsel", tool === t ? undefined : t)} active={tool === t}>
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <Link
        href="/songolt"
        className="block rounded-lg border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm hover:bg-accent/10"
      >
        <span className="font-medium">Аль хэрэгслээс эхлэхээ мэдэхгүй байна уу?</span>{" "}
        <span className="text-muted">1 минутын асуулга →</span>
      </Link>

      {guides.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          {filtered
            ? "Энэ шүүлтэд тохирох заавар алга. Шүүлтээ цуцлаад бүгдийг үзнэ үү."
            : "Заавар удахгүй нэмэгдэнэ."}
        </div>
      ) : (
        <GuideGrid items={guides} savedIds={savedIds} path="/zaavar" />
      )}
    </div>
  );
}
