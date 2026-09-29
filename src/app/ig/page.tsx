import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/db";
import { siteUrl } from "@/lib/site";
import { personas } from "@/studio/personas";
import { BIO_LINKS } from "@/studio/bio.api";

/**
 * «Link in bio» — Instagram-аас ирэх хүмүүст зориулсан мобайл хуудас.
 *
 * IG нь постын комментод тавьсан холбоосыг дардаг тул bio-д ганц холбоос
 * тавьж, түүнээсээ салаалуулна. Эндээс гарах БҮХ холбоос `utm_source=instagram`
 * дамжуулна — студийн сесс IG-ээс ирснийг танина.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "AI News — холбоосууд",
  description: "Instagram-аас ирсэн бол сүүлийн мэдээ, промпт студийн жишээг эндээс.",
  // Энэ хуудас нь навигацийн туслах — хайлтад орох шаардлагагүй
  robots: { index: false, follow: true },
};

/** Сүүлийн 6 пост — мэдээ ба долоо хоногийн промпт */
async function recent() {
  return prisma.article.findMany({
    where: { status: "PUBLISHED", igPostedAt: { not: null } },
    orderBy: { igPostedAt: "desc" },
    take: 6,
    select: { slug: true, titleMn: true, fbHook: true, id: true, fbImageAt: true, category: true },
  });
}

const UTM = "utm_source=instagram&utm_campaign=bio";

export default async function BioPage() {
  const posts = await recent();
  const site = siteUrl();

  return (
    <div className="mx-auto max-w-md space-y-6 px-1 py-2">
      <header className="space-y-1 text-center">
        <h1 className="text-lg font-semibold">AI News</h1>
        <p className="text-sm text-muted">
          Хиймэл оюуны мэдээ монголоор. Доороос сонирхсоноо нээнэ үү.
        </p>
      </header>

      <Link
        href={`/prompt/studio?${UTM}`}
        className="block rounded-lg border border-accent/60 bg-accent/10 p-4 text-center"
      >
        <p className="text-base font-semibold text-accent">Промпт студи</p>
        <p className="mt-1 text-sm text-muted">
          Хүсэлтээ монголоор бич — бэлэн промпт, алхам бүрийн тайлбар гарна
        </p>
      </Link>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Мэргэжлээрээ эхлэх</h2>
        <div className="grid grid-cols-2 gap-2">
          {personas().map((p) => (
            <Link
              key={p.slug}
              href={`/prompt/studio/m/${p.slug}?${UTM}`}
              className="rounded border border-line px-3 py-2.5 text-center text-sm hover:border-accent"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </section>

      {posts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Сүүлийн постууд</h2>
          <ul className="space-y-2">
            {posts.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/medee/${a.slug}?${UTM}`}
                  className="flex items-center gap-3 rounded-lg border border-line p-2 hover:border-accent"
                >
                  {a.fbImageAt && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${site}/api/fb-image/${a.id}?v=${a.fbImageAt.getTime()}`}
                      alt=""
                      width={64}
                      height={80}
                      loading="lazy"
                      className="h-20 w-16 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="min-w-0 text-sm">
                    <span className="line-clamp-3">{a.fbHook ?? a.titleMn}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="grid grid-cols-2 gap-2 border-t border-line pt-4">
        {BIO_LINKS.map((l) => (
          <Link
            key={l.href}
            href={`${l.href}?${UTM}`}
            className="rounded border border-line px-3 py-2.5 text-center text-sm text-muted hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
