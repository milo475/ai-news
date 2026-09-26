/**
 * Схемийн (schema.org) JSON-LD бүтээгчид — цэвэр функцууд, DB-гүй.
 *
 * Сайт даяар нэг ижил Organization / WebSite объект гарах ёстой: Google эдгээрийг
 * @id-гээр нь холбож, брэндийн мэдээллийг нэгтгэдэг.
 */

/** Байгууллагын тогтмол @id — бусад схем үүн рүү заана */
export function orgId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

export function siteId(siteUrl: string): string {
  return `${siteUrl}/#website`;
}

export interface OrgInput {
  siteUrl: string;
  /** Нийгмийн сүлжээний хуудсууд — sameAs */
  sameAs?: string[];
  email?: string;
}

export function organizationJsonLd(input: OrgInput): Record<string, unknown> {
  const { siteUrl, sameAs = [], email } = input;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId(siteUrl),
    name: "AI News",
    alternateName: "AI Мэдээ",
    url: `${siteUrl}/`,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/icon.svg`,
      width: 512,
      height: 512,
    },
    description:
      "Дэлхийн хиймэл оюуны мэдээ, моделийн жагсаалт, хэрэгслийн каталог — монгол хэлээр.",
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(email ? { email } : {}),
  };
}

/** WebSite + SearchAction — Google-ийн sitelinks searchbox */
export function websiteJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": siteId(siteUrl),
    url: `${siteUrl}/`,
    name: "AI News",
    inLanguage: "mn-MN",
    publisher: { "@id": orgId(siteUrl) },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/hailt?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface Crumb {
  name: string;
  /** Сайтын дотоод зам ("/medee"). Сүүлчийнх нь (одоогийн хуудас) зам-гүй байж болно */
  path?: string;
}

/**
 * BreadcrumbList. Эхэнд нь "Нүүр"-ийг автоматаар нэмнэ.
 * Сүүлийн элемент нь одоогийн хуудас — item-гүй байж болно (Google зөвшөөрдөг).
 */
export function breadcrumbJsonLd(siteUrl: string, crumbs: Crumb[]): Record<string, unknown> {
  const all: Crumb[] = [{ name: "Нүүр", path: "/" }, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: `${siteUrl}${c.path === "/" ? "/" : c.path}` } : {}),
    })),
  };
}

export interface NewsArticleInput {
  siteUrl: string;
  slug: string;
  title: string;
  description: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  imageUrl?: string | null;
  /** Эх сурвалжийн нэр, холбоос — citation */
  sourceName?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
}

function iso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

export function newsArticleJsonLd(n: NewsArticleInput): Record<string, unknown> {
  const url = `${n.siteUrl}/medee/${n.slug}`;
  const published = iso(n.publishedAt);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: n.title.slice(0, 110),
    description: n.description,
    inLanguage: "mn-MN",
    ...(published ? { datePublished: published } : {}),
    ...(iso(n.updatedAt) ? { dateModified: iso(n.updatedAt) } : {}),
    // Хураангуйг AI agent бэлтгэж, редактор хянадаг — зохиогч нь байгууллага өөрөө
    author: { "@id": orgId(n.siteUrl) },
    publisher: { "@id": orgId(n.siteUrl) },
    ...(n.imageUrl
      ? { image: { "@type": "ImageObject", url: n.imageUrl, width: 1200, height: 630 } }
      : {}),
    ...(n.tags && n.tags.length > 0 ? { keywords: n.tags.join(", ") } : {}),
    ...(n.sourceName && n.sourceUrl
      ? { citation: { "@type": "CreativeWork", name: n.sourceName, url: n.sourceUrl } }
      : {}),
  };
}

/** Энгийн жагсаалтын хуудсанд — CollectionPage */
export function collectionJsonLd(input: {
  siteUrl: string;
  path: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: `${input.siteUrl}${input.path}`,
    name: input.name,
    description: input.description,
    inLanguage: "mn-MN",
    isPartOf: { "@id": siteId(input.siteUrl) },
    publisher: { "@id": orgId(input.siteUrl) },
  };
}
