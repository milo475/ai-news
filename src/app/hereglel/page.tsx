import Link from "next/link";
import { currentUser } from "@/auth/session";
import { ToolGrid } from "@/components/ToolList";
import { TrackEvent } from "@/components/Track";
import { bookmarkedToolIds, listTools, toolFacets } from "@/tools/queries";
import { upvotedToolIds } from "@/tools/mutations";
import {
  MN_SUPPORT, MN_SUPPORT_LABEL, PLATFORM_LABEL, PLATFORMS, TOOL_CATEGORIES,
  TOOL_CATEGORY_LABEL, TOOL_PLAN_LABEL, TOOL_PLANS, TOOL_SORT_LABEL, TOOL_SORTS, toToolSort,
} from "@/tools/tool.api";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import type { MongolianSupport, ToolCategory, ToolPlan } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "AI хэрэгслүүдийн монгол каталог: үнэ, монгол хэлний дэмжлэг, платформ, хэрэглэгчийн " +
  "үнэлгээ. Аль нь Монголоос ажилладаг, аль нь картаар төлөгддөгийг нэг дор.";

export const metadata = {
  title: "AI хэрэгсэл",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/hereglel` },
};

type Search = { angilal?: string; une?: string; mn?: string; platform?: string; erembe?: string };

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

export default async function ToolsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const category = (TOOL_CATEGORIES as string[]).includes(sp.angilal ?? "")
    ? (sp.angilal as ToolCategory)
    : undefined;
  const pricing = (TOOL_PLANS as string[]).includes(sp.une ?? "") ? (sp.une as ToolPlan) : undefined;
  const mongolianSupport = (MN_SUPPORT as string[]).includes(sp.mn ?? "")
    ? (sp.mn as MongolianSupport)
    : undefined;
  const platform = (PLATFORMS as readonly string[]).includes(sp.platform ?? "") ? sp.platform : undefined;
  const sort = toToolSort(sp.erembe);

  const [tools, facets, user] = await Promise.all([
    listTools({ category, pricing, mongolianSupport, platform, sort }),
    toolFacets(),
    currentUser(),
  ]);
  const ids = tools.map((t) => t.id);
  const [savedIds, upvotedIds] = user
    ? await Promise.all([bookmarkedToolIds(user.id, ids), upvotedToolIds(user.id, ids)])
    : [undefined, undefined];

  const withFilter = (key: keyof Search, value?: string) => {
    const next = new URLSearchParams();
    const current: Search = {
      angilal: category, une: pricing, mn: mongolianSupport, platform,
      erembe: sort === "aldartai" ? undefined : sort,
    };
    for (const [k, v] of Object.entries({ ...current, [key]: value })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/hereglel?${qs}` : "/hereglel";
  };

  const filtered = Boolean(category || pricing || mongolianSupport || platform);

  return (
    <div className="space-y-6">
      {filtered && (
        <TrackEvent
          event="tool_filter"
          data={{
            category: category ?? "", pricing: pricing ?? "",
            mn: mongolianSupport ?? "", platform: platform ?? "", sort,
          }}
        />
      )}

      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">AI хэрэгсэл</h1>
          <p className="text-muted max-w-2xl">{DESCRIPTION}</p>
        </div>
        <Link
          href="/hereglel/nemeh"
          className="rounded border border-accent/60 px-3 py-1.5 text-sm text-accent hover:bg-accent/10 whitespace-nowrap"
        >
          Хэрэгсэл нэмэх
        </Link>
      </section>

      {facets.categories.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted w-16">Ангилал</span>
            <Chip href={withFilter("angilal")} active={!category}>Бүгд</Chip>
            {TOOL_CATEGORIES.filter((c) => facets.categories.includes(c)).map((c) => (
              <Chip key={c} href={withFilter("angilal", category === c ? undefined : c)} active={category === c}>
                {TOOL_CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted w-16">Үнэ</span>
            <Chip href={withFilter("une")} active={!pricing}>Бүгд</Chip>
            {TOOL_PLANS.filter((p) => facets.pricings.includes(p)).map((p) => (
              <Chip key={p} href={withFilter("une", pricing === p ? undefined : p)} active={pricing === p}>
                {TOOL_PLAN_LABEL[p]}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted w-16">Монгол</span>
            <Chip href={withFilter("mn")} active={!mongolianSupport}>Бүгд</Chip>
            {MN_SUPPORT.filter((m) => facets.supports.includes(m)).map((m) => (
              <Chip
                key={m}
                href={withFilter("mn", mongolianSupport === m ? undefined : m)}
                active={mongolianSupport === m}
              >
                {MN_SUPPORT_LABEL[m]}
              </Chip>
            ))}
          </div>

          {facets.platforms.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted w-16">Платформ</span>
              <Chip href={withFilter("platform")} active={!platform}>Бүгд</Chip>
              {PLATFORMS.filter((p) => facets.platforms.includes(p)).map((p) => (
                <Chip key={p} href={withFilter("platform", platform === p ? undefined : p)} active={platform === p}>
                  {PLATFORM_LABEL[p]}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted w-16">Эрэмбэ</span>
            {TOOL_SORTS.map((s) => (
              <Chip key={s} href={withFilter("erembe", s === "aldartai" ? undefined : s)} active={sort === s}>
                {TOOL_SORT_LABEL[s]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/songolt"
        className="block rounded-lg border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm hover:bg-accent/10"
      >
        <span className="font-medium">Аль нь танд тохирох вэ?</span>{" "}
        <span className="text-muted">5 асуултад хариулбал 3 санал өгнө →</span>
      </Link>

      {tools.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          {filtered
            ? "Энэ шүүлтэд тохирох хэрэгсэл алга. Шүүлтээ цуцлаад бүгдийг үзнэ үү."
            : "Хэрэгсэл удахгүй нэмэгдэнэ."}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">{tools.length} хэрэгсэл</p>
          <ToolGrid items={tools} savedIds={savedIds} upvotedIds={upvotedIds} path="/hereglel" />
        </>
      )}

      <p className="text-xs text-muted border-t border-line pt-4">
        «MN» тэмдэг нь монгол хэл дээрх чанарыг заана: ✓ сайн, ~ дунд, ✗ ажиллахгүй. Үнэ нь хамгийн
        хямд төлбөртэй хувилбарын сарын тариф — тухайн сайт дээр шалгаарай.
      </p>
    </div>
  );
}
