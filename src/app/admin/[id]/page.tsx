import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import { postArticleToFacebook, rejectArticle, rewriteArticle, saveAndPublishArticle, saveArticle } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Нийтлэл засах" };

const input = "w-full rounded border border-line bg-transparent px-3 py-2 text-sm";

export default async function Edit({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id } = await params;
  const err = (await searchParams).err;
  const a = await prisma.article.findUnique({
    where: { id },
    include: { source: true, models: { select: { slug: true, name: true } }, companies: { select: { name: true } } },
  });
  if (!a) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <Link href={`/admin?status=${a.status}`} className="text-sm text-muted hover:text-ink">← Админ</Link>
        <span className="text-xs text-muted">
          {a.status} · оноо {a.relevance || "—"} · {a.tokensUsed} токен
        </span>
      </div>

      {err && (
        <p className="rounded border border-down/50 text-down text-sm px-3 py-2 break-words">{err}</p>
      )}

      <div className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
        <form action={saveArticle} className="space-y-3">
          <input type="hidden" name="id" value={a.id} />

          <label className="block space-y-1">
            <span className="text-xs text-muted">Гарчиг</span>
            <input name="titleMn" defaultValue={a.titleMn ?? ""} className={input} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">Хураангуй</span>
            <textarea name="summaryMn" rows={3} defaultValue={a.summaryMn ?? ""} className={input} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">Үндсэн текст (markdown)</span>
            <textarea name="bodyMn" rows={18} defaultValue={a.bodyMn ?? ""} className={`${input} font-mono`} />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Шошго (таслалаар)</span>
              <input name="tags" defaultValue={a.tags.join(", ")} className={input} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Slug</span>
              <input name="slug" defaultValue={a.slug} className={`${input} font-mono`} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button className="rounded border border-line px-3 py-2 text-sm hover:bg-line/40">Хадгалах</button>
            <button formAction={saveAndPublishArticle} className="rounded border border-up/50 text-up px-3 py-2 text-sm hover:bg-up/10">
              Хадгалаад нийтлэх
            </button>
          </div>
        </form>

        <aside className="space-y-4 text-sm">
          <section className="rounded-lg border border-line p-3 space-y-2">
            <p className="text-xs text-muted">Эх мэдээлэл</p>
            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline block">
              {a.sourceTitle}
            </a>
            <p className="text-muted text-xs">
              {a.source.name} (жин {a.source.weight}) · {fmtDate(a.publishedAtSource)}
            </p>
            {a.scoreReason && <p className="text-xs">{a.scoreReason}</p>}
            {(a.models.length > 0 || a.companies.length > 0) && (
              <p className="text-xs text-muted">
                Холбоос: {[...a.models.map((m) => m.name), ...a.companies.map((c) => c.name)].join(", ")}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-line p-3 space-y-2">
            <p className="text-xs text-muted">
              Бүтэн текст {a.sourceText ? `(${a.sourceText.length} тэмдэгт)` : "— олдоогүй, RSS хураангуй:"}
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-wrap">
              {(a.sourceText ?? a.sourceExcerpt ?? "—").slice(0, 1500)}
            </p>
            {a.sourceText && a.sourceText.length > 1500 && (
              <details>
                <summary className="text-xs text-accent cursor-pointer">Бүтнээр харах</summary>
                <p className="text-xs leading-relaxed whitespace-pre-wrap pt-2">{a.sourceText}</p>
              </details>
            )}
          </section>

          {a.fbPostId && (
            <a
              href={`https://facebook.com/${a.fbPostId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-accent hover:underline"
            >
              Facebook пост →
            </a>
          )}

          <div className="flex flex-wrap gap-2">
            {a.status === "PUBLISHED" && !a.fbPostId && (
              <form action={postArticleToFacebook}>
                <input type="hidden" name="id" value={a.id} />
                <button className="rounded border border-accent/50 text-accent px-3 py-2 text-sm hover:bg-accent/10">
                  Facebook-т постлох
                </button>
              </form>
            )}
            <form action={rewriteArticle}>
              <input type="hidden" name="id" value={a.id} />
              <button className="rounded border border-line px-3 py-2 text-sm hover:bg-line/40">Дахин бичүүлэх</button>
            </form>
            <form action={rejectArticle}>
              <input type="hidden" name="id" value={a.id} />
              <button className="rounded border border-line text-muted px-3 py-2 text-sm hover:bg-line/40">Хаях</button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
