"use server";

/**
 * Асуулгын server action-ууд.
 */
import { prisma } from "@/db";
import { currentUser } from "@/auth/session";
import { countFinish, countStart } from "./queries";
import { decodeAnswers, TASK_CATEGORIES } from "./score.api";
import type { ArticleCategory, ToolCategory } from "@/generated/prisma/enums";

/** Асуулга эхэлсэн (1-р алхам) */
export async function startQuizAction(): Promise<void> {
  await countStart();
}

/** Асуулга дууссан — үр дүн бүртгэнэ */
export async function finishQuizAction(code: string, toolSlugs: string[]): Promise<void> {
  await countFinish(code, toolSlugs.slice(0, 3));
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

  const answers = decodeAnswers(code);
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
