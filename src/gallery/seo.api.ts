/**
 * Картын JSON-LD (цэвэр).
 */
import { CARD_H, CARD_W } from "./card.api";

export interface CardSeoInput {
  slug: string;
  hook: string;
  titleMn: string;
  summaryMn: string;
  publishedAt: Date | null;
  cardAt: Date | null;
  articleId: string;
}

/** schema.org ImageObject — карт нь бие даасан зураг */
export function imageJsonLd(c: CardSeoInput, siteUrl: string): Record<string, unknown> {
  const site = siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: c.hook,
    description: c.summaryMn || c.titleMn,
    contentUrl: `${site}/api/fb-image/${c.articleId}`,
    url: `${site}/barimt/${c.slug}`,
    width: CARD_W,
    height: CARD_H,
    encodingFormat: "image/jpeg",
    inLanguage: "mn",
    creditText: "AI News",
    creator: { "@type": "Organization", name: "AI News", url: site },
    copyrightNotice: "AI News",
    license: `${site}/barimt`,
    acquireLicensePage: `${site}/barimt`,
    ...(c.publishedAt ? { datePublished: c.publishedAt.toISOString() } : {}),
    ...(c.cardAt ? { uploadDate: c.cardAt.toISOString() } : {}),
    // Картыг дарвал мэдээ рүү орно
    associatedArticle: {
      "@type": "NewsArticle",
      headline: c.titleMn,
      url: `${site}/medee/${c.slug}`,
    },
  };
}
