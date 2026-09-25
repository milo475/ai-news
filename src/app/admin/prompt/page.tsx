import Link from "next/link";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import {
  PROMPT_CATEGORIES, PROMPT_CATEGORY_LABEL, PROMPT_LANGUAGE_LABEL, PROMPT_LANGUAGES,
} from "@/prompts/prompt.api";
import {
  approvePromptAction, deletePromptAction, rejectPromptAction, saveAndPublishPromptAction,
  savePromptAction,
} from "./actions";
import type { PromptStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Prompt — админ" };

const input = "w-full rounded border border-line bg-transparent px-2 py-1 text-sm";
const btn = "rounded border border-line px-2.5 py-1 text-xs hover:bg-line/40";

const TABS: PromptStatus[] = ["PENDING", "PUBLISHED", "REJECTED"];
const TAB_LABEL: Record<PromptStatus, string> = {
  PENDING: "Хүлээгдэж буй",
  PUBLISHED: "Нийтлэгдсэн",
  REJECTED: "Татгалзсан",
};

export default async function AdminPrompts({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; open?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const status: PromptStatus = TABS.includes(sp.status as PromptStatus)
    ? (sp.status as PromptStatus)
    : "PENDING";

  const [counts, prompts, reports] = await Promise.all([
    prisma.prompt.groupBy({ by: ["status"], _count: true }),
    prisma.prompt.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, slug: true, title: true, body: true, description: true, category: true,
        language: true, tools: true, variables: true, source: true, status: true,
        rejectReason: true, copies: true, likes: true, createdAt: true, publishedAt: true,
        author: { select: { email: true, name: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.promptReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, reason: true, createdAt: true, prompt: { select: { slug: true, title: true } } },
    }),
  ]);
  const countOf = (s: PromptStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Prompt сан</h1>
        </div>
        <Link href="/prompt" className="text-sm text-accent hover:underline">Сан харах →</Link>
      </div>

      {sp.msg && <p className="rounded border border-line px-3 py-2 text-sm">{sp.msg}</p>}

      <nav className="flex gap-4 text-sm border-b border-line">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/admin/prompt?status=${s}`}
            className={`pb-2 -mb-px border-b-2 ${
              s === status ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {TAB_LABEL[s]} <span className="tabular-nums">{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      {prompts.length === 0 ? (
        <p className="text-sm text-muted">Энэ төлөвт prompt алга.</p>
      ) : (
        <ul className="space-y-2">
          {prompts.map((p) => {
            const open = sp.open === p.id;
            return (
              <li key={p.id} className="rounded-lg border border-line">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span className="text-xs rounded px-1.5 py-0.5 border border-line text-muted">
                    {p.source === "SITE" ? "сайт" : "хэрэглэгч"}
                  </span>
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-muted">
                    {PROMPT_CATEGORY_LABEL[p.category]} · {p.variables.length} хувьсагч
                    {p.author && ` · ${p.author.name ?? p.author.email}`}
                    {p._count.reports > 0 && ` · ${p._count.reports} гомдол`}
                  </span>
                  <span className="ml-auto flex gap-2 items-center">
                    {p.status === "PUBLISHED" && (
                      <Link href={`/prompt/${p.slug}`} className="text-xs text-accent hover:underline">
                        харах →
                      </Link>
                    )}
                    {p.status !== "PUBLISHED" && (
                      <form action={approvePromptAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className={`${btn} border-up/50 text-up`}>Батлах</button>
                      </form>
                    )}
                    <Link href={open ? "/admin/prompt" : `/admin/prompt?status=${status}&open=${p.id}`} className={btn}>
                      {open ? "хаах" : "засах"}
                    </Link>
                  </span>
                </div>

                {!open && (
                  <p className="px-3 pb-3 text-xs text-muted line-clamp-2 font-mono">{p.body}</p>
                )}

                {open && (
                  <div className="border-t border-line p-3 space-y-3">
                    <form action={savePromptAction} className="space-y-2">
                      <input type="hidden" name="id" value={p.id} />
                      <div className="grid sm:grid-cols-2 gap-2">
                        <label className="text-xs text-muted space-y-1">
                          <span>Гарчиг</span>
                          <input name="title" defaultValue={p.title} className={input} />
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Slug</span>
                          <input name="slug" defaultValue={p.slug} className={input} />
                        </label>
                      </div>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Тайлбар</span>
                        <input name="description" defaultValue={p.description} className={input} />
                      </label>
                      <label className="block text-xs text-muted space-y-1">
                        <span>Prompt ({"{"}хувьсагч{"}"} хэлбэрээр нүх тавина)</span>
                        <textarea name="body" defaultValue={p.body} rows={12} className={`${input} font-mono`} />
                      </label>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <label className="text-xs text-muted space-y-1">
                          <span>Ангилал</span>
                          <select name="category" defaultValue={p.category} className={input}>
                            {PROMPT_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{PROMPT_CATEGORY_LABEL[c]}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Хэл</span>
                          <select name="language" defaultValue={p.language} className={input}>
                            {PROMPT_LANGUAGES.map((l) => (
                              <option key={l} value={l}>{PROMPT_LANGUAGE_LABEL[l]}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-muted space-y-1">
                          <span>Хэрэгсэл (таслалаар)</span>
                          <input name="tools" defaultValue={p.tools.join(", ")} className={input} />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className={btn}>Хадгалах</button>
                        <button formAction={saveAndPublishPromptAction} className={`${btn} border-accent/60 text-accent`}>
                          {p.status === "PUBLISHED" ? "Хадгалаад шинэчлэх" : "Хадгалаад нийтлэх"}
                        </button>
                      </div>
                    </form>

                    <div className="flex flex-wrap gap-2 items-end border-t border-line pt-3">
                      <form action={rejectPromptAction} className="flex flex-wrap gap-2 items-end flex-1 min-w-48">
                        <input type="hidden" name="id" value={p.id} />
                        <label className="text-xs text-muted space-y-1 flex-1 min-w-48">
                          <span>Татгалзах шалтгаан (зохиогчид имэйлээр очно)</span>
                          <input name="reason" defaultValue={p.rejectReason ?? ""} className={input} />
                        </label>
                        <button className={`${btn} border-down/50 text-down`}>Татгалзах</button>
                      </form>
                      <form action={deletePromptAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className={`${btn} border-down/50 text-down`}>Устгах</button>
                      </form>
                    </div>

                    <p className="text-xs text-muted">
                      {fmtDate(p.createdAt)} · {p.copies} хуулсан · {p.likes} таалагдсан
                      {p.publishedAt && ` · нийтэлсэн ${fmtDate(p.publishedAt)}`}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {reports.length > 0 && (
        <section className="rounded-lg border border-line p-4 space-y-2">
          <h2 className="text-sm font-semibold">Сүүлийн гомдлууд</h2>
          <ul className="text-sm space-y-1">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2">
                <Link href={`/prompt/${r.prompt.slug}`} className="hover:text-accent">{r.prompt.title}</Link>
                <span className="text-muted">— {r.reason}</span>
                <span className="ml-auto text-xs text-muted">{fmtDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
