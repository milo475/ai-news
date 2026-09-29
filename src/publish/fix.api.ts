/**
 * Нийтлэгдсэн нийтлэлийн засвар — цэвэр хэсэг (LLM prompt, шалгуур; DB-гүй, тесттэй).
 *
 * Засвар нь **нуугддаггүй**: нийтлэлийн доор «Засвар (<огноо>): <юуг зассан>» гэсэн
 * мөр гарна. Уншигч хуучин хувилбарыг уншсан байж болзошгүй тул юу өөрчлөгдсөнийг
 * ил хэлэх нь дуугүй засахаас үргэлж дээр.
 */
import type { FieldIssue } from "./prepublish.api";
import type { ClaimIssue } from "./audit.api";

export const FIX_SYSTEM = `Чи баримт шалгагч редактор. Нийтлэгдчихсэн мэдээнээс илэрсэн
ЗӨРЧЛҮҮДИЙГ эх нийтлэлд тулгуурлан зас.

ЗАРЧИМ:
- Зөвхөн заасан зөрчлийг зас. Бусад өгүүлбэрийг ҮГ ҮСГЭЭР НЬ хэвээр үлдээ.
- Шинэ баримт, тоо, нэр, огноо БҮҮ НЭМ. Эх нийтлэлд байхгүй зүйл бичиж болохгүй.
- Эх нийтлэлийн болгоомжлолыг сэргээ: «likely» → «магадгүй», «could have» →
  «байж болзошгүй», «suggested» → «гэж үзсэн», «downplayed» → «хариуцлагыг
  бага үнэлсэн» (үгүйсгэсэн БИШ).
- Дамжуулсан хэвлэлийн нэрийг сэргээ: «Bloomberg-ийн мэдээлснээр …».
- Хуулийн болзолт томьёоллыг хэвээр нь: «reasonable grounds» → «үндэслэлтэй
  гэж үзэх шалтгаан бий» (БҮРЭН үндэслэлтэй БИШ).
- Эх нийтлэлд БАЙХГҮЙ огноог хас, эсвэл «<эх сурвалж> <огноо>-нд мэдээлснээр»
  гэж эх сурвалжид хамааруул. RSS-ийн нийтэлсэн огноо нь үйл явдлын огноо БИШ.
- Гарчиг {{MAX_TITLE}} тэмдэгтээс богино. Биеийн бүтэц (## гарчгууд) хэвээр.
- Биеийн урт эх хувилбарынхаа 80 хувиас багагүй байна.

changed: юуг зассаныг уншигчид ойлгомжтойгоор 1–3 богино өгүүлбэрээр. Техникийн
нэр томьёо хэрэглэхгүй («relay», «modality» гэхгүй). Жишээ: «Эх сурвалж нь
Bloomberg-ийн мэдээлэл болохыг сэргээв; НҮБ-ын дүгнэлтийн томьёоллыг эх
хувилбарт нийцүүлэв.»

Зөвхөн JSON буцаа.`;

export function fixSystem(maxTitle: number): string {
  return FIX_SYSTEM.replace("{{MAX_TITLE}}", String(maxTitle));
}

export const FIX_SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string", description: "Засварласан гарчиг" },
    summaryMn: { type: "string", description: "Засварласан хураангуй" },
    bodyMn: { type: "string", description: "Засварласан биет, markdown" },
    fbText: { type: "string", description: "Засварласан Facebook текст. Засах шаардлагагүй бол хоосон мөр." },
    fbHook: {
      type: "string",
      description:
        "Засварласан картын гарчиг — 90 тэмдэгтээс богино, нэг өгүүлбэр. Засах шаардлагагүй бол хоосон мөр.",
    },
    changed: {
      type: "array",
      items: { type: "string" },
      description: "Юуг зассаныг уншигчид ойлгомжтой 1–3 богино өгүүлбэрээр",
    },
  },
  required: ["titleMn", "summaryMn", "bodyMn", "fbText", "fbHook", "changed"],
  additionalProperties: false,
} as const;

export interface FixOut {
  titleMn: string;
  summaryMn: string;
  bodyMn: string;
  fbText: string;
  /** Картын гарчиг — суурь зураг дээр ДАХИН бичигдэнэ (зураг үүсгэх зардалгүй) */
  fbHook: string;
  changed: string[];
}

/** Эх нийтлэлээс засварлагчид өгөх дээд урт */
export const FIX_SOURCE_CHARS = 8_000;

export function fixUser(a: {
  titleMn: string;
  summaryMn: string;
  bodyMn: string;
  fbText: string | null;
  fbHook: string | null;
  sourceText: string;
  sourceName: string;
  issues: FieldIssue[];
  claims: ClaimIssue[];
}): string {
  const list = [
    ...a.issues.map((i) => `- [${i.severity}] ${i.field}: ${i.detail}`),
    ...a.claims.map((c) => `- [${c.severity}] «${c.claim}»\n  эх сурвалж: ${c.source || "(байхгүй)"}\n  засвар: ${c.problem}`),
  ];

  return [
    `ЗӨРЧЛҮҮД (${list.length}):`,
    ...list,
    "",
    "--- МАНАЙ НИЙТЛЭЛ ---",
    `Гарчиг: ${a.titleMn}`,
    `Хураангуй: ${a.summaryMn}`,
    `Биет:\n${a.bodyMn}`,
    "",
    `Facebook текст:\n${a.fbText ?? "(байхгүй)"}`,
    "",
    `Картын гарчиг: ${a.fbHook ?? "(байхгүй)"}`,
    "",
    `--- ЭХ НИЙТЛЭЛ (${a.sourceName}) ---`,
    a.sourceText.slice(0, FIX_SOURCE_CHARS),
  ].join("\n");
}

// ---------- Засварын тэмдэглэл ----------

export const CORRECTION_PREFIX = "Засвар";

/** УБ цагаар «2026-09-30» */
export function ubDate(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * «Засвар (2026-09-30): Эх сурвалж нь Bloomberg-ийн мэдээлэл болохыг сэргээв.»
 *
 * Хэрэв загвар юу ч бичээгүй бол ерөнхий мөр үлдээнэ — засвар хийсэн нь ил байх
 * нь юу зассаныг нарийн тайлбарлахаас илүү чухал.
 */
export function correctionNote(now: Date, changed: string[]): string {
  const what = changed.map((c) => c.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ");
  return `${CORRECTION_PREFIX} (${ubDate(now)}): ${what || "Эх сурвалжтай тулгаж текстийг нягтлав."}`;
}

// ---------- Засварыг хүлээж авах уу ----------

export interface FixCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Засвар нь эх хувилбараас дор болоогүй эсэх.
 *
 * Загвар заримдаа нийтлэлийг богиносгоод «зассан» гэж буцаадаг — тэр тохиолдолд
 * хүлээж авахгүй. `improve`-оос ялгаатай нь энд босго 80% (засвар нь ихэвчлэн
 * нэмэх — «Bloomberg-ийн мэдээлснээр» — тул богиносох ёсгүй).
 */
export const MIN_BODY_RATIO = 0.8;

export function checkFixed(
  before: { titleMn: string; bodyMn: string },
  after: FixOut,
  maxTitle: number,
): FixCheck {
  const problems: string[] = [];
  const title = after.titleMn?.trim() ?? "";
  const body = after.bodyMn?.trim() ?? "";

  if (!title) problems.push("гарчиг хоосон");
  else if (title.length > maxTitle) problems.push(`гарчиг ${title.length} тэмдэгт (дээд тал ${maxTitle})`);
  if (!body) problems.push("биет хоосон");
  else if (body.length < before.bodyMn.length * MIN_BODY_RATIO) {
    problems.push(
      `биет хэт богиносгосон (${body.length} < ${Math.round(before.bodyMn.length * MIN_BODY_RATIO)})`,
    );
  }
  if (!after.summaryMn?.trim()) problems.push("хураангуй хоосон");
  if ((after.changed ?? []).length === 0) problems.push("юу зассанаа бичээгүй");

  return { ok: problems.length === 0, problems };
}

// ---------- Ялгааг харуулах ----------

/** Хоёр текстийн өөрчлөгдсөн мөрүүд — өмнө → дараа */
export function diffLines(before: string, after: string): { before: string; after: string }[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const out: { before: string; after: string }[] = [];
  const max = Math.max(a.length, b.length);

  // Мөр нэмэгдэх/хасагдахад цааш нь бүхэлд нь «өөрчлөгдсөн» гэж харуулахгүйн тулд
  // өөрчлөгдөөгүй мөрүүдээр тулгуур тавина
  const same = new Set(a.filter((l) => b.includes(l) && l.trim()));
  let i = 0;
  let j = 0;
  while (i < max || j < max) {
    const la = a[i];
    const lb = b[j];
    if (la === undefined && lb === undefined) break;
    if (la === lb) { i++; j++; continue; }
    if (la !== undefined && same.has(la) && lb !== undefined && !same.has(lb)) { out.push({ before: "", after: lb }); j++; continue; }
    if (lb !== undefined && same.has(lb) && la !== undefined && !same.has(la)) { out.push({ before: la, after: "" }); i++; continue; }
    out.push({ before: la ?? "", after: lb ?? "" });
    i++; j++;
  }
  return out.filter((d) => d.before.trim() || d.after.trim());
}
