"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { slugify } from "@/agent/slug";
import { normalizeWebsite } from "@/tools/tool.api";
import { formId } from "@/lib/validate";

function revalidateMongol() {
  revalidatePath("/");
  revalidatePath("/mongol");
  revalidatePath("/admin/mongol");
  revalidatePath("/sitemap.xml");
}

function back(msg: string, open?: string): never {
  const qs = new URLSearchParams({ msg });
  if (open) qs.set("open", open);
  redirect(`/admin/mongol?${qs}`);
}

// ——— Эх сурвалж ———

/** listUrl + selector-ыг туршиж, олдсон холбоосуудыг хэвлэнэ */
export async function testSourceAction(form: FormData) {
  const id = formId(form);
  const s = await prisma.source.findUniqueOrThrow({
    where: { id },
    select: { name: true, listUrl: true, linkSelector: true },
  });
  if (!s.listUrl || !s.linkSelector) back(`${s.name}: listUrl эсвэл selector тохируулаагүй.`, id);

  const { previewLinks } = await import("@/fetchers/html");
  const r = await previewLinks(s.listUrl, s.linkSelector);
  if (r.error) back(`${s.name}: ${r.error}`, id);

  // Олдсоныг lastError-т түр хадгалж хуудсанд харуулна (тусдаа хүснэгт үүсгэхгүй)
  const preview = r.links.slice(0, 8).map((l) => `${l.title.slice(0, 60)} — ${l.url}`).join("\n");
  await prisma.source.update({
    where: { id },
    data: { lastError: `[тест ${new Date().toISOString().slice(0, 16)}] ${r.links.length} холбоос\n${preview}` },
  });
  revalidatePath("/admin/mongol");
  back(`${s.name}: ${r.links.length} холбоос олдлоо — доор хараарай.`, id);
}

export async function saveSourceAction(form: FormData) {
  const id = formId(form);
  const listUrl = String(form.get("listUrl") ?? "").trim();
  const linkSelector = String(form.get("linkSelector") ?? "").trim();
  const weight = Math.min(10, Math.max(1, Number(form.get("weight") ?? 5) || 5));

  await prisma.source.update({
    where: { id },
    data: {
      listUrl: listUrl || null,
      linkSelector: linkSelector || null,
      weight,
      isActive: form.get("isActive") === "on",
      lastError: null,
    },
  });
  revalidateMongol();
  back("Эх сурвалж хадгалагдлаа.", id);
}

/** Тухайн эх сурвалжийг одоо татна */
export async function fetchSourceAction(form: FormData) {
  const id = formId(form);
  const s = await prisma.source.findUniqueOrThrow({
    where: { id },
    select: { name: true, listUrl: true, feedUrl: true },
  });
  try {
    if (s.listUrl) {
      // 24 цагийн хязгаарыг гараар татахад алгасна
      await prisma.source.update({ where: { id }, data: { lastFetchedAt: null } });
      const { fetchHtmlSources } = await import("@/fetchers/html");
      const all = await fetchHtmlSources();
      const mine = all.find((r) => r.name === s.name);
      revalidateMongol();
      back(
        mine
          ? `${s.name}: ${mine.found} холбоос, ${mine.relevant} хамааралтай, ${mine.saved} шинэ${mine.error ? ` — ${mine.error}` : ""}`
          : `${s.name}: татагдсангүй`,
        id,
      );
    }
    back(`${s.name} нь RSS-тэй — pipeline-ийн rss алхам татна.`, id);
  } catch (e) {
    back(`${s.name}: ${(e as Error).message.slice(0, 140)}`, id);
  }
}

// ——— MongolProject ———

export async function saveProjectAction(form: FormData) {
  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const website = normalizeWebsite(String(form.get("website") ?? ""));
  if (name.length < 2) back("Нэрээ бичнэ үү.");
  if (!website) back("Вэбсайтын хаяг танигдсангүй.");

  const data = {
    name,
    website,
    description: String(form.get("description") ?? "").trim(),
    category: String(form.get("category") ?? "").trim() || "Бусад",
    isFeatured: form.get("isFeatured") === "on",
    isActive: form.get("isActive") === "on",
    order: Number(form.get("order") ?? 0) || 0,
  };

  if (id) {
    await prisma.mongolProject.update({ where: { id }, data });
    revalidateMongol();
    back(`${name} шинэчлэгдлээ.`);
  }

  // Шинээр — slug давхардвал -2 залгана
  let slug = slugify(name) || "tosol";
  for (let n = 2; ; n++) {
    if (!(await prisma.mongolProject.findUnique({ where: { slug }, select: { id: true } }))) break;
    slug = `${slugify(name)}-${n}`;
  }
  await prisma.mongolProject.create({ data: { slug, ...data } });
  revalidateMongol();
  back(`${name} нэмэгдлээ.`);
}

export async function deleteProjectAction(form: FormData) {
  const id = formId(form);
  const p = await prisma.mongolProject.delete({ where: { id }, select: { name: true } });
  revalidateMongol();
  back(`${p.name} устгагдлаа.`);
}

// ——— Гараар мэдээ нэмэх ———

/**
 * URL өгөхөд бүтэн текст татаж, дотоод мэдээ болгож RAW-аар хадгална.
 * Дараа нь agent товчлол бичнэ (эсвэл шууд бичүүлнэ).
 */
export async function addManualAction(form: FormData) {
  const raw = String(form.get("url") ?? "").trim();
  const url = normalizeWebsite(raw);
  if (!url) back("Хаяг танигдсангүй.");

  if (await prisma.article.findUnique({ where: { sourceUrl: url }, select: { id: true } })) {
    back("Энэ хаяг аль хэдийн орсон байна.");
  }

  // Домэйнаас эх сурвалжийг олно; байхгүй бол «Гараар нэмсэн» эх сурвалж
  const host = new URL(url).hostname.replace(/^www\./, "");
  let source = await prisma.source.findFirst({
    where: { region: "MN", url: { contains: host } },
    select: { id: true, name: true, needsBrowser: true, defaultCategory: true },
  });
  if (!source) {
    source = await prisma.source.upsert({
      where: { url: `https://${host}` },
      update: {},
      create: {
        name: host, url: `https://${host}`, region: "MN", language: "mn",
        weight: 5, isActive: false,
      },
      select: { id: true, name: true, needsBrowser: true, defaultCategory: true },
    });
  }

  const { fetchFullText } = await import("@/fetchers/fulltext.api");
  const full = await fetchFullText(url, { browser: source.needsBrowser });
  if (!full?.text) back("Бүтэн текст татагдсангүй — сайт нь бот хориглосон байж магадгүй.");

  const { titleHash } = await import("@/fetchers/rss.api");
  const title = String(form.get("title") ?? "").trim() || full.text.slice(0, 80);
  const { randomBytes } = await import("node:crypto");

  const a = await prisma.article.create({
    data: {
      slug: `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex")}`,
      status: "RAW",
      category: source.defaultCategory,
      region: "MN",
      isLocal: true,
      sourceId: source.id,
      sourceUrl: url,
      sourceTitle: title,
      sourceText: full.text,
      sourceAuthor: full.byline ?? null,
      sourceImageUrl: full.imageUrl ?? null,
      sourceHash: titleHash(title),
    },
    select: { id: true },
  });

  // Тэр дор нь товчлол бичүүлнэ — админ хүлээхгүй
  try {
    const { processOne } = await import("@/agent/process");
    const r = await processOne(a.id);
    const { closeBrowser } = await import("@/fetchers/fulltext.api");
    await closeBrowser();
    revalidateMongol();
    revalidatePath("/admin");
    back(
      r.status === "DRAFT"
        ? `Товчлол бичигдлээ (оноо ${r.score}) — /admin дээрээс хянаж нийтэлнэ үү.`
        : `Үнэлгээ ${r.score}: ${r.reason?.slice(0, 120) ?? "босго давсангүй"}`,
    );
  } catch (e) {
    revalidatePath("/admin");
    back(`Текст хадгалагдлаа, товчлол бичигдсэнгүй: ${(e as Error).message.slice(0, 120)}`);
  }
}
