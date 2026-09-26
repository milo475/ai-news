import Link from "next/link";
import { currentUser } from "@/auth/session";
import { bookmarkedIds } from "@/bookmarks/queries";
import { getNews } from "@/data";
import { NewsList } from "@/components/NewsList";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

// Нэвтэрсэн хэрэглэгчийн хадгалсан төлөв хүн бүрт өөр тул кэшлэхгүй
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Мэдээ",
  description:
    "Дэлхийн хиймэл оюуны хамгийн сүүлийн мэдээ, монгол хэлээр товчлон найруулсан хураангуй — эх сурвалжийн холбоостой.",
  alternates: { canonical: "/medee" },
};

const PER_PAGE = 20;
/** Prisma-ийн skip нь int хязгаартай — хэтэрхий том page 500 өгөхөөс сэргийлнэ */
const MAX_PAGE = 10_000;

function pageNumber(raw: string | undefined): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export default async function Medee({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageNumber((await searchParams).page);
  const { items, total } = await getNews(page, PER_PAGE);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const user = await currentUser();
  const savedIds = user ? await bookmarkedIds(user.id, items.map((i) => i.id)) : undefined;

  return (
    <div className="space-y-4">
      <BreadcrumbLd crumbs={[{ name: "Мэдээ" }]} />
      <h1 className="text-2xl font-semibold tracking-tight">Мэдээ</h1>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-sm text-muted">
          Мэдээний хэсэг бэлтгэгдэж байна. Agent эх сурвалжуудаас мэдээ цуглуулж, монгол хэлээр хураангуйлан
          энд нийтлэх болно.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-sm text-muted">
          Энэ хуудсанд мэдээ алга. <Link href="/medee" className="text-accent hover:underline">Эхний хуудас →</Link>
        </div>
      ) : (
        <>
          <NewsList items={items} savedIds={savedIds} path={`/medee?page=${page}`} />
          {pages > 1 && (
            <nav className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={`/medee?page=${page - 1}`} className="text-accent hover:underline">← Өмнөх</Link>
              ) : <span />}
              <span className="text-muted">{page} / {pages}</span>
              {page < pages ? (
                <Link href={`/medee?page=${page + 1}`} className="text-accent hover:underline">Дараах →</Link>
              ) : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
