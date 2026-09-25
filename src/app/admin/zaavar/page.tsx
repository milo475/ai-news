import Link from "next/link";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import { AUDIENCES, LEVEL_LABEL, LEVELS } from "@/guides/write.api";
import {
  deleteGuideAction, heroGuideAction, publishGuideAction, saveGuideAction, unpublishGuideAction,
  writeGuideAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Заавар — админ" };

const input = "w-full rounded border border-line bg-transparent px-2 py-1 text-sm";
const btn = "rounded border border-line px-2.5 py-1 text-xs hover:bg-line/40";

export default async function AdminGuides({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; msg?: string }>;
}) {
  const sp = await searchParams;

  const [guides, useCases] = await Promise.all([
    prisma.guide.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true, slug: true, title: true, lead: true, bodyMd: true, level: true, audience: true,
        tools: true, usecaseSlug: true, readMinutes: true, faq: true, status: true, publishedAt: true,
        updatedAt: true, views: true, costUsd: true, heroImageAt: true,
      },
    }),
    prisma.useCase.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { slug: true, nameMn: true } }),
  ]);

  const drafts = guides.filter((g) => g.status === "DRAFT").length;
  const totalCost = guides.reduce((n, g) => n + g.costUsd, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Заавар</h1>
        </div>
        <p className="text-xs text-muted">
          {guides.length} заавар · {drafts} ноорог · LLM зардал ${totalCost.toFixed(2)}
        </p>
      </div>

      {sp.msg && <p className="rounded border border-line px-3 py-2 text-sm">{sp.msg}</p>}

      <section className="rounded-lg border border-line p-4 space-y-3">
        <h2 className="text-sm font-semibold">Сэдвээс заавар бичүүлэх</h2>
        <p className="text-xs text-muted">
          LLM бүтэн заавар бичиж НООРОГ болгож хадгална. Уншаад засаад өөрөө нийтэлнэ.
        </p>
        <form action={writeGuideAction} className="grid sm:grid-cols-2 gap-2">
          <input
            name="topic" required minLength={5} className={`${input} sm:col-span-2`}
            placeholder="Сэдэв — жишээ нь: AI-аар CV бичих"
          />
          <label className="text-xs text-muted space-y-1">
            <span>Зорилтот уншигч</span>
            <select name="audience" className={input} defaultValue="ажилтан">
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted space-y-1">
            <span>Түвшин</span>
            <select name="level" className={input} defaultValue="BEGINNER">
              {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted space-y-1">
            <span>Хэрэглээний ангилал (сонголт)</span>
            <select name="usecaseSlug" className={input} defaultValue="">
              <option value="">— холбоогүй —</option>
              {useCases.map((u) => <option key={u.slug} value={u.slug}>{u.nameMn}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 text-xs text-muted pb-1">
            <input type="checkbox" name="withHero" defaultChecked className="accent-accent" />
            <span>Hero зураг хамт үүсгэх</span>
          </label>
          <button className={`${btn} sm:col-span-2 justify-self-start`}>Бичүүлэх</button>
        </form>
      </section>

      {guides.length === 0 ? (
        <p className="text-sm text-muted">Заавар алга. Дээрээс сэдэв өгч бичүүлнэ үү.</p>
      ) : (
        <ul className="space-y-2">
          {guides.map((g) => {
            const open = sp.open === g.id;
            return (
              <li key={g.id} className="rounded-lg border border-line">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span
                    className={`text-xs rounded px-1.5 py-0.5 border ${
                      g.status === "PUBLISHED" ? "border-up/50 text-up" : "border-line text-muted"
                    }`}
                  >
                    {g.status === "PUBLISHED" ? "нийтлэгдсэн" : "ноорог"}
                  </span>
                  <span className="font-medium">{g.title}</span>
                  <span className="text-xs text-muted">
                    {LEVEL_LABEL[g.level]} · {g.readMinutes} мин · {g.views} үзэлт
                    {g.heroImageAt ? " · зурагтай" : " · зураггүй"}
                  </span>
                  <span className="ml-auto flex gap-2">
                    {g.status === "PUBLISHED" && (
                      <Link href={`/zaavar/${g.slug}`} className="text-xs text-accent hover:underline">
                        харах →
                      </Link>
                    )}
                    <Link href={open ? "/admin/zaavar" : `/admin/zaavar?open=${g.id}`} className={btn}>
                      {open ? "хаах" : "засах"}
                    </Link>
                  </span>
                </div>

                {open && (
                  <div className="border-t border-line p-3 space-y-3">
                    <form action={saveGuideAction} className="space-y-2">
                      <input type="hidden" name="id" value={g.id} />
                      <label className="block text-xs text-muted space-y-1">
                        <span>Гарчиг (≤60 тэмдэгт)</span>
                        <input name="title" defaultValue={g.title} className={input} maxLength={80} />
                      </label>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Slug</span>
                        <input name="slug" defaultValue={g.slug} className={input} />
                      </label>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Lead (2 өгүүлбэр)</span>
                        <textarea name="lead" defaultValue={g.lead} rows={2} className={input} />
                      </label>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Бие (markdown — ## алхам, ```prompt блок)</span>
                        <textarea name="bodyMd" defaultValue={g.bodyMd} rows={18} className={`${input} font-mono`} />
                      </label>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <label className="text-xs text-muted space-y-1">
                          <span>Түвшин</span>
                          <select name="level" defaultValue={g.level} className={input}>
                            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Хэрэгсэл (таслалаар)</span>
                          <input name="tools" defaultValue={g.tools.join(", ")} className={input} />
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Хэрэглээний ангилал</span>
                          <select name="usecaseSlug" defaultValue={g.usecaseSlug ?? ""} className={input}>
                            <option value="">— холбоогүй —</option>
                            {useCases.map((u) => <option key={u.slug} value={u.slug}>{u.nameMn}</option>)}
                          </select>
                        </label>
                      </div>
                      <fieldset className="text-xs text-muted space-y-1">
                        <legend>Хэнд зориулсан</legend>
                        <div className="flex flex-wrap gap-3">
                          {AUDIENCES.map((a) => (
                            <label key={a} className="flex gap-1.5 items-center">
                              <input
                                type="checkbox" name="audience" value={a}
                                defaultChecked={g.audience.includes(a)} className="accent-accent"
                              />
                              <span>{a}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label className="block text-xs text-muted space-y-1">
                        <span>FAQ (JSON: [{"{ q, a }"}])</span>
                        <textarea
                          name="faq" rows={6} className={`${input} font-mono`}
                          defaultValue={JSON.stringify(g.faq, null, 1)}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button className={btn}>Хадгалах</button>
                        <button formAction={publishGuideAction} className={`${btn} border-accent/60 text-accent`}>
                          {g.status === "PUBLISHED" ? "Хадгалаад шинэчлэх" : "Хадгалаад нийтлэх"}
                        </button>
                      </div>
                    </form>

                    <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                      <form action={heroGuideAction}>
                        <input type="hidden" name="id" value={g.id} />
                        <button className={btn}>{g.heroImageAt ? "Зураг дахин үүсгэх" : "Зураг үүсгэх"}</button>
                      </form>
                      {g.status === "PUBLISHED" && (
                        <form action={unpublishGuideAction}>
                          <input type="hidden" name="id" value={g.id} />
                          <button className={btn}>Ноорог болгох</button>
                        </form>
                      )}
                      <form action={deleteGuideAction} className="ml-auto">
                        <input type="hidden" name="id" value={g.id} />
                        <button className={`${btn} border-down/50 text-down`}>Устгах</button>
                      </form>
                    </div>

                    <p className="text-xs text-muted">
                      Үүсгэсэн зардал ${g.costUsd.toFixed(3)} · сүүлд шинэчилсэн {fmtDate(g.updatedAt)}
                      {g.publishedAt && ` · нийтэлсэн ${fmtDate(g.publishedAt)}`}
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
