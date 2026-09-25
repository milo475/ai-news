import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import { CATEGORY_LABEL } from "@/agent/category";
import { MAX_IG_ATTEMPTS } from "@/publish/instagram.api";
import {
  postArticleToFacebook, postArticleToInstagram, regenerateFbImage, regenerateFbText, rejectArticle,
  rewriteArticle, saveAndPublishArticle, saveArticle, saveFbText,
} from "../actions";

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
          {a.status} · {CATEGORY_LABEL[a.category]} · оноо {a.relevance || "—"} · {a.tokensUsed} токен
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

          <section className="rounded-lg border border-line p-3 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs text-muted">Facebook</p>
              {a.fbHookType && <span className="text-xs text-muted">hook: {a.fbHookType}</span>}
            </div>

            {a.fbPostedAt || a.fbPostId ? (
              <p className="text-xs text-up">
                ✓ {a.fbPostedAt ? fmtDate(a.fbPostedAt) : "постлосон"}
                {a.fbPostId && (
                  <a
                    href={`https://facebook.com/${a.fbPostId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-accent hover:underline"
                  >
                    пост →
                  </a>
                )}
              </p>
            ) : a.status === "PUBLISHED" ? (
              <p className="text-xs text-muted">хүлээгдэж байна (дараалалд)</p>
            ) : (
              <p className="text-xs text-muted">нийтлэгдсэний дараа дараалалд орно</p>
            )}
            {a.fbAttempts > 0 && (
              <p className="text-xs text-down break-words">
                {a.fbAttempts} удаа алдаа{a.fbError ? `: ${a.fbError}` : ""}
              </p>
            )}

            {/* Карт (текст давхарласан) ба суурь зураг */}
            {a.fbImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${a.fbImageUrl}?v=${a.fbImageAt?.getTime() ?? 0}`}
                alt="Постын карт"
                className="w-full rounded border border-line"
              />
            ) : (
              <p className="text-xs text-muted">Карт үүсээгүй — постлохын өмнө автоматаар үүснэ.</p>
            )}
            {a.heroImageUrl && (
              <details>
                <summary className="text-xs text-accent cursor-pointer">Тексгүй суурь зураг</summary>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${a.heroImageUrl}?v=${a.fbImageAt?.getTime() ?? 0}`}
                  alt="Суурь зураг"
                  className="w-full rounded border border-line mt-1"
                />
              </details>
            )}

            {/* Headline — карт дээрх текст */}
            <form action={regenerateFbImage} className="space-y-2">
              <input type="hidden" name="id" value={a.id} />
              <label className="block space-y-1">
                <span className="text-xs text-muted">Картын гарчиг (headline)</span>
                <textarea
                  name="fbHook"
                  rows={3}
                  defaultValue={a.fbHook ?? ""}
                  placeholder="Хоосон бол LLM өөрөө бичнэ"
                  className={`${input} text-xs`}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  name="keepPhoto"
                  value="1"
                  className="text-xs rounded border border-line px-2 py-1 hover:bg-line/40"
                >
                  Картыг дахин үүсгэх
                </button>
                <button className="text-xs rounded border border-line px-2 py-1 hover:bg-line/40">
                  Зураг ч дахин үүсгэх
                </button>
                {a.fbImageKind && <span className="text-xs text-muted">({a.fbImageKind})</span>}
              </div>
            </form>
            {a.fbImagePrompt && (
              <details>
                <summary className="text-xs text-accent cursor-pointer">Зургийн prompt</summary>
                <p className="text-xs text-muted pt-1 break-words">{a.fbImagePrompt}</p>
              </details>
            )}

            {/* FB текст — гараар засаж болно */}
            <form action={saveFbText} className="space-y-2">
              <input type="hidden" name="id" value={a.id} />
              <label className="block space-y-1">
                <span className="text-xs text-muted">FB текст</span>
                <textarea
                  name="fbText"
                  rows={10}
                  defaultValue={a.fbText ?? ""}
                  placeholder="Хоосон бол постлохын өмнө автоматаар бичигдэнэ"
                  className={`${input} text-xs`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="text-xs rounded border border-line px-2 py-1 hover:bg-line/40">
                  Текст хадгалах
                </button>
                <button
                  formAction={regenerateFbText}
                  className="text-xs rounded border border-line px-2 py-1 hover:bg-line/40"
                >
                  Дахин бичүүлэх (2 хувилбар)
                </button>
              </div>
            </form>
            {a.fbTextAlt && (
              <details>
                <summary className="text-xs text-accent cursor-pointer">Нөөц хувилбар (A/B)</summary>
                <p className="text-xs whitespace-pre-wrap pt-1">{a.fbTextAlt}</p>
              </details>
            )}
          </section>

          <section className="rounded-lg border border-line p-3 space-y-2">
            <p className="text-xs text-muted">Instagram</p>
            {a.igPostedAt || a.igMediaId ? (
              <p className="text-xs text-up">
                ✓ {a.igPostedAt ? fmtDate(a.igPostedAt) : "постлосон"}
                {a.igMediaId && <span className="ml-2 text-muted font-mono">{a.igMediaId}</span>}
              </p>
            ) : !a.fbImageUrl ? (
              <p className="text-xs text-muted">зураггүй — IG зураггүй пост дэмждэггүй</p>
            ) : a.status === "PUBLISHED" ? (
              <p className="text-xs text-muted">хүлээгдэж байна (дараалалд)</p>
            ) : (
              <p className="text-xs text-muted">нийтлэгдсэний дараа дараалалд орно</p>
            )}
            {a.igAttempts > 0 && (
              <p className="text-xs text-down break-words">
                {a.igAttempts}/{MAX_IG_ATTEMPTS} оролдлого{a.igError ? `: ${a.igError}` : ""}
              </p>
            )}
            {a.status === "PUBLISHED" && !a.igMediaId && !a.igPostedAt && a.fbImageUrl && (
              <form action={postArticleToInstagram}>
                <input type="hidden" name="id" value={a.id} />
                <button className="text-xs rounded border border-accent/50 text-accent px-2 py-1 hover:bg-accent/10">
                  IG-д постлох
                </button>
              </form>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {a.status === "PUBLISHED" && !a.fbPostId && !a.fbPostedAt && (
              <form action={postArticleToFacebook}>
                <input type="hidden" name="id" value={a.id} />
                <button className="rounded border border-accent/50 text-accent px-3 py-2 text-sm hover:bg-accent/10">
                  Одоо FB-д постлох
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
