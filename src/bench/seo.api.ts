/**
 * Бенчмаркийн JSON-LD (цэвэр).
 */
import { monthLabel } from "./summary.api";

export interface DatasetInput {
  month: string;
  siteUrl: string;
  rows: { rank: number; name: string; company: string; avgScore: number }[];
  taskCount: number;
  finishedAt: Date | null;
}

/** schema.org Dataset — хэмжилтийн өгөгдөл */
export function datasetJsonLd(d: DatasetInput): Record<string, unknown> {
  const site = d.siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Монгол хэлээр хамгийн сайн AI модель — ${monthLabel(d.month)}`,
    description:
      `${d.rows.length} хиймэл оюуны моделийг монгол хэлний ${d.taskCount} бодит даалгавраар ` +
      "тестэлсэн үр дүн: орчуулга, товчлол, албан бичиг, тоон бодлого, монгол соёл.",
    url: `${site}/benchmark`,
    inLanguage: "mn",
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: "AI News", url: site },
    ...(d.finishedAt ? { dateModified: d.finishedAt.toISOString() } : {}),
    variableMeasured: [
      { "@type": "PropertyValue", name: "Нийт оноо", description: "0–10, жигнэсэн дундаж" },
      { "@type": "PropertyValue", name: "Хурд", unitText: "ms" },
      { "@type": "PropertyValue", name: "Монгол 1000 үгийн үнэ", unitText: "USD" },
    ],
  };
}

/** Эрэмбийн хүснэгт — ItemList (Google-ийн ойлгодог хэлбэр) */
export function tableJsonLd(d: DatasetInput): Record<string, unknown> {
  const site = d.siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Монгол хэлний бенчмарк — ${monthLabel(d.month)}`,
    numberOfItems: d.rows.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: d.rows.map((r) => ({
      "@type": "ListItem",
      position: r.rank,
      name: r.name,
      url: `${site}/benchmark`,
      item: {
        "@type": "SoftwareApplication",
        name: r.name,
        applicationCategory: "AI model",
        ...(r.company ? { publisher: { "@type": "Organization", name: r.company } } : {}),
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: r.avgScore,
          bestRating: 10,
          worstRating: 0,
          ratingCount: d.taskCount,
        },
      },
    })),
  };
}
