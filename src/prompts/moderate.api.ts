/**
 * Хэрэглэгчийн илгээсэн prompt-ын автомат шалгалт — LLM-ийн prompt, схем, шийдвэр (цэвэр хэсэг).
 *
 * Шалгалт нь зөвхөн ИЛТ муу зүйлийг хаана. Эргэлзээтэйг нь PENDING хэвээр үлдээж
 * админ шийднэ — хэрэглэгчийн хөдөлмөрийг машин дур мэдэн хаяхгүй.
 */

export const MODERATE_SYSTEM = `Чи монгол вэб сайтын prompt сангийн модератор. Хэрэглэгчийн
илгээсэн prompt-ыг шалгаж, нийтэд харуулж болох эсэхийг шийднэ.

ТАТГАЛЗАХ (ok=false) шалтгаанууд:
- spam: зар сурталчилгаа, давтагдсан утгагүй текст, холбоос цуглуулах оролдлого.
- unsafe: хууль бус үйлдэл, хүчирхийлэл, бэлгийн, үзэн ядалт, хэн нэгнийг гүтгэх агуулга.
- nonsense: утга учиргүй тэмдэгтүүд, туршилтын хог ("asdasd", "ттттт").
- not-prompt: prompt биш — зүгээр асуулт, сэтгэгдэл, хувийн мессеж.
- language: монгол ч биш, англи ч биш ойлгогдохгүй хэл.

ЗӨВШӨӨРӨХ (ok=true):
- Энгийн, богино ч гэсэн утга бүхий prompt.
- Англи хэл дээрх prompt (манай сан монгол, англи хоёуланг авна).
- Дутуу боловсронгуй ч ашиглаж болохоор prompt — админ дараа нь засна.

Эргэлзэж байвал ЗӨВШӨӨР. Шийдвэрээ монголоор нэг өгүүлбэрээр тайлбарла.

Мөн prompt-д хамгийн тохирох ангиллыг сонго:
AJIL (албан ажил), SURGALT (сурах, багшлах), BIZNES (маркетинг, борлуулалт),
BICHIH (нийтлэл, захидал), CODE (программчлал, Excel), ZURAG (зураг, дизайн),
ORCHUULGA (орчуулга), AMIDRAL (өдөр тутам), BUSAD (бусад).`;

export const MODERATE_SCHEMA = {
  type: "object",
  properties: {
    ok: { type: "boolean", description: "Нийтэд харуулж болох эсэх" },
    reason: {
      type: "string",
      enum: ["ok", "spam", "unsafe", "nonsense", "not-prompt", "language"],
      description: "Татгалзсан бол шалтгааны код, эс тэгвээс ok",
    },
    explanation: { type: "string", description: "Монголоор нэг өгүүлбэр" },
    category: {
      type: "string",
      enum: ["AJIL", "SURGALT", "BIZNES", "BICHIH", "CODE", "ZURAG", "ORCHUULGA", "AMIDRAL", "BUSAD"],
    },
    language: { type: "string", enum: ["MN", "EN", "MIXED"] },
  },
  required: ["ok", "reason", "explanation", "category", "language"],
  additionalProperties: false,
};

export type RejectReason = "spam" | "unsafe" | "nonsense" | "not-prompt" | "language";

export interface ModerationOutput {
  ok: boolean;
  reason: RejectReason | "ok";
  explanation: string;
  category: string;
  language: string;
}

/** Хэрэглэгчид харуулах монгол тайлбар */
export const REJECT_LABEL: Record<RejectReason, string> = {
  spam: "Зар сурталчилгаа эсвэл давтагдсан текст",
  unsafe: "Зохисгүй эсвэл хууль бус агуулга",
  nonsense: "Утга учиргүй текст",
  "not-prompt": "Энэ нь prompt биш байна",
  language: "Ойлгомжгүй хэл дээр бичигдсэн",
};

export interface Verdict {
  /** LLM илт муу гэж үзсэн бол шууд татгалзана, эс тэгвээс админд үлдээнэ */
  status: "PENDING" | "REJECTED";
  /** Татгалзсан бол хэрэглэгчид харуулах шалтгаан */
  rejectReason: string | null;
  category?: string;
  language?: string;
}

/**
 * LLM-ийн хариунаас шийдвэр гаргана.
 *
 * `ok=true` эсвэл шалтгаан нь танигдахгүй бол PENDING — админ шийднэ.
 */
export function decide(out: ModerationOutput | null): Verdict {
  // LLM дуудлага унасан (түлхүүргүй, кредит дууссан) — хэрэглэгчийг шийтгэхгүй
  if (!out) return { status: "PENDING", rejectReason: null };

  const label = REJECT_LABEL[out.reason as RejectReason];
  if (out.ok || !label) {
    return { status: "PENDING", rejectReason: null, category: out.category, language: out.language };
  }
  const explanation = out.explanation?.trim();
  return {
    status: "REJECTED",
    rejectReason: explanation ? `${label} — ${explanation}` : label,
    category: out.category,
    language: out.language,
  };
}
