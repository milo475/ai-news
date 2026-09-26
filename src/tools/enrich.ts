/**
 * Хэрэгслийн тайлбарыг LLM-ээр бөглөх — дуудлага + DB.
 */
import { chatJson } from "../agent/llm";
import { prisma } from "../db";
import { cleanCategories, cleanPlatforms } from "./tool.api";
import {
  checkEnrich, ENRICH_SCHEMA, ENRICH_SYSTEM, enrichUser, sanitizeEnrich, type EnrichOutput,
} from "./enrich.api";
import type { MongolianSupport, ToolPlan } from "../generated/prisma/enums";

type Chat = typeof chatJson;

export interface Enriched extends EnrichOutput {
  costUsd: number;
}

/** Нэг хэрэгслийн бичлэгийг LLM-ээр бэлдэнэ. Шалгуур давахгүй бол нэг удаа дахин. */
export async function enrichTool(
  name: string,
  website: string,
  opts: { chat?: Chat; hint?: string } = {},
): Promise<Enriched> {
  const chat = opts.chat ?? chatJson;
  let costUsd = 0;
  let problems: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat<EnrichOutput>({
      model: process.env.WRITE_MODEL ?? "google/gemini-3.8-flash",
      system: ENRICH_SYSTEM,
      user: [
        enrichUser(name, website, opts.hint),
        ...(attempt === 0 ? [] : ["", `Өмнөх оролдлого амжилтгүй: ${problems.join("; ")}`]),
      ].join("\n"),
      schema: ENRICH_SCHEMA,
      maxTokens: 3_000,
      temperature: attempt === 0 ? 0.4 : 0.7,
      reasoning: false,
    });
    costUsd += out.costUsd;

    const data = sanitizeEnrich(out.data);
    const found = checkEnrich(data);
    if (found.length === 0) return { ...data, costUsd };

    problems = found.map((f) => f.detail);
    console.warn(`   ⚠ ${name}: ${problems.join("; ")}`);
  }
  throw new Error(`LLM бөглөсөнгүй: ${problems.join("; ")}`);
}

/** Байгаа хэрэгслийн тайлбарыг LLM-ээр дахин бөглөнө (админы «LLM-ээр шинэчлэх») */
export async function refreshTool(toolId: string, opts: { chat?: Chat } = {}): Promise<number> {
  const t = await prisma.tool.findUniqueOrThrow({
    where: { id: toolId },
    select: { name: true, website: true },
  });
  const e = await enrichTool(t.name, t.website, opts);

  await prisma.tool.update({
    where: { id: toolId },
    data: {
      tagline: e.tagline,
      descriptionMd: e.descriptionMd,
      categories: cleanCategories(e.categories),
      pricing: e.pricing as ToolPlan,
      priceFrom: e.priceFrom > 0 ? e.priceFrom : null,
      platforms: cleanPlatforms(e.platforms),
      mongolianSupport: e.mongolianSupport as MongolianSupport,
      mnNoteMd: e.mnNoteMd,
    },
  });
  return e.costUsd;
}

/** Логыг татаж хадгална. Олдохгүй бол false — вэб дээр үсгэн avatar зурагдана. */
export async function saveLogo(toolId: string): Promise<boolean> {
  const t = await prisma.tool.findUniqueOrThrow({
    where: { id: toolId },
    select: { website: true },
  });
  const { fetchLogo } = await import("./logo");
  const logo = await fetchLogo(t.website);
  if (!logo) return false;

  await prisma.tool.update({
    where: { id: toolId },
    data: { logoData: new Uint8Array(logo.data), logoType: logo.contentType, logoAt: new Date() },
  });
  return true;
}
