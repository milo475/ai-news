"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { slugify } from "@/agent/slug";
import { extractVariables, PROMPT_CATEGORIES, PROMPT_LANGUAGES } from "@/prompts/prompt.api";
import { uniquePromptSlug } from "@/prompts/mutations";
import { sendPromptApproved, sendPromptRejected } from "@/prompts/mail";
import type { PromptCategory, PromptLanguage } from "@/generated/prisma/enums";

function revalidatePrompt(slug?: string) {
  revalidatePath("/");
  revalidatePath("/prompt");
  if (slug) revalidatePath(`/prompt/${slug}`);
  revalidatePath("/admin/prompt");
  revalidatePath("/profile/prompt");
  revalidatePath("/sitemap.xml");
}

function back(msg: string, open?: string): never {
  const qs = new URLSearchParams({ msg });
  if (open) qs.set("open", open);
  redirect(`/admin/prompt?${qs}`);
}

/** Батлах — нийтэлж, зохиогчид мэдэгдэнэ */
export async function approvePromptAction(form: FormData) {
  const id = String(form.get("id"));
  const p = await prisma.prompt.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), rejectReason: null },
    select: { slug: true, title: true, author: { select: { email: true } } },
  });
  revalidatePrompt(p.slug);

  if (p.author?.email) await sendPromptApproved(p.author.email, p.title, p.slug);
  back(`Нийтлэгдлээ: /prompt/${p.slug}`);
}

/** Татгалзах — шалтгааныг хадгалж, зохиогчид мэдэгдэнэ */
export async function rejectPromptAction(form: FormData) {
  const id = String(form.get("id"));
  const reason = String(form.get("reason") ?? "").trim();
  if (reason.length < 3) back("Татгалзах шалтгаанаа бичнэ үү.", id);

  const p = await prisma.prompt.update({
    where: { id },
    data: { status: "REJECTED", publishedAt: null, rejectReason: reason },
    select: { slug: true, title: true, author: { select: { email: true } } },
  });
  revalidatePrompt(p.slug);

  if (p.author?.email) await sendPromptRejected(p.author.email, p.title, reason);
  back("Татгалзлаа.");
}

/** Засах. publish=true бол хадгалаад нийтэлнэ. */
async function save(form: FormData, publish: boolean) {
  const id = String(form.get("id"));
  const current = await prisma.prompt.findUniqueOrThrow({
    where: { id },
    select: { slug: true, status: true },
  });

  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const slugInput = String(form.get("slug") ?? "").trim();
  const categoryRaw = String(form.get("category") ?? "BUSAD");
  const languageRaw = String(form.get("language") ?? "MN");

  const base = slugify(slugInput) || slugify(title) || current.slug;
  const slug = await uniquePromptSlug(base, id);

  await prisma.prompt.update({
    where: { id },
    data: {
      title, slug, body,
      description: String(form.get("description") ?? "").trim(),
      category: (PROMPT_CATEGORIES as string[]).includes(categoryRaw)
        ? (categoryRaw as PromptCategory) : "BUSAD",
      language: (PROMPT_LANGUAGES as string[]).includes(languageRaw)
        ? (languageRaw as PromptLanguage) : "MN",
      tools: String(form.get("tools") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      variables: extractVariables(body),
      ...(publish
        ? {
            status: "PUBLISHED" as const,
            rejectReason: null,
            publishedAt: current.status === "PUBLISHED" ? undefined : new Date(),
          }
        : {}),
    },
  });

  revalidatePrompt(slug);
  if (current.slug !== slug) revalidatePath(`/prompt/${current.slug}`);
  back(publish ? `Нийтлэгдлээ: /prompt/${slug}` : "Хадгалагдлаа.", id);
}

export async function savePromptAction(form: FormData) {
  await save(form, false);
}

export async function saveAndPublishPromptAction(form: FormData) {
  await save(form, true);
}

export async function deletePromptAction(form: FormData) {
  const id = String(form.get("id"));
  const p = await prisma.prompt.delete({ where: { id }, select: { slug: true } });
  revalidatePrompt(p.slug);
  back("Устгалаа.");
}
