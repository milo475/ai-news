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
ГАРЧИГ (засварын дараа ч мэдээ нь ойлгомжтой хэвээр байх ёстой):
- ҮЙЛДЭГЧ («хэн») заавал хадгалагдана. «АНУ-ын арми цохив» гэснийг «сургууль
  цохисныг Bloomberg мэдээлэв» болговол хэн цохисон нь алга болно — энэ нь
  дамжуулалтыг сэргээсэн ч мэдээг ГУЙВУУЛСАН хэрэг.
- Эх нийтлэлд ГАЗАР («хаана») байвал нэм: «Иран дахь сургууль».
- Дамжуулсан хэвлэлийг гарчгийн ТӨГСГӨЛД бич, эхэнд биш.
  Муу:  «Хиймэл оюунд найдаж сургууль цохисныг Bloomberg мэдээлэв»
  Сайн: «АНУ Иран дахь сургуулийг AI-д найдан цохисон гэж Bloomberg мэдээлэв»
- Картын гарчигт ч ижил дүрэм — үйлдэгч, газар хадгалагдана.
- Гарчиг {{MAX_TITLE}} тэмдэгтээс богино. Биеийн бүтэц (## гарчгууд) хэвээр.
- Биеийн урт эх хувилбарынхаа 80 хувиас багагүй байна.

changed: НИЙТЛЭЛИЙН ДООР УНШИГЧИД ХАРАГДАНА. Тиймээс:
- 1–2 ӨГҮҮЛБЭР, нийт 200 тэмдэгтээс богино.
- Уншигчид юу нь өөр болсныг ТОДОРХОЙ хэл: юу гэж бичсэн, юу болсныг.
- Редакцын дотоод хэллэг ХОРИОТОЙ: «хэтрүүлснийг», «худал хамааруулсан»,
  «болгоомжилсон томьёолол», «модаль», «дамжуулалт», «fidelity», «зөрчил»,
  «эх хувилбарт нийцүүлэв» гэх үгс бүү бич.
- Өөрсдийгөө буруутгах, уучлалт гуйх хэрэггүй — юу өөрчлөгдсөнийг л хэл.

Сайн жишээ:
  «Энэ мэдээг Пентагон биш, Bloomberg мэдээлсэн болохыг гарчиг, эхлэлд нэмлээ.
   Эх нийтлэлд байхгүй байсан "2026 он" гэсэн огноог хаслаа.»
  «Урьд нь "бүрэн зогсоолоо" гэж бичсэнийг "түр зогсоосон" болголоо.»
Муу жишээ (бүү бич):
  «Дамжуулалтыг сэргээж, таамгийг баталгаа болгосныг залруулав.»

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

// ---------- Гарчиг үйлдэгчээ хадгалсан эсэх ----------

/**
 * Гарчгийн «хэн, хаана» тэмдэглэгээ — том үсгээр эхэлсэн нэрс.
 *
 * Монгол гарчигт зөвхөн эхний үг том үсгээр бичигддэг тул: (а) эхний үгээс
 * бусад том үсгээр эхэлсэн үг («Пентагон», «Иран», «Bloomberg») ба (б) байрлал
 * хамаарахгүй БҮХ ТОМ ҮСЭГТ товчлол («АНУ», «НҮБ», «OpenAI») нь нэр гэж тооцогдоно.
 */
export function actorTokens(title: string): Set<string> {
  const words = title.replace(/[«»"'(),.:;!?—–]/gu, " ").split(/\s+/u).filter(Boolean);
  const out = new Set<string>();
  for (const [i, raw] of words.entries()) {
    // Монгол нөхцөлийг таслана: «Пентагоны» → «Пентагон»
    const w = raw.replace(/-[\p{L}]+$/u, "");
    if (w.length < 2) continue;
    const first = w[0]!;
    const isUpperFirst = first === first.toLocaleUpperCase("mn") && first !== first.toLocaleLowerCase("mn");
    if (!isUpperFirst) continue;
    // Хоёроос дээш том үсэгтэй товчлол — байрлал хамаарахгүй
    const caps = [...w].filter((c) => c === c.toLocaleUpperCase("mn") && c !== c.toLocaleLowerCase("mn")).length;
    if (caps >= 2 || i > 0) out.add(w.toLocaleLowerCase("mn"));
  }
  return out;
}

/**
 * Засварласан гарчиг эх гарчгийн үйлдэгчийг хадгалсан эсэх.
 *
 * 2026-09-29: «АНУ хиймэл оюунд найдаж сургууль цохисныг Пентагон тогтоов»
 * гэснийг «Хиймэл оюунд найдаж сургууль цохисныг Bloomberg мэдээлэв» болгосон —
 * дамжуулалт сэргэсэн ч ХЭН цохисон нь алга болжээ.
 */
export function keepsActor(before: string, after: string): boolean {
  const actors = actorTokens(before);
  if (actors.size === 0) return true;
  const lower = after.toLocaleLowerCase("mn");
  return [...actors].some((a) => lower.includes(a));
}

/** Загварт өгөх дахин оролдох заавар */
export function actorFeedback(before: string, after: string): string {
  const missing = [...actorTokens(before)].filter((a) => !after.toLocaleLowerCase("mn").includes(a));
  return (
    `Гарчиг үйлдэгчээ алдлаа. Эх гарчиг: «${before}». Чиний гарчиг: «${after}». ` +
    `Дараах нэрсийн ДОР ХАЯЖ НЭГ нь гарчигт байх ёстой: ${missing.join(", ")}. ` +
    `Дамжуулсан хэвлэлийг гарчгийн төгсгөлд бич.`
  );
}

// ---------- Уншигчид харагдах тэмдэглэлийн хэл ----------

/**
 * Редакцын дотоод хэллэг — нийтэд гарах тэмдэглэлд байж БОЛОХГҮЙ.
 *
 * «Таамгийг баталгаа болгосныг залруулав» гэдэг нь бидний шалгалтын дүрмийн нэр
 * болохоос уншигчид юу өөрчлөгдсөнийг хэлэхгүй.
 */
export const NOTE_JARGON = [
  "дамжуулалт", "модаль", "fidelity", "зөрчил", "хэтрүүл", "худал хамааруул",
  "болгоомжилсон томьёолол", "болзолт томьёолол", "эх хувилбарт нийцүүл",
  "таамгийг баталгаа", "баталгаа болгосныг", "залруулав", "шалгалтад",
];

/** Тэмдэглэлийн дээд урт — нийтлэлийн доор нэг догол мөр */
export const MAX_NOTE_CHARS = 240;

export function noteProblems(changed: string[]): string[] {
  const text = changed.join(" ");
  const out: string[] = [];
  const found = NOTE_JARGON.filter((w) => text.toLowerCase().includes(w));
  if (found.length > 0) out.push(`дотоод хэллэг: ${found.join(", ")}`);
  if (text.length > MAX_NOTE_CHARS) out.push(`${text.length} тэмдэгт (дээд тал ${MAX_NOTE_CHARS})`);
  return out;
}

// ---------- Дахин оролдох шалтгаанууд ----------

/** Хэдэн удаа дахин оролдох вэ */
export const MAX_FIX_TRIES = 3;

/**
 * Саналд юу дутуу байгааг ЗАГВАРТ ОЙЛГОМЖТОЙ хэлнэ.
 *
 * Өмнө нь гарчиг 60 тэмдэгтээс хэтэрвэл шууд `throw` хийж, тухайн нийтлэлийн
 * засвар бүхэлдээ унадаг байв (2026-09-30: Пентагоны гарчиг 67 тэмдэгт).
 * Одоо алдааг буцаан өгөөд дахин бичүүлнэ.
 */
export function fixFeedback(
  before: { titleMn: string; bodyMn: string; fbHook: string | null },
  out: FixOut,
  maxTitle: number,
  maxCardTitle: number,
): string[] {
  const notes: string[] = [];
  const title = (out.titleMn ?? "").trim();
  const hook = (out.fbHook ?? "").trim();

  if (title.length > maxTitle) {
    notes.push(
      `Гарчиг ${title.length} тэмдэгт, дээд хязгаар ${maxTitle} — ТОВЧИЛЖ бич. ` +
        `Үйлдэгч (хэн), дамжуулсан хэвлэлийг хадгалаад бусдыг нь хас. Чиний гарчиг: «${title}»`,
    );
  }
  if (hook.length > maxCardTitle) {
    notes.push(`Картын гарчиг ${hook.length} тэмдэгт, дээд хязгаар ${maxCardTitle} — товчил.`);
  }
  if (title && !keepsActor(before.titleMn, title)) notes.push(actorFeedback(before.titleMn, title));
  if (hook && before.fbHook && !keepsActor(before.fbHook, hook)) {
    notes.push(`Картын гарчиг: ${actorFeedback(before.fbHook, hook)}`);
  }

  const check = checkFixed(before, out, maxTitle);
  for (const p of check.problems) {
    // Гарчгийн уртыг дээр нь нарийвчлан хэлсэн — давхардуулахгүй
    if (/^гарчиг \d+ тэмдэгт/.test(p)) continue;
    notes.push(`Засвар хүлээн авагдахгүй: ${p}`);
  }

  for (const p of noteProblems(out.changed ?? [])) {
    notes.push(
      `changed (уншигчид харагдах тэмдэглэл) тохирохгүй: ${p}. ` +
        `1–2 богино өгүүлбэр, ${MAX_NOTE_CHARS} тэмдэгтээс богино, энгийн үгээр.`,
    );
  }
  return notes;
}

// ---------- Үсгийн алдаа, олдмол үг ----------

export const SPELL_SYSTEM = `Чи монгол хэлний хянан тохиолдуулагч. Өгөгдсөн текстээс
ҮСГИЙН АЛДАА ба ОЛДМОЛ (монгол хэлэнд байдаггүй) үгсийг ол.

Жишээ алдаанууд: «эртэдсэн» (→ «эрт дээр үед» эсвэл «эртний»), «хасч» (→ «хасаж»),
«боловсруулагдсан» (хэт хүнд), давхар нөхцөл, кириллд латин үсэг холилдсон.

ЗӨРЧИЛ БИШ: нэр томьёо (zero-day, Medicare, GPT-6), компанийн нэр, тоо, ишлэл.

issues: алдаа бүрт {word: яг тэр үг, suggestion: зөв хэлбэр, where: "тэмдэглэл"|"биет"}.
Алдаагүй бол хоосон массив.
fixedNote: ТЭМДЭГЛЭЛИЙГ засварласан хувилбар. Засах зүйлгүй бол ЯГ ТЭР ХЭВЭЭР буцаа.

Зөвхөн JSON.`;

export const SPELL_SCHEMA = {
  type: "object",
  properties: {
    fixedNote: { type: "string", description: "Засварласан тэмдэглэл (өөрчлөх зүйлгүй бол хэвээр)" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          suggestion: { type: "string" },
          where: { type: "string", enum: ["тэмдэглэл", "биет"] },
        },
        required: ["word", "suggestion", "where"],
        additionalProperties: false,
      },
    },
  },
  required: ["fixedNote", "issues"],
  additionalProperties: false,
} as const;

export interface SpellIssue {
  word: string;
  suggestion: string;
  where: "тэмдэглэл" | "биет";
}

/** Хянан тохиолдуулагчид өгөх биеийн дээд урт — зардлыг барина */
export const SPELL_BODY_CHARS = 3_000;

export function spellUser(a: { note: string; bodyMn: string }): string {
  return [
    "--- ТЭМДЭГЛЭЛ (уншигчид харагдана) ---",
    a.note,
    "",
    "--- БИЕТ ---",
    a.bodyMn.slice(0, SPELL_BODY_CHARS),
  ].join("\n");
}
