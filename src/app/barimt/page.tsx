import Link from "next/link";
import { CardGallery } from "@/components/CardGallery";
import { TrackEvent } from "@/components/Track";
import { CATEGORIES, CATEGORY_LABEL } from "@/agent/category";
import { parseCategory, sharePlatforms } from "@/gallery/card.api";
import { cardCategories, cardPage, weeklyBestCards } from "@/gallery/queries";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import { fmtDate } from "@/components/format";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "AI News-ийн өдөр тутмын баримтын картууд — нэг зурагт нэг баримт. Татаж, хуваалцаж, " +
  "өөрийн сайтдаа тавьж болно.";

export const metadata = {
  title: "Өдрийн баримт",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/barimt` },
};

export default async function BarimtPage({
  searchParams,
}: {
  searchParams: Promise<{ angilal?: string }>;
}) {
  const sp = await searchParams;
  const category = parseCategory(sp.angilal, CATEGORIES);

  const [page, groups, best] = await Promise.all([
    cardPage({ category }),
    cardCategories(),
    weeklyBestCards(3),
  ]);

  const site = siteUrl();
  const platforms = sharePlatforms();
  const appId = process.env.FB_APP_ID?.trim() || undefined;

  return (
    <div className="space-y-6">
      {category && <TrackEvent event="card_filter" data={{ category }} />}

      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Өдрийн баримт</h1>
        <p className="text-muted max-w-2xl">{DESCRIPTION}</p>
      </section>

      {best.length > 0 && !category && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Долоо хоногийн шилдэг</h2>
          <ul className="grid grid-cols-3 gap-3 max-w-md">
            {best.map((c) => (
              <li key={c.id}>
                <Link href={`/barimt/${c.slug}`} className="block group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/fb-image/${c.id}`}
                    alt={c.hook}
                    width={1080}
                    height={1350}
                    className="w-full aspect-4/5 object-cover rounded-lg border border-line group-hover:border-accent/50"
                  />
                  <p className="mt-1 text-xs text-muted line-clamp-2">{c.hook}</p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Facebook дээрх reaction, хуваалцалт, эсвэл татсан тоогоор эрэмбэлэв.
          </p>
        </section>
      )}

      {groups.length > 0 && (
        <nav className="flex flex-wrap gap-1.5">
          <Link
            href="/barimt"
            className={`rounded-full border px-2.5 py-1 text-xs ${
              category ? "border-line text-muted hover:text-ink" : "border-accent text-accent"
            }`}
          >
            Бүгд <span className="tabular-nums">{groups.reduce((n, g) => n + g.count, 0)}</span>
          </Link>
          {groups.map((g) => (
            <Link
              key={g.category}
              href={category === g.category ? "/barimt" : `/barimt?angilal=${g.category}`}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                category === g.category ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
              }`}
            >
              {CATEGORY_LABEL[g.category]} <span className="tabular-nums">{g.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {page.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          {category ? "Энэ ангилалд карт алга." : "Карт удахгүй нэмэгдэнэ."}
        </div>
      ) : (
        <CardGallery
          initial={page.items}
          initialNext={page.next}
          category={category}
          siteOrigin={site}
          platforms={platforms}
          appId={appId}
        />
      )}

      <p className="text-xs text-muted border-t border-line pt-4">
        Эдгээр картыг AI News өдөр бүр Facebook, Instagram-д тавьдаг. Сайт дээрээ тавихыг
        хүсвэл карт бүрийн хуудаснаас «Embed код» авна уу — эх сурвалжийн холбоос автоматаар орно.
        {page.items[0]?.cardAt && ` Сүүлийн карт: ${fmtDate(page.items[0].cardAt)}.`}
      </p>
    </div>
  );
}
