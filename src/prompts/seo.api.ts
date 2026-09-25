/**
 * Prompt-ын JSON-LD (цэвэр).
 */
export interface PromptSeoInput {
  slug: string;
  title: string;
  description: string;
  body: string;
  authorName: string | null;
  isSite: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}

/** schema.org CreativeWork — prompt нь нийтлэл ч биш, програм ч биш */
export function promptJsonLd(p: PromptSeoInput, siteUrl: string): Record<string, unknown> {
  const site = siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: p.title,
    description: p.description,
    text: p.body,
    inLanguage: "mn",
    url: `${site}/prompt/${p.slug}`,
    genre: "AI prompt",
    isAccessibleForFree: true,
    author: { "@type": p.isSite ? "Organization" : "Person", name: p.isSite ? "AI News" : (p.authorName ?? "Хэрэглэгч") },
    publisher: { "@type": "Organization", name: "AI News", url: site },
    ...(p.publishedAt ? { datePublished: p.publishedAt.toISOString() } : {}),
    dateModified: p.updatedAt.toISOString(),
  };
}
