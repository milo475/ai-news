import Link from "next/link";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import { ToolLogo } from "@/components/ToolLogo";
import {
  MN_SUPPORT, MN_SUPPORT_LABEL, PLATFORMS, PLATFORM_LABEL, TOOL_CATEGORIES,
  TOOL_CATEGORY_LABEL, TOOL_PLANS, TOOL_PLAN_LABEL,
} from "@/tools/tool.api";
import {
  approveToolAction, deleteToolAction, refetchLogoAction, refreshToolAction, reviewStatusAction,
  saveAndPublishToolAction, saveToolAction, setAlternativesAction, unpublishToolAction,
} from "./actions";
import type { ToolStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Хэрэгсэл — админ" };

const input = "w-full rounded border border-line bg-transparent px-2 py-1 text-sm";
const btn = "rounded border border-line px-2.5 py-1 text-xs hover:bg-line/40";

const TABS: ToolStatus[] = ["PENDING", "PUBLISHED"];
const TAB_LABEL: Record<ToolStatus, string> = { PENDING: "Хүлээгдэж буй", PUBLISHED: "Нийтлэгдсэн" };

export default async function AdminTools({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; open?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const status: ToolStatus = TABS.includes(sp.status as ToolStatus)
    ? (sp.status as ToolStatus)
    : "PENDING";

  const [counts, tools, pendingReviews] = await Promise.all([
    prisma.tool.groupBy({ by: ["status"], _count: true }),
    prisma.tool.findMany({
      where: { status },
      orderBy: [{ createdAt: "desc" }],
      take: 120,
      select: {
        id: true, slug: true, name: true, tagline: true, descriptionMd: true, website: true,
        affiliateUrl: true, categories: true, platforms: true, pricing: true, priceFrom: true,
        mongolianSupport: true, mnNoteMd: true, rating: true, reviewCount: true, upvotes: true,
        source: true, logoAt: true, createdAt: true, publishedAt: true,
        submittedBy: { select: { email: true, name: true } },
        alternativesTo: { select: { slug: true } },
        alternativeOf: { select: { slug: true } },
      },
    }),
    prisma.toolReview.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, stars: true, text: true, rejectReason: true, createdAt: true,
        tool: { select: { slug: true, name: true } },
        user: { select: { email: true, name: true } },
      },
    }),
  ]);
  const countOf = (s: ToolStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">AI хэрэгсэл</h1>
        </div>
        <Link href="/hereglel" className="text-sm text-accent hover:underline">Каталог →</Link>
      </div>

      {sp.msg && <p className="rounded border border-line px-3 py-2 text-sm">{sp.msg}</p>}

      <nav className="flex gap-4 text-sm border-b border-line">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/admin/hereglel?status=${s}`}
            className={`pb-2 -mb-px border-b-2 ${
              s === status ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {TAB_LABEL[s]} <span className="tabular-nums">{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      {pendingReviews.length > 0 && (
        <section className="rounded-lg border border-warn/40 p-4 space-y-2">
          <h2 className="text-sm font-semibold">Хянах шүүмж {pendingReviews.length}</h2>
          <ul className="space-y-2">
            {pendingReviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-2 text-sm border-b border-line pb-2 last:border-0">
                <span className="text-accent">{"★".repeat(r.stars)}</span>
                <Link href={`/hereglel/${r.tool.slug}`} className="font-medium hover:text-accent">
                  {r.tool.name}
                </Link>
                <span className="text-xs text-muted">{r.user.name ?? r.user.email}</span>
                {r.text && <p className="basis-full text-sm">{r.text}</p>}
                {r.rejectReason && <p className="basis-full text-xs text-down">{r.rejectReason}</p>}
                <span className="ml-auto flex gap-2">
                  <form action={reviewStatusAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="op" value="publish" />
                    <button className={`${btn} border-up/50 text-up`}>Нийтлэх</button>
                  </form>
                  <form action={reviewStatusAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="op" value="delete" />
                    <button className={`${btn} border-down/50 text-down`}>Устгах</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tools.length === 0 ? (
        <p className="text-sm text-muted">Энэ төлөвт хэрэгсэл алга.</p>
      ) : (
        <ul className="space-y-2">
          {tools.map((t) => {
            const open = sp.open === t.id;
            const alts = [...new Set([...t.alternativesTo, ...t.alternativeOf].map((a) => a.slug))];
            return (
              <li key={t.id} className="rounded-lg border border-line">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <ToolLogo name={t.name} slug={t.slug} hasLogo={t.logoAt !== null} size={28} />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted">
                    {t.source === "SITE" ? "сайт" : "хэрэглэгч"}
                    {" · "}{TOOL_PLAN_LABEL[t.pricing]}
                    {t.priceFrom ? ` $${t.priceFrom}` : ""}
                    {" · "}{MN_SUPPORT_LABEL[t.mongolianSupport]}
                    {" · ▲"}{t.upvotes}
                    {t.reviewCount > 0 && ` · ★${t.rating.toFixed(1)} (${t.reviewCount})`}
                    {!t.logoAt && " · логогүй"}
                    {t.affiliateUrl && " · affiliate"}
                    {t.submittedBy && ` · ${t.submittedBy.name ?? t.submittedBy.email}`}
                  </span>
                  <span className="ml-auto flex gap-2 items-center">
                    {status === "PUBLISHED" ? (
                      <Link href={`/hereglel/${t.slug}`} className="text-xs text-accent hover:underline">
                        харах →
                      </Link>
                    ) : (
                      <form action={approveToolAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className={`${btn} border-up/50 text-up`}>Батлах</button>
                      </form>
                    )}
                    <Link
                      href={open ? "/admin/hereglel" : `/admin/hereglel?status=${status}&open=${t.id}`}
                      className={btn}
                    >
                      {open ? "хаах" : "засах"}
                    </Link>
                  </span>
                </div>

                {!open && <p className="px-3 pb-3 text-xs text-muted">{t.tagline}</p>}

                {open && (
                  <div className="border-t border-line p-3 space-y-3">
                    <form action={saveToolAction} className="space-y-2">
                      <input type="hidden" name="id" value={t.id} />
                      <div className="grid sm:grid-cols-2 gap-2">
                        <label className="text-xs text-muted space-y-1">
                          <span>Нэр</span>
                          <input name="name" defaultValue={t.name} className={input} />
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Slug</span>
                          <input name="slug" defaultValue={t.slug} className={input} />
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Вэбсайт</span>
                          <input name="website" defaultValue={t.website} className={input} />
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Affiliate холбоос (байвал)</span>
                          <input name="affiliateUrl" defaultValue={t.affiliateUrl ?? ""} className={input} />
                        </label>
                      </div>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Tagline (≤80)</span>
                        <input name="tagline" defaultValue={t.tagline} maxLength={80} className={input} />
                      </label>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Тайлбар (markdown)</span>
                        <textarea name="descriptionMd" defaultValue={t.descriptionMd} rows={8} className={`${input} font-mono`} />
                      </label>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Монгол хэрэглэгчид анхаарах (markdown)</span>
                        <textarea name="mnNoteMd" defaultValue={t.mnNoteMd ?? ""} rows={5} className={`${input} font-mono`} />
                      </label>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <label className="text-xs text-muted space-y-1">
                          <span>Үнийн хэлбэр</span>
                          <select name="pricing" defaultValue={t.pricing} className={input}>
                            {TOOL_PLANS.map((p) => <option key={p} value={p}>{TOOL_PLAN_LABEL[p]}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Сарын үнэ USD (хоосон = мэдэгдэхгүй)</span>
                          <input name="priceFrom" defaultValue={t.priceFrom ?? ""} className={input} inputMode="decimal" />
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Монгол хэл</span>
                          <select name="mongolianSupport" defaultValue={t.mongolianSupport} className={input}>
                            {MN_SUPPORT.map((m) => <option key={m} value={m}>{MN_SUPPORT_LABEL[m]}</option>)}
                          </select>
                        </label>
                      </div>
                      <fieldset className="text-xs text-muted space-y-1">
                        <legend>Ангилал</legend>
                        <div className="flex flex-wrap gap-3">
                          {TOOL_CATEGORIES.map((c) => (
                            <label key={c} className="flex gap-1.5 items-center">
                              <input
                                type="checkbox" name="categories" value={c}
                                defaultChecked={t.categories.includes(c)} className="accent-accent"
                              />
                              <span>{TOOL_CATEGORY_LABEL[c]}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset className="text-xs text-muted space-y-1">
                        <legend>Платформ</legend>
                        <div className="flex flex-wrap gap-3">
                          {PLATFORMS.map((p) => (
                            <label key={p} className="flex gap-1.5 items-center">
                              <input
                                type="checkbox" name="platforms" value={p}
                                defaultChecked={t.platforms.includes(p)} className="accent-accent"
                              />
                              <span>{PLATFORM_LABEL[p]}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="flex flex-wrap gap-2">
                        <button className={btn}>Хадгалах</button>
                        <button formAction={saveAndPublishToolAction} className={`${btn} border-accent/60 text-accent`}>
                          {status === "PUBLISHED" ? "Хадгалаад шинэчлэх" : "Хадгалаад нийтлэх"}
                        </button>
                      </div>
                    </form>

                    <form action={setAlternativesAction} className="flex flex-wrap gap-2 items-end border-t border-line pt-3">
                      <input type="hidden" name="id" value={t.id} />
                      <label className="text-xs text-muted space-y-1 flex-1 min-w-48">
                        <span>Хувилбарууд — slug-ууд таслалаар</span>
                        <input name="alternatives" defaultValue={alts.join(", ")} className={input} />
                      </label>
                      <button className={btn}>Холбох</button>
                    </form>

                    <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                      <form action={refetchLogoAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className={btn}>{t.logoAt ? "Лого дахин татах" : "Лого татах"}</button>
                      </form>
                      <form action={refreshToolAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className={btn}>LLM-ээр шинэчлэх</button>
                      </form>
                      {status === "PUBLISHED" && (
                        <form action={unpublishToolAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className={btn}>Хүлээлгэнд буцаах</button>
                        </form>
                      )}
                      <form action={deleteToolAction} className="ml-auto">
                        <input type="hidden" name="id" value={t.id} />
                        <button className={`${btn} border-down/50 text-down`}>Устгах</button>
                      </form>
                    </div>

                    <p className="text-xs text-muted">
                      {fmtDate(t.createdAt)}
                      {t.publishedAt && ` · нийтэлсэн ${fmtDate(t.publishedAt)}`}
                      {t.logoAt && ` · лого ${fmtDate(t.logoAt)}`}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
