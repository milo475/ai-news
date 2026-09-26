import Link from "next/link";
import { getLatestNews } from "@/data";
import { MIN_QUERY } from "@/lib/search-query";

/**
 * Брэндлэгдсэн 404.
 *
 * Хэрэглэгчийг буцаалгүй сайт дотор үлдээх нь зорилго: хайлтын талбар + сүүлийн
 * мэдээ + гол хэсгүүдийн холбоос. Мэдээ татаж чадахгүй бол (build үед DB байхгүй
 * байж болно) зүгээр л холбоосуудаа үзүүлнэ.
 */
export const revalidate = 3_600;

const SECTIONS = [
  { href: "/medee", label: "Мэдээ", note: "Дэлхийн AI мэдээ, өдөр бүр" },
  { href: "/zaavar", label: "Заавар", note: "AI-г хэрхэн ашиглах гарын авлага" },
  { href: "/prompt", label: "Prompt сан", note: "Монгол хэлний бэлэн prompt-ууд" },
  { href: "/hereglel", label: "Хэрэгсэл", note: "AI хэрэгслийн каталог" },
  { href: "/jagsaalt", label: "Жагсаалт", note: "Моделиудын өдөр тутмын эрэмбэ" },
  { href: "/songolt", label: "Надад ямар AI тохирох вэ?", note: "5 асуулт, 1 минут" },
];

async function latest() {
  try {
    return await getLatestNews(4);
  } catch {
    return [];
  }
}

export default async function NotFound() {
  const news = await latest();

  return (
    <div className="max-w-2xl space-y-8 py-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">Ийм хуудас олдсонгүй</h1>
        <p className="text-muted">
          Холбоос хуучирсан эсвэл буруу бичигдсэн байж магадгүй. Доороос хайж үзнэ үү.
        </p>
      </div>

      <form action="/hailt" method="get" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          minLength={MIN_QUERY}
          required
          placeholder="Юу хайж байна вэ?"
          aria-label="Сайтаас хайх"
          className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Хайх
        </button>
      </form>

      {news.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Сүүлийн мэдээ</h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {news.map((n) => (
              <li key={n.slug} className="p-3 hover:bg-line/30">
                <Link href={`/medee/${n.slug}`} className="text-sm font-medium hover:text-accent">
                  {n.titleMn}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Сайтын хэсгүүд</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="block rounded-lg border border-line p-3 hover:border-accent"
              >
                <span className="text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-muted">{s.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
