/**
 * Эхний 12 зааврыг DRAFT-аар бичүүлнэ.
 *
 *   npm run seed:guides            — байхгүйг нь бичүүлнэ (зурагтай)
 *   npm run seed:guides -- --no-hero  — зураггүй (хямд)
 *   npm run seed:guides -- --only 3   — эхний 3-ыг нь
 *
 * Аль хэдийн ижил сэдвээр заавар байвал алгасна — давтан ажиллуулахад аюулгүй.
 */
import "dotenv/config";
import { prisma } from "../db";
import { createGuide } from "./write";
import type { GuideLevel } from "../generated/prisma/enums";
import { isAuthError } from "../agent/llm";
import { runCli } from "../lib/cli";

export interface SeedTopic {
  topic: string;
  audience: string;
  level: GuideLevel;
  /** /hereglee-ийн ангилал */
  usecaseSlug?: string;
}

export const SEED_TOPICS: SeedTopic[] = [
  { topic: "ChatGPT-г монгол хэлээр хэрхэн зөв ашиглах", audience: "ажилтан", level: "BEGINNER", usecaseSlug: "yarilzah" },
  { topic: "Оюутанд зориулсан 10 хэрэгтэй prompt", audience: "оюутан", level: "BEGINNER", usecaseSlug: "surah" },
  { topic: "Утсан дээр ажилладаг үнэгүй AI апп-ууд", audience: "ажилтан", level: "BEGINNER", usecaseSlug: "yarilzah" },
  { topic: "AI-аар CV, анкет бичих", audience: "оюутан", level: "BEGINNER", usecaseSlug: "bichih" },
  { topic: "AI-аар имэйл, албан бичиг бичих", audience: "ажилтан", level: "BEGINNER", usecaseSlug: "bichih" },
  { topic: "Excel, Google Sheets дээр AI ашиглах", audience: "ажилтан", level: "INTERMEDIATE", usecaseSlug: "code" },
  { topic: "AI-аар зураг үүсгэх (Canva, Gemini)", audience: "бизнес эрхлэгч", level: "BEGINNER", usecaseSlug: "zurag" },
  { topic: "Англи хэл сурахад AI-г хэрхэн ашиглах", audience: "оюутан", level: "BEGINNER", usecaseSlug: "surah" },
  { topic: "Жижиг бизнест AI-аар Facebook пост бичих", audience: "бизнес эрхлэгч", level: "BEGINNER", usecaseSlug: "bichih" },
  { topic: "AI-ийн хариултыг шалгах 5 арга", audience: "ажилтан", level: "INTERMEDIATE", usecaseSlug: "haih" },
  { topic: "Хүүхдэд AI-г аюулгүй хэрэглүүлэх", audience: "эцэг эх", level: "BEGINNER", usecaseSlug: "surah" },
  { topic: "Багшид зориулсан AI: хичээлийн төлөвлөгөө, тест", audience: "багш", level: "INTERMEDIATE", usecaseSlug: "surah" },
];

/**
 * Сэдэв аль хэдийн бичигдсэн эсэх.
 *
 * Гарчгийг LLM өөрөө бичдэг тул slug-аас сэдвийг таних боломжгүй — захиалсан сэдвийг
 * Guide.topic-д хадгалж, түүгээр нь шалгана.
 */
export async function alreadyWritten(topic: string): Promise<boolean> {
  const found = await prisma.guide.findFirst({ where: { topic }, select: { id: true } });
  return found !== null;
}

export interface SeedResult {
  created: { slug: string; topic: string; costUsd: number }[];
  skipped: string[];
  failed: { topic: string; error: string }[];
  costUsd: number;
}

export async function seedGuides(opts: { withHero?: boolean; only?: number } = {}): Promise<SeedResult> {
  const topics = opts.only ? SEED_TOPICS.slice(0, opts.only) : SEED_TOPICS;
  const r: SeedResult = { created: [], skipped: [], failed: [], costUsd: 0 };

  for (const [i, t] of topics.entries()) {
    if (await alreadyWritten(t.topic)) {
      console.log(`${i + 1}/${topics.length} ⏭  ${t.topic} — аль хэдийн байна`);
      r.skipped.push(t.topic);
      continue;
    }
    console.log(`${i + 1}/${topics.length} ✎ ${t.topic}`);
    try {
      const g = await createGuide({
        topic: t.topic,
        audience: t.audience,
        level: t.level,
        usecaseSlug: t.usecaseSlug ?? null,
        withHero: opts.withHero !== false,
      });
      r.created.push({ slug: g.slug, topic: t.topic, costUsd: g.costUsd });
      r.costUsd += g.costUsd;
      console.log(`   ✓ /zaavar/${g.slug} ($${g.costUsd.toFixed(3)})`);
    } catch (e) {
      // Түлхүүр буруу/хүчингүй бол дараагийнх нь ч мөн л унана — шууд зогсоно
      if (isAuthError(e)) throw e;
      const error = (e as Error).message.slice(0, 160);
      r.failed.push({ topic: t.topic, error });
      console.warn(`   ✗ ${error}`);
    }
  }
  return r;
}

if (process.argv[1]?.endsWith("seed.ts") && process.argv[1]?.includes("guides")) {
  await runCli(async () => {
    const onlyArg = process.argv.indexOf("--only");
    const r = await seedGuides({
      withHero: !process.argv.includes("--no-hero"),
      only: onlyArg > -1 ? Number(process.argv[onlyArg + 1]) : undefined,
    });
    console.log(
      `\n${r.created.length} шинэ, ${r.skipped.length} алгассан, ${r.failed.length} амжилтгүй — ` +
      `нийт $${r.costUsd.toFixed(3)}`,
    );
    console.log("Бүгд НООРОГ байна: /admin/zaavar дээрээс уншаад нийтэлнэ үү.");
  });
}
