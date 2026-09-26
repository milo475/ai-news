/**
 * Хэрэгслийн JSON-LD (цэвэр).
 */
import { MN_SUPPORT_LABEL, TOOL_CATEGORY_LABEL, TOOL_PLAN_LABEL } from "./tool.api";
import type { MongolianSupport, ToolCategory, ToolPlan } from "../generated/prisma/enums";

export interface ToolSeoInput {
  slug: string;
  name: string;
  tagline: string;
  descriptionMd: string;
  website: string;
  categories: ToolCategory[];
  pricing: ToolPlan;
  priceFrom: number | null;
  mongolianSupport: MongolianSupport;
  platforms: string[];
  rating: number;
  reviewCount: number;
  hasLogo: boolean;
}

/** platforms → schema.org operatingSystem */
const OS_LABEL: Record<string, string> = {
  web: "Web",
  ios: "iOS",
  android: "Android",
  desktop: "Windows, macOS, Linux",
  api: "API",
};

export function softwareJsonLd(t: ToolSeoInput, siteUrl: string): Record<string, unknown> {
  const site = siteUrl.replace(/\/+$/, "");
  const free = t.pricing === "FREE";
  const price = free ? 0 : (t.priceFrom ?? 0);

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: t.name,
    description: t.tagline,
    applicationCategory: t.categories.map((c) => TOOL_CATEGORY_LABEL[c]).join(", ") || "AI",
    operatingSystem: t.platforms.map((p) => OS_LABEL[p] ?? p).join(", ") || "Web",
    url: `${site}/hereglel/${t.slug}`,
    sameAs: t.website,
    inLanguage: "mn",
    ...(t.hasLogo ? { image: `${site}/api/tool-logo/${t.slug}` } : {}),
    // Үнэ мэдэгдэхгүй бол offers-ыг огт бичихгүй — 0 гэж хэлбэл хуурамч
    ...(free || price > 0
      ? {
          offers: {
            "@type": "Offer",
            price,
            priceCurrency: "USD",
            ...(price > 0 ? { description: `${TOOL_PLAN_LABEL[t.pricing]}, сард $${price}-аас` } : {}),
          },
        }
      : {}),
    ...(t.reviewCount > 0 && t.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: t.rating,
            bestRating: 5,
            worstRating: 1,
            ratingCount: t.reviewCount,
          },
        }
      : {}),
  };
}

/** metadata-д тавих тайлбар — «X — үнэ, монгол хэлний дэмжлэг, хувилбарууд» */
export function toolMetaTitle(name: string): string {
  return `${name} — үнэ, монгол хэлний дэмжлэг, хувилбарууд`;
}

export function toolMetaDescription(t: {
  name: string;
  tagline: string;
  pricing: ToolPlan;
  priceFrom: number | null;
  mongolianSupport: MongolianSupport;
}): string {
  const price =
    t.pricing === "FREE"
      ? "үнэгүй"
      : t.priceFrom
        ? `$${t.priceFrom}/сар-аас`
        : TOOL_PLAN_LABEL[t.pricing].toLowerCase();
  return `${t.name}: ${t.tagline}. Үнэ — ${price}. ${MN_SUPPORT_LABEL[t.mongolianSupport]}.`;
}
