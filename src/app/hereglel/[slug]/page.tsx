import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/auth/session";
import { isBookmarked } from "@/bookmarks/queries";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Markdown } from "@/components/Markdown";
import { ToolClickOut } from "@/components/ToolClickOut";
import { ToolGrid, MnBadge, PriceBadge, Stars } from "@/components/ToolList";
import { ToolLogo } from "@/components/ToolLogo";
import { ToolReviewForm } from "@/components/ToolReviewForm";
import { ToolUpvote } from "@/components/ToolUpvote";
import { ToolVersus } from "@/components/ToolVersus";
import { TrackEvent } from "@/components/Track";
import { fmtDate } from "@/components/format";
import { bookmarkedToolIds, getTool, getToolsForVersus, myReview } from "@/tools/queries";
import { upvotedToolIds } from "@/tools/mutations";
import { deleteReviewAction } from "@/tools/actions";
import {
  domainOf, MN_SUPPORT_LABEL, parseVersusSlug, PLATFORM_LABEL, TOOL_CATEGORY_LABEL,
  TOOL_PLAN_LABEL, type Platform,
} from "@/tools/tool.api";
import { softwareJsonLd, toolMetaDescription, toolMetaTitle } from "@/tools/seo.api";
import { clamp, MAX_META_DESCRIPTION, MAX_META_TITLE } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;

  const versus = parseVersusSlug(slug);
  if (versus) {
    const pair = await getToolsForVersus(versus[0], versus[1]);
    if (!pair) return { title: "Харьцуулалт" };
    const [a, b] = pair;
    const title = `${a.name} vs ${b.name} — үнэ, монгол хэлний дэмжлэг`;
    return {
      title: clamp(title, MAX_META_TITLE),
      description: clamp(
        `${a.name} ба ${b.name}-ийг үнэ, монгол хэлний дэмжлэг, платформ, хэрэглэгчийн ` +
          "үнэлгээгээр хажуу хажуугаар харьцуулав.",
        MAX_META_DESCRIPTION,
      ),
      alternates: { canonical: `${siteUrl()}/hereglel/${slug}` },
    };
  }

  const t = await getTool(slug);
  if (!t) return { title: "Хэрэгсэл" };
  const title = toolMetaTitle(t.name);
  const description = toolMetaDescription(t);
  return {
    title: clamp(title, MAX_META_TITLE),
    description: clamp(description, MAX_META_DESCRIPTION),
    alternates: { canonical: `${siteUrl()}/hereglel/${slug}` },
    openGraph: {
      type: "website", title: clamp(title, MAX_META_TITLE),
      description: clamp(description, MAX_META_DESCRIPTION),
      url: `${siteUrl()}/hereglel/${slug}`,
      ...(t.hasLogo ? { images: [{ url: `${siteUrl()}/api/tool-logo/${slug}` }] } : {}),
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;

  // "chatgpt-vs-claude" → харьцуулалтын хуудас (тусдаа route биш — slug-тай зөрчилдөхгүйн тулд)
  const versus = parseVersusSlug(slug);
  if (versus) {
    const pair = await getToolsForVersus(versus[0], versus[1]);
    if (!pair) notFound();
    const [a, b] = pair;
    return (
      <div className="max-w-4xl space-y-6">
        <TrackEvent event="tool_versus_view" data={{ a: a.slug, b: b.slug }} />
        <div className="space-y-2">
          <Link href="/hereglel" className="text-sm text-muted hover:text-ink">← AI хэрэгсэл</Link>
          <h1 className="text-3xl font-semibold tracking-tight">{a.name} vs {b.name}</h1>
          <p className="text-muted">
            Үнэ, монгол хэлний дэмжлэг, платформ, хэрэглэгчийн үнэлгээгээр харьцуулав.
          </p>
        </div>
        <ToolVersus a={a} b={b} />
        <p className="text-xs text-muted border-t border-line pt-4">
          Дэлгэрэнгүйг{" "}
          <Link href={`/hereglel/${a.slug}`} className="text-accent hover:underline">{a.name}</Link>
          {" ба "}
          <Link href={`/hereglel/${b.slug}`} className="text-accent hover:underline">{b.name}</Link>
          {" "}хуудсуудаас үзнэ үү.
        </p>
      </div>
    );
  }

  const t = await getTool(slug);
  if (!t) notFound();

  const user = await currentUser();
  const altIds = t.alternatives.map((a) => a.id);
  const [saved, upvoted, mine, savedAlts, upvotedAlts] = user
    ? await Promise.all([
        isBookmarked(user.id, { toolId: t.id }),
        upvotedToolIds(user.id, [t.id]).then((s) => s.has(t.id)),
        myReview(user.id, t.id),
        bookmarkedToolIds(user.id, altIds),
        upvotedToolIds(user.id, altIds),
      ])
    : [false, false, null, undefined, undefined];

  const href = t.affiliateUrl ?? t.website;
  const affiliate = Boolean(t.affiliateUrl);
  const path = `/hereglel/${slug}`;

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Үнэ", value: <PriceBadge tool={t} /> },
    {
      label: "Сарын тариф",
      value: t.priceFrom ? `$${t.priceFrom}-аас` : t.pricing === "FREE" ? "үнэгүй" : "сайт дээр шалгана уу",
    },
    { label: "Төлбөрийн хэлбэр", value: TOOL_PLAN_LABEL[t.pricing] },
    { label: "Монгол хэл", value: MN_SUPPORT_LABEL[t.mongolianSupport] },
    {
      label: "Платформ",
      value: t.platforms.map((p) => PLATFORM_LABEL[p as Platform] ?? p).join(", ") || "—",
    },
    { label: "Вэбсайт", value: domainOf(t.website) },
  ];

  return (
    <article className="max-w-3xl space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd(t, siteUrl())) }}
      />
      <TrackEvent event="tool_view" data={{ slug }} />

      <div className="space-y-3">
        <Link href="/hereglel" className="text-sm text-muted hover:text-ink">← AI хэрэгсэл</Link>
        <div className="flex items-start gap-4">
          <ToolLogo name={t.name} slug={t.slug} hasLogo={t.hasLogo} size={64} />
          <div className="min-w-0 space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{t.name}</h1>
            <p className="text-muted">{t.tagline}</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <PriceBadge tool={t} />
              <MnBadge support={t.mongolianSupport} />
              <Stars rating={t.rating} count={t.reviewCount} />
              {t.categories.map((c) => (
                <Link
                  key={c}
                  href={`/hereglel?angilal=${c}`}
                  className="text-xs rounded px-1.5 py-0.5 border border-line text-muted hover:text-accent"
                >
                  {TOOL_CATEGORY_LABEL[c]}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ToolClickOut toolId={t.id} slug={slug} href={href} affiliate={affiliate} />
          <ToolUpvote toolId={t.id} slug={slug} upvoted={upvoted} count={t.upvotes} path={path} />
          <BookmarkButton target={{ toolId: t.id }} saved={saved} path={path} />
        </div>
        {affiliate && (
          <p className="text-xs text-muted">
            Вэбсайтын холбоос нь хамтын ажиллагааны (affiliate) холбоос. Танд нэмэлт зардал гарахгүй,
            харин бид жижиг хувь авна. Энэ нь эрэмбэ, үнэлгээнд нөлөөлдөггүй.
          </p>
        )}
      </div>

      <section className="rounded-lg border border-line overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {facts.map((f) => (
              <tr key={f.label} className="border-b border-line last:border-0">
                <td className="py-2 px-3 text-muted w-40">{f.label}</td>
                <td className="py-2 px-3">{f.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {t.descriptionMd && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Тухай</h2>
          <div className="text-[15px]">
            <Markdown>{t.descriptionMd}</Markdown>
          </div>
        </section>
      )}

      {t.mnNoteMd && (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4 space-y-2">
          <h2 className="text-xl font-semibold">Монгол хэрэглэгчид анхаарах</h2>
          <div className="text-[15px]">
            <Markdown>{t.mnNoteMd}</Markdown>
          </div>
          <p className="text-xs text-muted">
            Үнэ, төлбөрийн нөхцөл хурдан хувирдаг — хэрэгслийн сайт дээр дахин шалгаарай.
          </p>
        </section>
      )}

      {t.alternatives.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Хувилбарууд</h2>
          <ToolGrid
            items={t.alternatives} savedIds={savedAlts} upvotedIds={upvotedAlts} path={path} cols={2}
          />
          <p className="text-xs text-muted">
            Хоёрыг хажуу хажуугаар харьцуулах:{" "}
            {t.alternatives.slice(0, 3).map((a, i) => (
              <span key={a.id}>
                {i > 0 && " · "}
                <Link href={`/hereglel/${t.slug}-vs-${a.slug}`} className="text-accent hover:underline">
                  {t.name} vs {a.name}
                </Link>
              </span>
            ))}
          </p>
        </section>
      )}

      {(t.guides.length > 0 || t.prompts.length > 0) && (
        <section className="grid sm:grid-cols-2 gap-4">
          {t.guides.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Холбоотой заавар</h2>
              <ul className="space-y-1.5 text-sm">
                {t.guides.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/zaavar/${g.slug}`} className="hover:text-accent">{g.title}</Link>
                    <span className="text-xs text-muted"> · {g.readMinutes} мин</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {t.prompts.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Холбоотой prompt</h2>
              <ul className="space-y-1.5 text-sm">
                {t.prompts.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/prompt/${p.slug}`} className="hover:text-accent">{p.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 border-t border-line pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Шүүмж</h2>
          <Stars rating={t.rating} count={t.reviewCount} />
        </div>

        {user?.verified ? (
          <div className="rounded-lg border border-line p-4 space-y-2">
            <ToolReviewForm toolId={t.id} slug={slug} mine={mine} />
            {mine && (
              <form action={deleteReviewAction}>
                <input type="hidden" name="toolId" value={t.id} />
                <input type="hidden" name="slug" value={slug} />
                <button className="text-xs text-muted hover:text-down">Шүүмжээ устгах</button>
              </form>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
            Шүүмж бичихийн тулд{" "}
            <Link href={`/nevtreh?ur=${encodeURIComponent(path)}`} className="text-accent hover:underline">
              нэвтэрч
            </Link>{" "}
            имэйлээ баталгаажуулна уу.
          </p>
        )}

        {t.reviews.length === 0 ? (
          <p className="text-sm text-muted">Одоохондоо шүүмж алга. Та анхны шүүмжийг бичээрэй.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {t.reviews.map((r) => (
              <li key={r.id} className="p-3 space-y-1">
                <p className="text-xs text-muted">
                  <span className="text-accent">{"★".repeat(r.stars)}</span>
                  <span>{"☆".repeat(5 - r.stars)}</span>
                  {" · "}{r.authorName ?? "Хэрэглэгч"}{" · "}{fmtDate(r.createdAt)}
                </p>
                {r.text && <p className="text-sm">{r.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted border-t border-line pt-4">
        Сүүлд шинэчилсэн: {fmtDate(t.updatedAt)}
      </p>
    </article>
  );
}
