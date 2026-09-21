"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/db";

const PRICINGS = ["FREE", "FREEMIUM", "PAID"] as const;
type Pricing = (typeof PRICINGS)[number];

/** Хэрэглээний хуудсууд + нүүр шинэчилнэ */
function revalidateUseCases(slug?: string) {
  revalidatePath("/");
  revalidatePath("/hereglee");
  if (slug) revalidatePath(`/hereglee/${slug}`);
  else revalidatePath("/hereglee/[slug]", "page");
  revalidatePath("/admin/hereglee");
}

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function back(useCaseId: string, msg: string): never {
  redirect(`/admin/hereglee?open=${useCaseId}&msg=${encodeURIComponent(msg)}`);
}

/** Ангиллын нэр, тайлбар, дараалал, идэвх */
export async function saveUseCase(fd: FormData) {
  const id = text(fd, "useCaseId");
  const u = await prisma.useCase.update({
    where: { id },
    data: {
      nameMn: text(fd, "nameMn"),
      descriptionMn: text(fd, "descriptionMn"),
      order: Number(text(fd, "order")) || 0,
      isActive: fd.get("isActive") === "on",
    },
    select: { slug: true },
  });
  revalidateUseCases(u.slug);
  back(id, "ангилал хадгалагдлаа");
}

/** Тухайн ангилал доторх нэг хэрэгслийн эрэмбэ, тэмдэглэл, идэвх */
export async function saveLink(fd: FormData) {
  const useCaseId = text(fd, "useCaseId");
  const toolId = text(fd, "toolId");
  await prisma.useCaseTool.update({
    where: { useCaseId_toolId: { useCaseId, toolId } },
    data: { rank: Number(text(fd, "rank")) || 1, noteMn: text(fd, "noteMn") || null },
  });
  await prisma.aiTool.update({ where: { id: toolId }, data: { isActive: fd.get("isActive") === "on" } });
  revalidateUseCases();
  back(useCaseId, "хэрэгсэл хадгалагдлаа");
}

/** Ангиллаас хэрэгслийг салгана (хэрэгсэл өөрөө устахгүй) */
export async function unlinkTool(fd: FormData) {
  const useCaseId = text(fd, "useCaseId");
  await prisma.useCaseTool.delete({
    where: { useCaseId_toolId: { useCaseId, toolId: text(fd, "toolId") } },
  });
  revalidateUseCases();
  back(useCaseId, "салгалаа");
}

/** Байгаа хэрэгслийг ангилалд холбоно */
export async function linkTool(fd: FormData) {
  const useCaseId = text(fd, "useCaseId");
  const toolId = text(fd, "toolId");
  if (!toolId) back(useCaseId, "хэрэгсэл сонгоогүй");

  const last = await prisma.useCaseTool.findFirst({
    where: { useCaseId }, orderBy: { rank: "desc" }, select: { rank: true },
  });
  await prisma.useCaseTool.upsert({
    where: { useCaseId_toolId: { useCaseId, toolId } },
    create: { useCaseId, toolId, rank: (last?.rank ?? 0) + 1 },
    update: {},
  });
  revalidateUseCases();
  back(useCaseId, "холболоо");
}

/** Шинэ хэрэгсэл үүсгээд тухайн ангилалд шууд холбоно */
export async function createTool(fd: FormData) {
  const useCaseId = text(fd, "useCaseId");
  const slug = text(fd, "slug").toLowerCase();
  const name = text(fd, "name");
  if (!slug || !name) back(useCaseId, "slug ба нэр заавал");

  if (await prisma.aiTool.findUnique({ where: { slug }, select: { id: true } })) {
    back(useCaseId, `"${slug}" slug аль хэдийн бий`);
  }

  const pricing = text(fd, "pricing");
  const tool = await prisma.aiTool.create({
    data: {
      slug, name,
      vendor: text(fd, "vendor"),
      url: text(fd, "url"),
      descriptionMn: text(fd, "descriptionMn"),
      pricing: (PRICINGS.includes(pricing as Pricing) ? pricing : "FREEMIUM") as Pricing,
      worksInMongolian: fd.get("worksInMongolian") === "on",
    },
    select: { id: true },
  });

  const last = await prisma.useCaseTool.findFirst({
    where: { useCaseId }, orderBy: { rank: "desc" }, select: { rank: true },
  });
  await prisma.useCaseTool.create({
    data: { useCaseId, toolId: tool.id, rank: (last?.rank ?? 0) + 1, noteMn: text(fd, "noteMn") || null },
  });
  revalidateUseCases();
  back(useCaseId, `"${name}" нэмэгдлээ`);
}
