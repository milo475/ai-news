/**
 * Гарчгийн үнэн зөв байдлын шалгуур — цэвэр хэсэг (LLM-гүй, DB-гүй, тесттэй).
 *
 * Яагаад хэрэгтэй: 2026-09-27-нд картын гарчиг эх мэдээг хэтрүүлж байв —
 *   · «муж OpenAI-г шүүхэд өгчээ» → «чатбот халдлагад нөлөөлжээ» (буруутгал → баримт)
 *   · «Anthropic шинэ ферментийн систем илрүүлснээ зарлав» → «эрдэмтдийн оронд 950 AI»
 *   · «1,500 оролцогчтой шалгаруулалтын нэг төрөлд дэд байр» → «1,500 төслөөс хоёрт»
 *
 * Хоёр давхар хамгаалалт:
 *   1. Механик (энд): эх сурвалж нь буруутгал/мэдэгдэл бол гарчигт ишлэл үлдсэн эсэх.
 *   2. LLM шүүгч (fidelity.ts): гарчиг ба нийтлэлийг харьцуулж {faithful, issues}.
 */

/** Нийтлэл дэх «энэ бол хэн нэгний үг, тогтсон үнэн биш» шинжүүд */
const ATTRIBUTION_SOURCE = [
  "буруутга", "шүүхэд", "нэхэмжлэл", "шүүх хурал", "гэж үзэж", "гэж үзэн", "гэж мэдэгд",
  "мэдэгдэв", "мэдэгдлээ", "зарлав", "зарлалаа", "танилцуул", "судалгаагаар", "судалгаанд",
  "тайлагнав", "хэмээн", "таамагла", "гэж үзсэн", "гэж хэлэв", "гэж буруутгав",
];

/** Гарчигт ишлэл үлдсэн болохыг илтгэх шинжүүд */
const ATTRIBUTION_HOOK = [
  "гэж ", "гэв", "хэмээн", "буруутга", "шүүхэд", "нэхэмжлэл", "мэдэгд", "зарла",
  "судалгаагаар", "судалгаанд", "таамагла", "гэсэн", "тайлагна", "үзэж байна",
];

function hasAny(text: string, needles: string[]): boolean {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n));
}

/** Эх мэдээ нь буруутгал/мэдэгдэл/судалгаа мөн үү — тийм бол гарчигт эх сурвалж үлдэх ёстой */
export function needsAttribution(sourceText: string): boolean {
  return hasAny(sourceText, ATTRIBUTION_SOURCE);
}

/** Гарчигт ишлэл байна уу */
export function hasAttribution(hook: string): boolean {
  return hasAny(hook, ATTRIBUTION_HOOK);
}

/**
 * Буруутгалыг баримт болгосон эсэх — механик шалгалт.
 * Эх мэдээ нь ишлэлтэй атал гарчиг нь шууд батлан хэлж байвал зөрчил.
 */
export function dropsAttribution(hook: string, sourceText: string): boolean {
  return needsAttribution(sourceText) && !hasAttribution(hook);
}

// ---------- LLM шүүгч ----------

export interface FidelityVerdict {
  faithful: boolean;
  issues: string[];
}

export const FIDELITY_SYSTEM = `Чи баримт шалгагч. Нийтлэлээс гаргасан ГАРЧИГ нь эх нийтлэлдээ үнэнч эсэхийг шалгана.

Гарчиг нь нийтлэлд БАЙГАА зүйлийг л хэлэх ёстой. Дараах бол ЗӨРЧИЛ (faithful=false):

1. НЭМСЭН БАРИМТ — нийтлэлд байхгүй зүйл, тодотгол, шинж чанар.
   Жишээ: нийтлэлд зүгээр «чатбот» гэснийг «хүүхдийн ашигладаг чатбот» гэж бичсэн.

2. БУРУУТГАЛЫГ БАРИМТ БОЛГОСОН — нийтлэлд «...гэж буруутгав / шүүхэд өгчээ / гэж үзэж байна»
   гэснийг гарчигт болсон явдал мэт шууд батлан бичсэн.
   Жишээ: «муж ChatGPT-ийг халдлагад хүргэсэн гэж үзэн шүүхэд өгчээ» →
   «чатбот халдлагад нөлөөлжээ» нь ЗӨРЧИЛ.

3. ШАЛТГААН-ҮР ДАГАВРЫГ ЗОХИОСОН — нийтлэлд байхгүй «улмаас / -аас болж / орлож» холбоос.
   Жишээ: «AI ферментийн систем илрүүлэв» → «эрдэмтдийн ОРОНД AI илрүүлэв» нь ЗӨРЧИЛ.

4. ХАМРАХ ХҮРЭЭГ ӨӨРЧИЛСӨН — нэг муж → улс даяар, нэг төрөл → бүх төрөл,
   оролцогч → төсөл, дэд байр → хоёрт шалгарсан гэх мэт.

5. ТООГ КОНТЕКСТООС НЬ САЛГАСАН — тоо нь нийтлэлд өөр зүйлийг тоолж байсан.
   Жишээ: «1500 оролцогчтой тэмцээний нэг төрөлд шалгарав» → «1500 төслөөс хоёрт» нь ЗӨРЧИЛ.

6. МЭДЭГДЭЛ, СУДАЛГАА, ТААМГИЙГ ТОГТСОН ҮНЭН МЭТ бичсэн — хэн хэлснийг нь орхисон.

ЗӨРЧИЛ БИШ:
- Товчилсон, өөр үгээр хэлсэн, сонирхолтой болгосон — УТГА нь хэвээр бол зүгээр.
- Нийтлэлийн аль ч хэсэгт байгаа баримтыг ашигласан (зөвхөн гарчигт биш).
- Тоог бөөрөнхийлсөн («1,487» → «бараг 1500»).

issues: зөрчил бүрийг НЭГ богино өгүүлбэрээр — юу нь буруу, юу гэж байвал зөв болохыг хэл.
Зөрчилгүй бол issues хоосон массив, faithful=true.

Зөвхөн JSON.`;

export const FIDELITY_SCHEMA = {
  type: "object",
  properties: {
    faithful: { type: "boolean", description: "Гарчиг эх нийтлэлдээ үнэнч эсэх" },
    issues: {
      type: "array",
      items: { type: "string" },
      description: "Зөрчил бүр нэг өгүүлбэрээр. Зөрчилгүй бол хоосон.",
    },
  },
  required: ["faithful", "issues"],
  additionalProperties: false,
};

export interface FidelityInput {
  hook: string;
  titleMn: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
}

/** Нийтлэлээс шүүгчид өгөх хэсгийн дээд урт */
export const FIDELITY_BODY_CHARS = 2_000;

export function fidelityUser(a: FidelityInput): string {
  return [
    `ШАЛГАХ ГАРЧИГ: ${a.hook.trim()}`,
    "",
    "--- ЭХ НИЙТЛЭЛ ---",
    `Гарчиг: ${a.titleMn ?? ""}`,
    `Хураангуй: ${a.summaryMn ?? ""}`,
    `Текст: ${(a.bodyMn ?? "").slice(0, FIDELITY_BODY_CHARS)}`,
  ].join("\n");
}

/** Өдөрт ийм удаагаас олон унавал шүүгч эвдэрсэн байж болзошгүй */
export const FIDELITY_DAILY_WARN = 3;

/**
 * Шүүгчийн хариу шийдвэр болохуйц уу.
 *
 * `faithful` нь заавал boolean байх ёстой: дутуу/хоосон хариуг «үнэнч» гэж уншвал
 * шалгагдаагүй гарчиг нийтэд гарна.
 */
export function isUsableVerdict(raw: Partial<FidelityVerdict> | null | undefined): boolean {
  return typeof raw?.faithful === "boolean" && Array.isArray(raw?.issues);
}

/** Шүүгчийн хариуг цэгцэлнэ — issues байвал faithful гэж тооцохгүй */
export function normalizeVerdict(raw: Partial<FidelityVerdict> | null | undefined): FidelityVerdict {
  const issues = (raw?.issues ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
  // Загвар заримдаа faithful=true атлаа зөрчил жагсаадаг — зөрчил давуу
  return { faithful: raw?.faithful === true && issues.length === 0, issues };
}
