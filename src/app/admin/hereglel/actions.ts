"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { slugify } from "@/agent/slug";
import { uniqueToolSlug } from "@/tools/mutations";
import { syncRating } from "@/tools/mutations";
import {
  cleanCategories, cleanPlatforms, MN_SUPPORT, normalizeWebsite, TOOL_PLANS,
} from "@/tools/tool.api";
import type { MongolianSupport, ToolPlan } from "@/generated/prisma/enums";
import { formId } from "@/lib/validate";

function revalidateTool(slug?: string) {
  revalidatePath("/hereglel");
  if (slug) revalidatePath(`/hereglel/${slug}`);
  revalidatePath("/hereglee");
  revalidatePath("/hereglee/[slug]", "page");
  revalidatePath("/admin/hereglel");
  revalidatePath("/sitemap.xml");
}

function back(msg: string, open?: string): never {
  const qs = new URLSearchParams({ msg });
  if (open) qs.set("open", open);
  redirect(`/admin/hereglel?${qs}`);
}

/** Батлах — нийтэлнэ */
export async function approveToolAction(form: FormData) {
  const id = formId(form);
  const t = await prisma.tool.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), rejectReason: null },
    select: { slug: true },
  });
  revalidateTool(t.slug);
  back(`Нийтлэгдлээ: /hereglel/${t.slug}`);
}

export async function unpublishToolAction(form: FormData) {
  const id = formId(form);
  const t = await prisma.tool.update({
    where: { id },
    data: { status: "PENDING" },
    select: { slug: true },
  });
  revalidateTool(t.slug);
  back("Хүлээгдэж байгаа болголоо.", id);
}

async function save(form: FormData, publish: boolean) {
  const id = formId(form);
  const current = await prisma.tool.findUniqueOrThrow({
    where: { id },
    select: { slug: true, status: true },
  });

  const name = String(form.get("name") ?? "").trim();
  const slugInput = String(form.get("slug") ?? "").trim();
  const website = normalizeWebsite(String(form.get("website") ?? ""));
  if (!website) back("Вэбсайтын хаяг танигдсангүй.", id);

  const affiliateRaw = String(form.get("affiliateUrl") ?? "").trim();
  const pricingRaw = String(form.get("pricing") ?? "FREEMIUM");
  const supportRaw = String(form.get("mongolianSupport") ?? "PARTIAL");
  const priceRaw = String(form.get("priceFrom") ?? "").trim();
  const price = priceRaw ? Number(priceRaw) : NaN;

  const slug = await uniqueToolSlug(slugify(slugInput) || slugify(name) || current.slug, id);

  await prisma.tool.update({
    where: { id },
    data: {
      name, slug, website,
      tagline: String(form.get("tagline") ?? "").trim(),
      descriptionMd: String(form.get("descriptionMd") ?? "").trim(),
      mnNoteMd: String(form.get("mnNoteMd") ?? "").trim() || null,
      affiliateUrl: affiliateRaw || null,
      categories: cleanCategories(form.getAll("categories").map(String)),
      platforms: cleanPlatforms(form.getAll("platforms").map(String)),
      pricing: (TOOL_PLANS as string[]).includes(pricingRaw) ? (pricingRaw as ToolPlan) : "FREEMIUM",
      priceFrom: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null,
      mongolianSupport: (MN_SUPPORT as string[]).includes(supportRaw)
        ? (supportRaw as MongolianSupport)
        : "PARTIAL",
      ...(publish
        ? {
            status: "PUBLISHED" as const,
            rejectReason: null,
            publishedAt: current.status === "PUBLISHED" ? undefined : new Date(),
          }
        : {}),
    },
  });

  revalidateTool(slug);
  if (current.slug !== slug) revalidatePath(`/hereglel/${current.slug}`);
  back(publish ? `Нийтлэгдлээ: /hereglel/${slug}` : "Хадгалагдлаа.", id);
}

export async function saveToolAction(form: FormData) {
  await save(form, false);
}

export async function saveAndPublishToolAction(form: FormData) {
  await save(form, true);
}

/** Логыг дахин татна */
export async function refetchLogoAction(form: FormData) {
  const id = formId(form);
  try {
    const { saveLogo } = await import("@/tools/enrich");
    const ok = await saveLogo(id);
    const t = await prisma.tool.findUniqueOrThrow({ where: { id }, select: { slug: true } });
    revalidateTool(t.slug);
    back(ok ? "Лого татагдлаа." : "Лого олдсонгүй — үсгэн avatar харагдана.", id);
  } catch (e) {
    back(`Лого татагдсангүй: ${(e as Error).message.slice(0, 140)}`, id);
  }
}

/** Тайлбар, үнэ хуучирсан бол LLM-ээр дахин бөглөнө */
export async function refreshToolAction(form: FormData) {
  const id = formId(form);
  try {
    const { refreshTool } = await import("@/tools/enrich");
    const cost = await refreshTool(id);
    const t = await prisma.tool.findUniqueOrThrow({ where: { id }, select: { slug: true } });
    revalidateTool(t.slug);
    back(`LLM-ээр шинэчлэгдлээ ($${cost.toFixed(3)})`, id);
  } catch (e) {
    back(`Шинэчлэгдсэнгүй: ${(e as Error).message.slice(0, 140)}`, id);
  }
}

/** Хувилбаруудыг slug-аар холбоно (таслалаар) */
export async function setAlternativesAction(form: FormData) {
  const id = formId(form);
  const slugs = String(form.get("alternatives") ?? "")
    .split(",")
    .map((s) => slugify(s.trim()))
    .filter(Boolean);

  const found = await prisma.tool.findMany({
    where: { slug: { in: slugs }, id: { not: id } },
    select: { id: true, slug: true },
  });
  const missing = slugs.filter((s) => !found.some((f) => f.slug === s));

  await prisma.tool.update({
    where: { id },
    data: { alternativesTo: { set: found.map((f) => ({ id: f.id })) } },
  });
  const t = await prisma.tool.findUniqueOrThrow({ where: { id }, select: { slug: true } });
  revalidateTool(t.slug);
  back(
    missing.length > 0
      ? `${found.length} хувилбар холбов. Олдсонгүй: ${missing.join(", ")}`
      : `${found.length} хувилбар холбов.`,
    id,
  );
}

/** Шүүмжийг батлах / устгах */
export async function reviewStatusAction(form: FormData) {
  const id = String(form.get("reviewId"));
  const publish = String(form.get("op")) === "publish";

  const r = publish
    ? await prisma.toolReview.update({
        where: { id },
        data: { status: "PUBLISHED", rejectReason: null },
        select: { toolId: true, tool: { select: { slug: true } } },
      })
    : await prisma.toolReview.delete({
        where: { id },
        select: { toolId: true, tool: { select: { slug: true } } },
      });

  await syncRating(r.toolId);
  revalidateTool(r.tool.slug);
  back(publish ? "Шүүмж нийтлэгдлээ." : "Шүүмж устгагдлаа.");
}

export async function deleteToolAction(form: FormData) {
  const id = formId(form);
  const t = await prisma.tool.delete({ where: { id }, select: { slug: true } });
  revalidateTool(t.slug);
  back("Устгалаа.");
}
