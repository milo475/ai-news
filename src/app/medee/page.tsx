import Link from "next/link";
import { getNews } from "@/data";
import { NewsList } from "@/components/NewsList";

export const revalidate = 600;
export const metadata = { title: "Мэдээ" };

const PER_PAGE = 20;

export default async function Medee({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, total } = await getNews(page, PER_PAGE);
  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Мэдээ</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-sm text-muted">
          Мэдээний хэсэг бэлтгэгдэж байна. Agent эх сурвалжуудаас мэдээ цуглуулж, монгол хэлээр хураангуйлан
          энд нийтлэх болно.
        </div>
      ) : (
        <>
          <NewsList items={items} />
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
