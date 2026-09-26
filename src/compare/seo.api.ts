/**
 * Харьцуулалтын SEO — цэвэр.
 */
import type { CompareStats } from "./pair.api";

/** «GPT-5.1 vs Gemini 4 — аль нь дээр вэ? (2026)» */
export function compareTitle(a: string, b: string, year = new Date().getFullYear()): string {
  return `${a} vs ${b} — аль нь дээр вэ? (${year})`;
}

export function compareDescription(a: CompareStats, b: CompareStats): string {
  const parts: string[] = [];
  if (a.mnScore !== null && b.mnScore !== null) {
    parts.push(`Монгол хэлний оноо ${a.mnScore.toFixed(2)} vs ${b.mnScore.toFixed(2)}`);
  }
  if (a.outputPricePerM !== null && b.outputPricePerM !== null) {
    parts.push(`гаралтын үнэ $${a.outputPricePerM} vs $${b.outputPricePerM}`);
  }
  const head = `${a.name} ба ${b.name}-ийг хэмжсэн өгөгдлөөр харьцуулав`;
  return parts.length > 0 ? `${head}: ${parts.join(", ")}.` : `${head}.`;
}

/** ItemList дотор хоёр моделийг Product болгож тавина */
export function compareJsonLd(a: CompareStats, b: CompareStats, url: string): Record<string, unknown> {
  const product = (m: CompareStats): Record<string, unknown> => ({
    "@type": "Product",
    name: m.name,
    brand: { "@type": "Organization", name: m.company },
    category: "AI model",
    // Гаралтын тарифыг үнэ болгож үзүүлнэ; мэдэгдэхгүй бол offers огт бичихгүй
    ...(m.outputPricePerM !== null
      ? {
          offers: {
            "@type": "Offer",
            price: m.outputPricePerM,
            priceCurrency: "USD",
            description: "1 сая гаралтын токены үнэ",
          },
        }
      : {}),
    ...(m.mnScore !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: m.mnScore,
            bestRating: 10,
            worstRating: 0,
            ratingCount: 1,
            reviewAspect: "Монгол хэлний бенчмарк",
          },
        }
      : {}),
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${a.name} vs ${b.name}`,
    url,
    numberOfItems: 2,
    inLanguage: "mn",
    itemListElement: [
      { "@type": "ListItem", position: 1, item: product(a) },
      { "@type": "ListItem", position: 2, item: product(b) },
    ],
  };
}
