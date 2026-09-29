/**
 * «Долоо хоногийн промпт» — карт, текстийг үүсгэнэ.
 *
 *   npm run studio:promo -- --dry-run          # нийтлэхгүйгээр үүсгэнэ
 *   npm run studio:promo -- --dry-run --index 3
 *
 * Мэргэжлийн хуудаснаас жишээг ээлжлэн авч студиор ажиллуулна. Үүсгэлт нь
 * ӨДРИЙН LLM хязгаарт тооцогдоно (JobRun-аар), харин хэрэглэгчийн студийн
 * хязгаарт ТООЦОГДОХГҮЙ (StudioUsage-д бичихгүй).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { isEntry, runCli } from "../lib/cli";
import { siteUrl } from "../lib/site";
import { JPEG_QUALITY } from "../publish/card";
import { buildBrief, buildDirections, buildOneTool } from "./run";
import { personas } from "./personas";
import { pickExample } from "./personas.api";
import { promoOverlaySvg } from "./promo-card.api";
import {
  exampleIndex, hasFakeProof, promoBody, promoLink, promoSlots, promptSnippet,
} from "./promo.api";
import { defaultTools, toolById, type StudioFormat } from "./studio.api";
import { unverifiedClaims } from "./numbers.api";
import { toolDocs } from "./knowledge";

/** Нэг постод хэдэн хэрэгсэл — карт, текст богино байх ёстой */
export const PROMO_TOOLS = 2;

export interface PromoPost {
  personaSlug: string;
  personaName: string;
  request: string;
  outcome: string;
  body: string;
  link: (network: "facebook" | "instagram") => string;
  card: Buffer;
  costUsd: number;
  /** Баталгаагүй тоо — 0 байх ёстой */
  unverified: number;
}

/** Картын зураг — суурь зурагтгүй, бүрэн SVG (зураг үүсгэх зардалгүй) */
export async function renderPromoCard(request: string, outcome: string): Promise<Buffer> {
  const svg = Buffer.from(promoOverlaySvg({ request, outcome }));
  return sharp(svg).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

/**
 * Нэг постыг үүсгэнэ.
 *
 * Мэргэжлийн жишээний урьдчилсан хариултыг ашигладаг тул тодруулах асуулт
 * шаардлагагүй — 3 LLM дуудлага (бриф, чиглэл, нэг хэрэгсэл).
 */
export async function buildPromo(index: number): Promise<PromoPost> {
  const picked = pickExample(personas(), index);
  if (!picked) throw new Error("Мэргэжлийн жишээ алга");
  const { persona, example } = picked;
  const format = example.format as StudioFormat;
  let costUsd = 0;

  const b = await buildBrief({ request: example.request, format, answers: example.answers });
  costUsd += b.costUsd;

  const d = await buildDirections({ brief: b.brief, format });
  costUsd += d.costUsd;
  const direction = d.directions[0];
  if (!direction) throw new Error("Чиглэл гарсангүй");

  const toolIds = defaultTools(format).slice(0, PROMO_TOOLS);
  const ctx = { brief: b.brief, format, direction, toolIds, request: example.request };
  const first = await buildOneTool(ctx, toolIds[0]!);
  costUsd += first.costUsd;

  const toolNames = toolIds.map((id) => toolById(id)?.name ?? id);
  const snippet = promptSnippet(first.output.prompt);
  const body = promoBody({
    personaName: persona.name,
    request: example.request,
    promptSnippet: snippet,
    toolNames,
  });

  // ҮНЭН БАЙДАЛ: зохиомол нийгмийн баталгаа, баталгаагүй тоо байж болохгүй
  const fake = hasFakeProof(body);
  if (fake) throw new Error(`Постод зохиомол нийгмийн баталгаа орсон: «${fake}»`);

  const doc = toolDocs([toolById(toolIds[0]!)?.doc ?? ""])[toolById(toolIds[0]!)?.doc ?? ""] ?? "";
  const unverified = unverifiedClaims(body, doc).length + first.stripped.length;

  const outcome = `${toolNames[0]}-д тавих бэлэн промпт + параметр + алхам бүрийн тайлбар`;
  return {
    personaSlug: persona.slug,
    personaName: persona.name,
    request: example.request,
    outcome,
    body,
    link: (network) => promoLink(siteUrl(), persona.slug, network),
    card: await renderPromoCard(example.request, outcome),
    costUsd,
    unverified,
  };
}

/** Одоогийн цагт тохирох жишээний дугаар */
export function currentIndex(now = new Date()): number {
  return exampleIndex(now, promoSlots());
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (isEntry("promo.ts")) {
  await runCli(async () => {
    const dry = process.argv.includes("--dry-run");
    if (!dry) {
      throw new Error(
        "Аюулгүйн үүднээс зөвхөн --dry-run дэмжинэ. Бодит пост нь pipeline-ийн slot-оос гарна.",
      );
    }
    const slots = promoSlots();
    if (slots.length === 0) {
      console.log("STUDIO_PROMO_SLOTS хоосон — сурталчилгаа унтраалттай.");
      return;
    }

    const index = Number(arg("index") ?? currentIndex());
    const out = arg("out") ?? "/tmp/studio-promo";
    mkdirSync(out, { recursive: true });

    console.log(`Slot-ууд: ${slots.map((s) => `${s.weekday}@${s.time.hour}:${String(s.time.minute).padStart(2, "0")}`).join(", ")}`);
    console.log(`Жишээний дугаар: ${index}\n`);

    const p = await buildPromo(index);
    const png = join(out, `promo-${p.personaSlug}-${index}.jpg`);
    writeFileSync(png, p.card);

    console.log(`═══ ${p.personaName} ═══`);
    console.log(`Карт:  ${png} (${Math.round(p.card.length / 1024)}KB)`);
    console.log(`Зардал: $${p.costUsd.toFixed(4)} · баталгаагүй тоо: ${p.unverified}`);
    console.log(`\n── FB/IG текст ──\n${p.body}`);
    console.log(`\n── Эхний коммент (FB) ──\n${p.link("facebook")}`);
    console.log(`── Эхний коммент (IG) ──\n${p.link("instagram")}`);
    if (p.unverified > 0) console.warn(`\n⚠ ${p.unverified} баталгаагүй тоо — нийтлэхгүй`);
  });
}

// ---------- Нийтлэх ----------

/**
 * Сурталчилгааны постыг FB (ба боломжтой бол IG)-д тавина.
 *
 * `false` буцаавал slot нь ердийн мэдээгээр дүүрнэ — slot хоосон үлдэхгүй.
 * Үнэн байдлын шалгалт (баталгаагүй тоо, зохиомол нийгмийн баталгаа) унавал
 * мөн `false`.
 */
export async function postWeeklyPrompt(now = new Date()): Promise<boolean> {
  const slots = promoSlots();
  if (slots.length === 0) return false;

  const { withJob } = await import("../jobs/track");
  return withJob("studio-promo", async () => {
    const p = await buildPromo(currentIndex(now));

    if (p.unverified > 0) {
      console.warn(`⚠ сурталчилгаа: ${p.unverified} баталгаагүй тоо — нийтлэхгүй`);
      return false;
    }

    const { addLinkComment, postPhoto } = await import("../publish/facebook");
    const caption = [p.body, "", "Холбоос коммент дээр."].join("\n");
    const fbPostId = await postPhoto(p.card, caption);
    await addLinkComment(fbPostId, p.link("facebook"));
    console.log(`✓ долоо хоногийн промпт → ${fbPostId} (${p.personaName})`);

    // IG нь зурагтай постыг л дэмждэг — алдаа гарвал FB пост хэвээр үлдэнэ
    try {
      const { igUserId } = await import("../publish/instagram.api");
      if (igUserId()) {
        const { postToInstagram } = await import("../publish/instagram");
        const { publicPromoUrl } = await import("./promo-image");
        const url = await publicPromoUrl(p.card);
        if (url) {
          const out = await postToInstagram(url, caption, {}, { altText: `${p.request} — Промпт студи` });
          console.log(`✓ IG: ${out.igMediaId}`);
        }
      }
    } catch (e) {
      console.warn(`  ⚠ IG: ${(e as Error).message.slice(0, 120)}`);
    }
    return true;
  });
}
