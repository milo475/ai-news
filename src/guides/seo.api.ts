/**
 * SEO — JSON-LD ба sitemap-ийн цэвэр бүтээгчид (DB, Next-гүй тул тесттэй).
 */
import { howToSteps } from "./markdown.api";

/** <title> — хэт урт бол Google таслана */
export const MAX_META_TITLE = 60;
/** <meta description> */
export const MAX_META_DESCRIPTION = 155;

/** Үгийн дунд таслахгүй, "…" залгана */
export function clamp(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[.,;:—-]+$/, "")}…`;
}

export interface GuideSeoInput {
  slug: string;
  title: string;
  lead: string;
  bodyMd: string;
  readMinutes: number;
  faq: { q: string; a: string }[];
  publishedAt: Date | null;
  updatedAt: Date;
  hasHero: boolean;
}

/** ISO 8601 үргэлжлэх хугацаа: 7 мин → PT7M */
export function isoDuration(minutes: number): string {
  return `PT${Math.max(1, Math.round(minutes))}M`;
}

export function guideUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/zaavar/${slug}`;
}

/** schema.org HowTo — алхмуудыг bodyMd-ийн h2-оос авна */
export function howToJsonLd(g: GuideSeoInput, siteUrl: string): Record<string, unknown> {
  const url = guideUrl(siteUrl, g.slug);
  const steps = howToSteps(g.bodyMd);
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: g.title,
    description: g.lead,
    totalTime: isoDuration(g.readMinutes),
    inLanguage: "mn",
    ...(g.hasHero ? { image: `${siteUrl.replace(/\/+$/, "")}/api/guide-image/${g.slug}` } : {}),
    ...(g.publishedAt ? { datePublished: g.publishedAt.toISOString() } : {}),
    dateModified: g.updatedAt.toISOString(),
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.text,
      text: s.body || s.text,
      url: `${url}#${s.id}`,
    })),
  };
}

/** schema.org FAQPage — FAQ байхгүй бол null */
export function faqJsonLd(faq: { q: string; a: string }[]): Record<string, unknown> | null {
  if (faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}

export interface SitemapInput {
  siteUrl: string;
  articles: { slug: string; publishedAt: Date | null; updatedAt: Date }[];
  guides: { slug: string; updatedAt: Date }[];
  prompts: { slug: string; updatedAt: Date }[];
  tools: { slug: string; updatedAt: Date }[];
  /** Харьцуулалтын pairKey-үүд */
  pairs: string[];
  /** Картын хуудсууд (/barimt/<slug>) */
  cards: { slug: string; updatedAt: Date }[];
  models: { slug: string; updatedAt: Date }[];
  useCases: { slug: string; updatedAt: Date }[];
}

/** Статик хуудсууд — жагсаалт, мэдээ, хэрэглээ, заавар */
export const STATIC_PATHS = [
  "", "/jagsaalt", "/medee", "/mongol", "/hereglee", "/zaavar", "/prompt", "/hereglel",
  "/harits", "/barimt", "/benchmark", "/benchmark/argachlal",
] as const;

/**
 * Бүх төрлийн хуудсыг нэг sitemap-д. Заавар нь мөнхийн контент тул priority өндөр,
 * мэдээ нь хурдан хуучирдаг тул бага.
 */
export function sitemapEntries(input: SitemapInput): SitemapEntry[] {
  const site = input.siteUrl.replace(/\/+$/, "");
  const now = new Date();

  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${site}${path || "/"}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...input.guides.map((g) => ({
      url: `${site}/zaavar/${g.slug}`,
      lastModified: g.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...input.prompts.map((p) => ({
      url: `${site}/prompt/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...input.cards.map((c) => ({
      url: `${site}/barimt/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...input.pairs.map((key) => ({
      url: `${site}/harits/${key}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...input.tools.map((t) => ({
      url: `${site}/hereglel/${t.slug}`,
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...input.articles.map((a) => ({
      url: `${site}/medee/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...input.useCases.map((u) => ({
      url: `${site}/hereglee/${u.slug}`,
      lastModified: u.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...input.models.map((m) => ({
      url: `${site}/model/${m.slug}`,
      lastModified: m.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
