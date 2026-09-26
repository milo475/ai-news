"use server";

/**
 * Асуулгын server action-ууд.
 */
import { prisma } from "@/db";
import { currentUser } from "@/auth/session";
import { countFinish, countStart } from "./queries";
import { decodeAnswers, TASK_CATEGORIES } from "./score.api";
import type { ArticleCategory, ToolCategory } from "@/generated/prisma/enums";
import { slug as slugSchema, tryParse, z } from "@/lib/validate";

/** Асуулгын код — base64url, 5 тэмдэгт */
const quizCode = z.string().trim().regex(/^[A-Za-z0-9_-]{1,16}$/, "буруу код");
const slugList = z.array(slugSchema).max(3);

/** Асуулга эхэлсэн (1-р алхам) */
export async function startQuizAction(): Promise<void> {
  await countStart();
}

/** Асуулга дууссан — үр дүн бүртгэнэ */
export async function finishQuizAction(code: string, toolSlugs: string[]): Promise<void> {
  const c = tryParse(quizCode, code);
  const slugs = tryParse(slugList, toolSlugs.slice(0, 3));
  if (!c || !slugs) return;
  await countFinish(c, slugs);
}

/**
 * Каталогийн ангиллыг нийтлэлийн ангилалтай холбоно — «Таны сонирхол» блокт.
 *
 * Хоёр нь өөр enum: ToolCategory нь хэрэгслийн төрөл, ArticleCategory нь мэдээний төрөл.
 * Бүрэн давхцахгүй тул зөвхөн утга нь тодорхой харгалзахыг л холбоно.
 */
const TOOL_TO_ARTICLE: Partial<Record<ToolCategory, ArticleCategory>> = {
  CODE: "PROJECT",
  BIZNES: "BUSINESS",
  MARKETING: "BUSINESS",
  SURGALT: "HOWTO",
  AGENT: "PROJECT",
};

/**
 * Нэвтэрсэн хэрэглэгчийн сонирхлыг асуулгын хариултаас автоматаар бөглөнө.
 *
 * Аль хэдийн тохиргоо хийсэн бол **дарж бичихгүй** — хэрэглэгчийн сонголт давуу.
 */
export async function saveQuizPreferenceAction(code: string): Promise<{ saved: boolean }> {
  const user = await currentUser();
  if (!user) return { saved: false };

  const c = tryParse(quizCode, code);
  if (!c) return { saved: false };
  const answers = decodeAnswers(c);
  if (!answers) return { saved: false };

  const existing = await prisma.userPreference.findUnique({
    where: { userId: user.id },
    select: { categories: true },
  });
  if (existing && existing.categories.length > 0) return { saved: false };

  const toolCats = new Set(answers.tasks.flatMap((t) => TASK_CATEGORIES[t]));
  const categories = [
    ...new Set(
      [...toolCats].flatMap((c) => {
        const mapped = TOOL_TO_ARTICLE[c];
        return mapped ? [mapped] : [];
      }),
    ),
  ];
  // Юу ч харгалзаагүй бол ерөнхий мэдээ, баримтыг өгнө — хоосон үлдээхгүй
  if (categories.length === 0) categories.push("NEWS", "FACT");

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, categories },
    update: { categories },
  });
  return { saved: true };
}
