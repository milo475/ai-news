/**
 * Хэрэгслийн тайлбарыг LLM-ээр бөглөх — prompt, схем, шалгуур (цэвэр).
 */
import { MAX_TAGLINE, TOOL_CATEGORIES, TOOL_CATEGORY_HINT, TOOL_CATEGORY_LABEL } from "./tool.api";

export const ENRICH_SYSTEM = `Чи AI хэрэгслүүдийг монгол хэрэглэгчдэд танилцуулдаг редактор.
Өгсөн хэрэгслийн талаар каталогийн бичлэг бэлтгэ.

ХЭЛЛЭГ
- Монголоор, энгийн. «Та» гэж хандана.
- Emoji хэрэглэхгүй. Зар шиг хэтрүүлэхгүй.
- Хэрэгслийн нэрийг нэрээр нь хэрэглэ. Мэдэхгүй зүйлээ БҮҮ ЗОХИО — тодорхойгүй бол
  тухайн талбарыг бүрхэг биш, харин болгоомжтой бич ("вэб хуудсан дээрээс шалгана уу").

БУЦААХ
- tagline: ≤${MAX_TAGLINE} тэмдэгт, нэг мөр. Юунд хэрэгтэйг шууд хэл. Цэг тавихгүй.
- descriptionMd: 2–4 догол мөр markdown. Юу хийдэг, хэнд тохирох, гол боломжууд.
  Мэдэхгүй тоо, үнэ бүү зохио.
- categories: дараахаас 1–3:
${TOOL_CATEGORIES.map((c) => `  ${c} — ${TOOL_CATEGORY_LABEL[c]} (${TOOL_CATEGORY_HINT[c]})`).join("\n")}
- pricing: FREE | FREEMIUM | TRIAL | PAID.
- priceFrom: хамгийн хямд төлбөртэй хувилбарын сарын үнэ USD-ээр (тоо). Үнэгүй эсвэл
  мэдэхгүй бол 0.
- platforms: web, ios, android, desktop, api-аас тохирохыг.
- mongolianSupport: GOOD (монголоор сайн бичиж, ойлгодог) | PARTIAL (ойлгодог ч эвгүй,
  эсвэл интерфейс англи) | NONE (монголоор ажиллахгүй).
- mnNoteMd: Монгол хэрэглэгчид анхаарах 2–4 мөр markdown жагсаалт. ГУРВАН зүйлийг заавал
  хөндөнө: (1) монгол хэл дээрх чанар, (2) төлбөр — Монголын карт (Visa/Mastercard)
  ажилладаг эсэх, (3) Монголоос хандахад VPN шаардлагатай эсэх. Мэдэхгүй бол
  «шалгах шаардлагатай» гэж шулуун хэл, бүү таа.`;

export const ENRICH_SCHEMA = {
  type: "object",
  properties: {
    tagline: { type: "string", description: `≤${MAX_TAGLINE} тэмдэгт` },
    descriptionMd: { type: "string", description: "2–4 догол мөр markdown" },
    categories: {
      type: "array", minItems: 1, maxItems: 3,
      items: { type: "string", enum: [...TOOL_CATEGORIES] },
    },
    pricing: { type: "string", enum: ["FREE", "FREEMIUM", "TRIAL", "PAID"] },
    priceFrom: { type: "number", description: "USD/сар, мэдэхгүй бол 0" },
    platforms: {
      type: "array", minItems: 1, maxItems: 5,
      items: { type: "string", enum: ["web", "ios", "android", "desktop", "api"] },
    },
    mongolianSupport: { type: "string", enum: ["GOOD", "PARTIAL", "NONE"] },
    mnNoteMd: { type: "string", description: "Монгол хэрэглэгчид анхаарах, markdown жагсаалт" },
  },
  required: [
    "tagline", "descriptionMd", "categories", "pricing", "priceFrom", "platforms",
    "mongolianSupport", "mnNoteMd",
  ],
  additionalProperties: false,
};

export interface EnrichOutput {
  tagline: string;
  descriptionMd: string;
  categories: string[];
  pricing: string;
  priceFrom: number;
  platforms: string[];
  mongolianSupport: string;
  mnNoteMd: string;
}

export interface EnrichProblem {
  code: "tagline-empty" | "tagline-long" | "description-short" | "no-category" | "emoji" | "mn-note-short";
  detail: string;
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;

export function checkEnrich(d: EnrichOutput): EnrichProblem[] {
  const p: EnrichProblem[] = [];
  const tagline = (d.tagline ?? "").trim();
  if (!tagline) p.push({ code: "tagline-empty", detail: "tagline хоосон" });
  else if (tagline.length > MAX_TAGLINE) p.push({ code: "tagline-long", detail: `${tagline.length} тэмдэгт` });

  if ((d.descriptionMd ?? "").trim().length < 120) {
    p.push({ code: "description-short", detail: `${(d.descriptionMd ?? "").length} тэмдэгт` });
  }
  if (!d.categories?.length) p.push({ code: "no-category", detail: "ангилалгүй" });
  if ((d.mnNoteMd ?? "").trim().length < 60) {
    p.push({ code: "mn-note-short", detail: `${(d.mnNoteMd ?? "").length} тэмдэгт` });
  }
  if (EMOJI.test(`${tagline} ${d.descriptionMd} ${d.mnNoteMd}`)) {
    p.push({ code: "emoji", detail: "emoji байна" });
  }
  return p;
}

export function sanitizeEnrich(d: EnrichOutput): EnrichOutput {
  const strip = (s: string) => (s ?? "").replace(/[\p{Extended_Pictographic}️]/gu, "");
  return {
    // Tagline нь нэг мөр — мөр таслалт, сүүлийн цэг арилна
    tagline: strip(d.tagline).replace(/\s+/g, " ").trim().replace(/[.。]+$/, "").slice(0, MAX_TAGLINE),
    descriptionMd: strip(d.descriptionMd).replace(/[ \t]+$/gm, "").trim(),
    categories: d.categories ?? [],
    pricing: d.pricing ?? "FREEMIUM",
    priceFrom: Number.isFinite(d.priceFrom) && d.priceFrom > 0 ? Math.round(d.priceFrom * 100) / 100 : 0,
    platforms: d.platforms ?? [],
    mongolianSupport: d.mongolianSupport ?? "PARTIAL",
    mnNoteMd: strip(d.mnNoteMd).replace(/[ \t]+$/gm, "").trim(),
  };
}

/** LLM-д өгөх мессеж */
export function enrichUser(name: string, website: string, hint?: string): string {
  return [
    `Хэрэгслийн нэр: ${name}`,
    `Вэбсайт: ${website}`,
    ...(hint ? [`Нэмэлт мэдээлэл: ${hint}`] : []),
  ].join("\n");
}
