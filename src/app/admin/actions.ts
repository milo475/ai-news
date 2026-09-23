"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { slugify } from "@/agent/slug";
import { JOB_NAMES, startJob, type JobName } from "@/jobs/runner";

/** Нийтлэгдсэн мэдээ харагддаг бүх хуудсыг шинэчилнэ */
async function revalidateArticle(articleId: string) {
  const a = await prisma.article.findUnique({
    where: { id: articleId },
    select: { models: { select: { slug: true } } },
  });
  revalidatePath("/");
  revalidatePath("/medee");
  revalidatePath("/medee/[slug]", "page");
  for (const m of a?.models ?? []) revalidatePath(`/model/${m.slug}`);
}

/** Давхардвал -2, -3 ... залгана */
async function uniqueSlug(base: string, articleId: string): Promise<string> {
  for (let n = 2; ; n++) {
    const taken = await prisma.article.findUnique({ where: { slug: base }, select: { id: true } });
    if (!taken || taken.id === articleId) return base;
    base = `${base.replace(/-\d+$/, "")}-${n}`;
  }
}

export async function publishArticle(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), reviewedBy: "admin" },
  });
  await revalidateArticle(id);
  revalidatePath("/admin");
}

export async function rejectArticle(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.article.update({ where: { id }, data: { status: "REJECTED" } });
  await revalidateArticle(id);
  revalidatePath("/admin");
}

async function save(formData: FormData, publish: boolean) {
  const id = String(formData.get("id"));

  const titleMn = String(formData.get("titleMn") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = await uniqueSlug(slugify(slugInput) || slugify(titleMn) || slugInput, id);

  await prisma.article.update({
    where: { id },
    data: {
      titleMn,
      summaryMn: String(formData.get("summaryMn") ?? "").trim(),
      bodyMn: String(formData.get("bodyMn") ?? "").trim(),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      slug,
      ...(publish ? { status: "PUBLISHED" as const, publishedAt: new Date(), reviewedBy: "admin" } : {}),
    },
  });

  await revalidateArticle(id);
  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
  if (publish) redirect("/admin?status=PUBLISHED");
}

export async function saveArticle(formData: FormData) {
  await save(formData, false);
}

export async function saveAndPublishArticle(formData: FormData) {
  await save(formData, true);
}

/**
 * Нийтлэлийг RAW болгож agent-аар дахин БИЧҮҮЛНЭ (үнэлгээг алгасна — relevance хэвээр).
 * LLM дуудна: кредит дууссан үед хуудас унахгүй, алдааг ?err= параметрээр харуулна.
 */
export async function rewriteArticle(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.article.update({
    where: { id },
    data: { status: "RAW", titleMn: null, summaryMn: null, bodyMn: null, tags: [], writeModel: null },
  });

  let error = "";
  try {
    const { processOne } = await import("@/agent/process");
    await processOne(id, { skipScore: true });
  } catch (e) {
    error = (e as Error).message;
  } finally {
    const { closeBrowser } = await import("@/fetchers/fulltext.api");
    await closeBrowser();
  }

  revalidatePath("/admin");
  redirect(error ? `/admin/${id}?err=${encodeURIComponent(error)}` : `/admin/${id}`);
}

/** Нэг нийтлэлийг Facebook-т постолж, алдаа гарвал түүнийг буцаана (хоосон = амжилттай) */
async function postOne(id: string): Promise<string> {
  const { POSTABLE_SELECT, markFailed, markPosted, postToFacebook } = await import("@/publish/facebook");
  const a = await prisma.article.findUniqueOrThrow({
    where: { id },
    select: { ...POSTABLE_SELECT, status: true, fbPostId: true, fbPostedAt: true },
  });

  if (a.status !== "PUBLISHED") return "Зөвхөн нийтлэгдсэн мэдээг постолно.";
  if (a.fbPostId || a.fbPostedAt) return "Энэ нийтлэл аль хэдийн постлогдсон.";

  try {
    await markPosted(a.id, await postToFacebook(a));
    return "";
  } catch (e) {
    const message = (e as Error).message;
    await markFailed(a.id, message);
    return message;
  }
}

/** /admin/<id> дээрх «Facebook-т постлох». Алдааг ?err=-ээр хуудсан дээр харуулна. */
export async function postArticleToFacebook(formData: FormData) {
  const id = String(formData.get("id"));
  const error = await postOne(id);

  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
  redirect(error ? `/admin/${id}?err=${encodeURIComponent(error)}` : `/admin/${id}`);
}

/** Жагсаалтын мөрөн дээрх «Одоо FB-д постлох» — буцаад жагсаалт руугаа очно */
export async function postArticleToFacebookFromList(formData: FormData) {
  const id = String(formData.get("id"));
  const error = await postOne(id);

  revalidatePath("/admin");
  redirect(`/admin?status=PUBLISHED&msg=${encodeURIComponent(error ? `FB: ${error}` : "FB: постлолоо")}`);
}

/** /admin дээрх «Мэдээ татах» / «Агент бичүүлэх» / «Бүгд» товчнууд */
export async function runJob(formData: FormData) {
  const name = String(formData.get("job"));
  if (!JOB_NAMES.includes(name as JobName)) redirect("/admin?msg=" + encodeURIComponent("танигдахгүй ажил"));

  const { started, reason } = await startJob(name as JobName);
  revalidatePath("/admin");
  redirect(`/admin?msg=${encodeURIComponent(started ? `${name}: эхэллээ` : `${name}: ${reason}`)}`);
}
