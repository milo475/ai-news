import Link from "next/link";
import { fmtDate } from "@/components/format";
import { localCounts, localSources, mongolProjects } from "@/mongol/queries";
import { prisma } from "@/db";
import {
  addManualAction, deleteProjectAction, fetchSourceAction, saveProjectAction, saveSourceAction,
  testSourceAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Монгол — админ" };

const input = "w-full rounded border border-line bg-transparent px-2 py-1 text-sm";
const btn = "rounded border border-line px-2.5 py-1 text-xs hover:bg-line/40";

export default async function AdminMongol({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; msg?: string; project?: string }>;
}) {
  const sp = await searchParams;
  const [sources, projects, counts, recent] = await Promise.all([
    localSources(),
    mongolProjects(),
    localCounts(),
    prisma.article.findMany({
      where: { region: "MN" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, slug: true, status: true, titleMn: true, sourceTitle: true, relevance: true,
        createdAt: true, publishedAt: true, source: { select: { name: true } },
      },
    }),
  ]);

  const editing = sp.project ? projects.find((p) => p.id === sp.project) : null;
  const full = editing
    ? await prisma.mongolProject.findUnique({ where: { id: editing.id } })
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Монгол</h1>
        </div>
        <span className="text-xs text-muted">
          {counts.published} нийтлэгдсэн · {counts.draft} ноорог · {counts.raw} RAW
        </span>
      </div>

      {sp.msg && <p className="rounded border border-line px-3 py-2 text-sm whitespace-pre-wrap">{sp.msg}</p>}

      <section className="rounded-lg border border-line p-4 space-y-3">
        <h2 className="text-sm font-semibold">Гараар мэдээ нэмэх</h2>
        <p className="text-xs text-muted">
          Нийтлэлийн хаяг өгөхөд бүтэн текст татаж, тэр дор нь товчлол бичүүлнэ. Дараа нь
          /admin дээрээс хянаж нийтэлнэ.
        </p>
        <form action={addManualAction} className="grid sm:grid-cols-[1fr_auto] gap-2">
          <input name="url" required className={input} placeholder="https://ikon.mn/n/..." />
          <button className={btn}>Татаад товчлох</button>
          <input name="title" className={`${input} sm:col-span-2`} placeholder="Гарчиг (хоосон бол текстээс авна)" />
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Эх сурвалжууд {sources.length}</h2>
        <ul className="space-y-2">
          {sources.map((s) => {
            const open = sp.open === s.id;
            const kind = s.feedUrl ? "RSS" : s.listUrl ? "HTML" : "—";
            return (
              <li key={s.id} className="rounded-lg border border-line">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span className={`text-xs rounded px-1.5 py-0.5 border ${s.isActive ? "border-up/50 text-up" : "border-line text-muted"}`}>
                    {s.isActive ? "идэвхтэй" : "идэвхгүй"}
                  </span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted">
                    {kind} · жин {s.weight} · {s._count.articles} нийтлэл
                    {s.lastFetchedAt && ` · ${fmtDate(s.lastFetchedAt)}`}
                  </span>
                  <span className="ml-auto flex gap-2">
                    {s.listUrl && (
                      <form action={testSourceAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className={btn}>Татаж үзэх</button>
                      </form>
                    )}
                    <form action={fetchSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className={btn}>Одоо татах</button>
                    </form>
                    <Link href={open ? "/admin/mongol" : `/admin/mongol?open=${s.id}`} className={btn}>
                      {open ? "хаах" : "засах"}
                    </Link>
                  </span>
                </div>

                {s.lastError && (
                  <pre className="px-3 pb-2 text-xs text-muted whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {s.lastError}
                  </pre>
                )}

                {open && (
                  <form action={saveSourceAction} className="border-t border-line p-3 space-y-2">
                    <input type="hidden" name="id" value={s.id} />
                    <p className="text-xs text-muted">
                      {s.url}
                      {s.feedUrl && ` · RSS: ${s.feedUrl}`}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <label className="text-xs text-muted space-y-1">
                        <span>Жагсаалтын хуудас (listUrl)</span>
                        <input name="listUrl" defaultValue={s.listUrl ?? ""} className={input} />
                      </label>
                      <label className="text-xs text-muted space-y-1">
                        <span>CSS selector (жишээ: article a)</span>
                        <input name="linkSelector" defaultValue={s.linkSelector ?? ""} className={input} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-4 items-end">
                      <label className="text-xs text-muted space-y-1">
                        <span>Жин 1–10</span>
                        <input name="weight" defaultValue={s.weight} className={`${input} w-20`} inputMode="numeric" />
                      </label>
                      <label className="flex gap-2 items-center text-xs text-muted pb-1">
                        <input type="checkbox" name="isActive" defaultChecked={s.isActive} className="accent-accent" />
                        <span>Идэвхтэй</span>
                      </label>
                      <button className={`${btn} ml-auto`}>Хадгалах</button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Монголын AI төсөл, компаниуд {projects.length}</h2>
        <ul className="space-y-1.5">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm rounded border border-line p-2.5">
              {p.isFeatured && <span className="text-xs text-accent">★</span>}
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted">{p.category}</span>
              <span className="text-xs text-muted break-all">{p.website}</span>
              <span className="ml-auto flex gap-2">
                <Link href={`/admin/mongol?project=${p.id}`} className={btn}>засах</Link>
                <form action={deleteProjectAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className={`${btn} border-down/50 text-down`}>устгах</button>
                </form>
              </span>
            </li>
          ))}
        </ul>

        <form action={saveProjectAction} className="rounded-lg border border-line p-3 space-y-2">
          <p className="text-xs font-semibold">{full ? `${full.name}-ыг засах` : "Шинэ төсөл нэмэх"}</p>
          {full && <input type="hidden" name="id" value={full.id} />}
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-xs text-muted space-y-1">
              <span>Нэр</span>
              <input name="name" defaultValue={full?.name ?? ""} required className={input} />
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>Вэбсайт</span>
              <input name="website" defaultValue={full?.website ?? ""} required className={input} />
            </label>
          </div>
          <label className="block text-xs text-muted space-y-1">
            <span>Тайлбар (1–2 өгүүлбэр)</span>
            <textarea name="description" defaultValue={full?.description ?? ""} rows={3} className={input} />
          </label>
          <div className="flex flex-wrap gap-4 items-end">
            <label className="text-xs text-muted space-y-1">
              <span>Ангилал</span>
              <input name="category" defaultValue={full?.category ?? ""} className={input} placeholder="Хэлний технологи" />
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>Дараалал</span>
              <input name="order" defaultValue={full?.order ?? 0} className={`${input} w-20`} inputMode="numeric" />
            </label>
            <label className="flex gap-2 items-center text-xs text-muted pb-1">
              <input type="checkbox" name="isFeatured" defaultChecked={full?.isFeatured ?? false} className="accent-accent" />
              <span>Онцлох</span>
            </label>
            <label className="flex gap-2 items-center text-xs text-muted pb-1">
              <input type="checkbox" name="isActive" defaultChecked={full?.isActive ?? true} className="accent-accent" />
              <span>Идэвхтэй</span>
            </label>
            <button className={`${btn} ml-auto`}>{full ? "Хадгалах" : "Нэмэх"}</button>
          </div>
          {full && (
            <Link href="/admin/mongol" className="text-xs text-muted hover:text-ink">
              Шинэ төсөл нэмэх руу шилжих
            </Link>
          )}
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Сүүлийн дотоод нийтлэлүүд</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Дотоод нийтлэл алга.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-2 text-xs text-muted w-24">{a.status}</td>
                  <td className="py-1.5 pr-2">
                    {a.status === "PUBLISHED" ? (
                      <Link href={`/medee/${a.slug}`} className="hover:text-accent">
                        {a.titleMn ?? a.sourceTitle}
                      </Link>
                    ) : (
                      <Link href={`/admin/${a.id}`} className="hover:text-accent">
                        {a.titleMn ?? a.sourceTitle}
                      </Link>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-xs text-muted">{a.source.name}</td>
                  <td className="py-1.5 px-2 text-xs text-muted tabular-nums">{a.relevance || "—"}</td>
                  <td className="py-1.5 pl-2 text-xs text-muted text-right">{fmtDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
