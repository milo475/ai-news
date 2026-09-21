import Link from "next/link";
import { prisma } from "@/db";
import { UseCaseIcon } from "@/components/UseCaseIcon";
import { createTool, linkTool, saveLink, saveUseCase, unlinkTool } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Хэрэглээ — админ" };

const input = "w-full rounded border border-line bg-transparent px-2 py-1 text-sm";
const btn = "rounded border border-line px-2.5 py-1 text-xs hover:bg-line/40";

export default async function AdminHereglee({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; msg?: string }>;
}) {
  const sp = await searchParams;

  const [cases, allTools] = await Promise.all([
    prisma.useCase.findMany({
      orderBy: { order: "asc" },
      include: {
        tools: {
          orderBy: { rank: "asc" },
          include: { tool: { select: { id: true, name: true, vendor: true, slug: true, isActive: true } } },
        },
      },
    }),
    prisma.aiTool.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, vendor: true } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Хэрэглээ</h1>
        </div>
        <p className="text-xs text-muted">
          {cases.length} ангилал · {allTools.length} хэрэгсэл
          {sp.msg && <span className="ml-2 text-accent">{sp.msg}</span>}
        </p>
      </div>

      {cases.map((c) => (
        <details key={c.id} open={sp.open === c.id} className="rounded-lg border border-line">
          <summary className="flex items-center gap-2 p-3 cursor-pointer">
            <span className="text-accent"><UseCaseIcon name={c.icon} size={18} /></span>
            <span className="font-medium">{c.nameMn}</span>
            <span className="text-xs text-muted">/{c.slug} · {c.tools.length} хэрэгсэл</span>
            {!c.isActive && <span className="text-xs text-down">идэвхгүй</span>}
          </summary>

          <div className="border-t border-line p-3 space-y-4">
            {/* Ангиллын талбарууд */}
            <form action={saveUseCase} className="grid sm:grid-cols-[1fr_2fr_5rem_auto_auto] gap-2 items-end">
              <input type="hidden" name="useCaseId" value={c.id} />
              <label className="block space-y-1">
                <span className="text-xs text-muted">Нэр</span>
                <input name="nameMn" defaultValue={c.nameMn} className={input} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Тайлбар</span>
                <input name="descriptionMn" defaultValue={c.descriptionMn} className={input} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Дараалал</span>
                <input name="order" type="number" defaultValue={c.order} className={input} />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted pb-1.5">
                <input type="checkbox" name="isActive" defaultChecked={c.isActive} /> идэвхтэй
              </label>
              <button className={btn}>Хадгалах</button>
            </form>

            {/* Хэрэгслүүд */}
            <ul className="space-y-2">
              {c.tools.map((t) => (
                <li key={t.toolId} className="rounded border border-line p-2">
                  <form action={saveLink} className="grid sm:grid-cols-[3.5rem_1fr_2fr_auto_auto] gap-2 items-end">
                    <input type="hidden" name="useCaseId" value={c.id} />
                    <input type="hidden" name="toolId" value={t.toolId} />
                    <label className="block space-y-1">
                      <span className="text-xs text-muted">Эрэмбэ</span>
                      <input name="rank" type="number" defaultValue={t.rank} className={input} />
                    </label>
                    <div className="text-sm pb-1.5">
                      <span className="font-medium">{t.tool.name}</span>{" "}
                      <span className="text-muted text-xs">{t.tool.vendor}</span>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs text-muted">Тэмдэглэл</span>
                      <input name="noteMn" defaultValue={t.noteMn ?? ""} className={input} />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted pb-1.5">
                      <input type="checkbox" name="isActive" defaultChecked={t.tool.isActive} /> идэвхтэй
                    </label>
                    <button className={btn}>Хадгалах</button>
                  </form>
                  <form action={unlinkTool} className="mt-1">
                    <input type="hidden" name="useCaseId" value={c.id} />
                    <input type="hidden" name="toolId" value={t.toolId} />
                    <button className="text-xs text-muted hover:text-down">салгах</button>
                  </form>
                </li>
              ))}
            </ul>

            {/* Байгаа хэрэгслийг холбох */}
            <form action={linkTool} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="useCaseId" value={c.id} />
              <label className="space-y-1">
                <span className="text-xs text-muted">Байгаа хэрэгсэл холбох</span>
                <select name="toolId" className={`${input} min-w-56`} defaultValue="">
                  <option value="">— сонгох —</option>
                  {allTools.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.vendor})</option>
                  ))}
                </select>
              </label>
              <button className={btn}>Холбох</button>
            </form>

            {/* Шинэ хэрэгсэл */}
            <details className="rounded border border-dashed border-line p-2">
              <summary className="text-xs text-muted cursor-pointer">Шинэ хэрэгсэл нэмэх</summary>
              <form action={createTool} className="grid sm:grid-cols-3 gap-2 items-end pt-2">
                <input type="hidden" name="useCaseId" value={c.id} />
                <label className="space-y-1"><span className="text-xs text-muted">slug</span><input name="slug" className={input} /></label>
                <label className="space-y-1"><span className="text-xs text-muted">Нэр</span><input name="name" className={input} /></label>
                <label className="space-y-1"><span className="text-xs text-muted">Гаргагч</span><input name="vendor" className={input} /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs text-muted">Хаяг</span><input name="url" className={input} /></label>
                <label className="space-y-1">
                  <span className="text-xs text-muted">Үнэ</span>
                  <select name="pricing" className={input} defaultValue="FREEMIUM">
                    <option value="FREE">Үнэгүй</option>
                    <option value="FREEMIUM">Үнэгүй + төлбөртэй</option>
                    <option value="PAID">Төлбөртэй</option>
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs text-muted">Тайлбар</span><input name="descriptionMn" className={input} /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs text-muted">Тэмдэглэл (энэ ангилалд)</span><input name="noteMn" className={input} /></label>
                <label className="flex items-center gap-1.5 text-xs text-muted pb-1.5">
                  <input type="checkbox" name="worksInMongolian" defaultChecked /> монголоор ажилладаг
                </label>
                <button className={btn}>Нэмэх</button>
              </form>
            </details>
          </div>
        </details>
      ))}
    </div>
  );
}
