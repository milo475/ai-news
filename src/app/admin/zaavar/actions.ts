"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { slugify } from "@/agent/slug";
import { readMinutes } from "@/guides/markdown.api";
import { AUDIENCES, LEVELS } from "@/guides/write.api";
import type { GuideLevel } from "@/generated/prisma/enums";
import { formId } from "@/lib/validate";

/** Заавар харагддаг бүх хуудсыг шинэчилнэ */
function revalidateGuide(slug?: string) {
  revalidatePath("/");
  revalidatePath("/zaavar");
  if (slug) revalidatePath(`/zaavar/${slug}`);
  revalidatePath("/admin/zaavar");
  revalidatePath("/sitemap.xml");
}

function back(msg: string, open?: string): never {
  const qs = new URLSearchParams({ msg });
  if (open) qs.set("open", open);
  redirect(`/admin/zaavar?${qs}`);
}

/** Сэдвээс LLM-ээр бүтэн заавар бичүүлнэ (DRAFT). Автомат нийтлэхгүй. */
export async function writeGuideAction(formData: FormData) {
  const topic = String(formData.get("topic") ?? "").trim();
  if (topic.length < 5) back("Сэдвээ бичнэ үү.");

  const audience = String(formData.get("audience") ?? "");
  const levelRaw = String(formData.get("level") ?? "BEGINNER");
  const level = (LEVELS as string[]).includes(levelRaw) ? (levelRaw as GuideLevel) : "BEGINNER";
  const usecaseSlug = String(formData.get("usecaseSlug") ?? "").trim() || null;
  const withHero = formData.get("withHero") === "on";

  try {
    const { createGuide } = await import("@/guides/write");
    const r = await createGuide({
      topic,
      audience: (AUDIENCES as readonly string[]).includes(audience) ? audience : "ажилтан",
      level,
      usecaseSlug,
      withHero,
    });
    revalidateGuide(r.slug);
    back(`Бичигдлээ: ${r.slug} ($${r.costUsd.toFixed(3)})`, r.id);
  } catch (e) {
    back(`Алдаа: ${(e as Error).message.slice(0, 160)}`);
  }
}

/** Засвар хадгалах. publish=true бол нийтэлнэ. */
async function saveGuide(formData: FormData, publish: boolean) {
  const id = formId(formData);
  const current = await prisma.guide.findUniqueOrThrow({ where: { id }, select: { slug: true, status: true } });

  const title = String(formData.get("title") ?? "").trim();
  const bodyMd = String(formData.get("bodyMd") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "BEGINNER");

  let slug = slugify(slugInput) || slugify(title) || current.slug;
  for (let n = 2; ; n++) {
    const taken = await prisma.guide.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === id) break;
    slug = `${(slugify(slugInput) || slugify(title)).replace(/-\d+$/, "")}-${n}`;
  }

  const faqRaw = String(formData.get("faq") ?? "[]");
  let faq: unknown = [];
  try {
    faq = JSON.parse(faqRaw);
  } catch {
    back("FAQ нь JSON биш байна — засвар хадгалагдсангүй.", id);
  }

  await prisma.guide.update({
    where: { id },
    data: {
      title,
      slug,
      lead: String(formData.get("lead") ?? "").trim(),
      bodyMd,
      level: (LEVELS as string[]).includes(levelRaw) ? (levelRaw as GuideLevel) : "BEGINNER",
      audience: formData.getAll("audience").map(String).filter((a) => (AUDIENCES as readonly string[]).includes(a)),
      tools: String(formData.get("tools") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      usecaseSlug: String(formData.get("usecaseSlug") ?? "").trim() || null,
      readMinutes: readMinutes(bodyMd),
      faq: faq as never,
      ...(publish
        ? { status: "PUBLISHED" as const, publishedAt: current.status === "PUBLISHED" ? undefined : new Date() }
        : {}),
    },
  });

  revalidateGuide(slug);
  if (current.slug !== slug) revalidatePath(`/zaavar/${current.slug}`);
  back(publish ? `Нийтлэгдлээ: /zaavar/${slug}` : "Хадгалагдлаа.", id);
}

export async function saveGuideAction(formData: FormData) {
  await saveGuide(formData, false);
}

export async function publishGuideAction(formData: FormData) {
  await saveGuide(formData, true);
}

/** Нийтлэгдсэнийг буцааж ноорог болгоно */
export async function unpublishGuideAction(formData: FormData) {
  const id = formId(formData);
  const g = await prisma.guide.update({ where: { id }, data: { status: "DRAFT" }, select: { slug: true } });
  revalidateGuide(g.slug);
  back("Ноорог болголоо.", id);
}

/** Hero зургийг (дахин) үүсгэнэ */
export async function heroGuideAction(formData: FormData) {
  const id = formId(formData);
  try {
    const { addHero } = await import("@/guides/write");
    const cost = await addHero(id);
    const g = await prisma.guide.findUniqueOrThrow({ where: { id }, select: { slug: true } });
    revalidateGuide(g.slug);
    back(`Зураг үүслээ ($${cost.toFixed(3)})`, id);
  } catch (e) {
    back(`Зураг гарсангүй: ${(e as Error).message.slice(0, 160)}`, id);
  }
}

export async function deleteGuideAction(formData: FormData) {
  const id = formId(formData);
  const g = await prisma.guide.delete({ where: { id }, select: { slug: true } });
  revalidateGuide(g.slug);
  back("Устгалаа.");
}
