import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsForUseCase, getUseCase, type UseCaseToolRow } from "@/data";
import { NewsList } from "@/components/NewsList";
import { UseCaseIcon } from "@/components/UseCaseIcon";
import { TrackEvent } from "@/components/Track";
import { ToolGrid } from "@/components/ToolList";
import { categoryForUseCase } from "@/tools/tool.api";
import { topToolsForCategory } from "@/tools/queries";

export const revalidate = 3600;

type Params = { slug: string };

const PRICING: Record<UseCaseToolRow["pricing"], string> = {
  FREE: "Үнэгүй",
  FREEMIUM: "Үнэгүй + төлбөртэй",
  PAID: "Төлбөртэй",
};

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const u = await getUseCase((await params).slug);
  if (!u) return { title: "Хэрэглээ" };
  return { title: u.nameMn, description: u.descriptionMn };
}

export default async function UseCasePage({ params }: { params: Promise<Params> }) {
  const u = await getUseCase((await params).slug);
  if (!u) notFound();
  const category = categoryForUseCase(u.slug);
  const [news, catalogTools] = await Promise.all([
    getNewsForUseCase(u.slug, u.nameMn, 5),
    category ? topToolsForCategory(category, 5) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <TrackEvent event="usecase_view" data={{ slug: u.slug }} />
      <div className="space-y-2 max-w-2xl">
        <Link href="/hereglee" className="text-sm text-muted hover:text-ink">← Хэрэглээ</Link>
        <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-semibold tracking-tight">
          <span className="text-accent"><UseCaseIcon name={u.icon} size={26} /></span>
          {u.nameMn}
        </h1>
        <p className="text-muted">{u.descriptionMn}</p>
      </div>

      <ul className="space-y-3">
        {u.tools.map((t) => (
          <li key={`${t.rank}-${t.name}`} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-muted tabular-nums text-sm">#{t.rank}</span>
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-muted">{t.vendor}</span>
            </div>
            <p className="text-sm mt-1">{t.descriptionMn}</p>
            {t.noteMn && <p className="text-sm text-muted mt-1">{t.noteMn}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs rounded px-1.5 py-0.5 border border-line text-muted">
                {PRICING[t.pricing]}
              </span>
              {t.worksInMongolian && (
                <span className="text-xs rounded px-1.5 py-0.5 border border-up/40 text-up">
                  монголоор ажилладаг
                </span>
              )}
              {t.url && (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener nofollow"
                  className="text-sm text-accent hover:underline ml-auto"
                >
                  Нээх →
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {catalogTools.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Каталогийн топ хэрэгслүүд</h2>
            <Link
              href={`/hereglel?angilal=${categoryForUseCase(u.slug)}`}
              className="text-sm text-accent hover:underline"
            >
              Бүх хэрэгсэл →
            </Link>
          </div>
          <p className="text-sm text-muted">
            Үнэ, монгол хэлний дэмжлэг, хэрэглэгчийн үнэлгээтэй бүрэн каталог.
          </p>
          <ToolGrid items={catalogTools} cols={2} />
        </section>
      )}

      {news.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Холбоотой мэдээ</h2>
          <NewsList items={news} />
        </section>
      )}

      <p className="text-xs text-muted border-t border-line pt-4">
        Энэ жагсаалтыг хүн бэлтгэсэн. «Монголоор ажилладаг» тэмдэг нь редакторын үнэлгээ —
        хэрэгслүүдийн чанар байнга өөрчлөгддөг тул өөрөө туршиж үзэхийг зөвлөе.
      </p>
    </div>
  );
}
