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

// ---------- «Промпт студи»-ийн шалгалт ----------

/**
 * Студийн хүсэлт нь сангийн prompt-оос өөр: хүн юу хийхийг хүсэж байгаагаа
 * чөлөөтэй бичнэ, бид түүнд зориулж ЗУРАГ, ВИДЕО үүсгэх промпт бэлдэнэ.
 * Тиймээс шалгалт нь «нийтлүүлэх үү» биш «бид үүнийг хийж өгөх үү» гэдэг асуулт.
 */
export const STUDIO_MODERATE_SYSTEM = `Чи монгол AI үйлчилгээний аюулгүй байдлын шалгагч.
Хэрэглэгч зураг, видео, бичвэр, хөгжим үүсгэх промпт захиалж байна. Хийж өгч болох
эсэхийг шийднэ.

ТАТГАЛЗАХ (ok=false):
- deepfake: бодит, нэрлэсэн хүнийг (улс төрч, дуучин, жүжигчин, танил хүн) зурах,
  ярьж буй мэт видео хийх, түүний царай, дуу хоолойг хуулбарлах.
- minor: насанд хүрээгүй хүүхдийг гол дүр болгосон зураг/видео — ялангуяа царайг нь
  тодоор. (Хүүхэд байгаа гэр бүлийн ерөнхий дүр зураг бол зөвшөөрнө.)
- sexual: бэлгийн, нүцгэн, дур булаам агуулга.
- violence: цус, хүчирхийлэл, зэвсэг, гэмтэл, өөрийгөө гэмтээх.
- political: сонгууль, улс төрчийн талаарх худал мэдээлэл, хуурамч мэдээ, хуурамч
  албан ёсны мэдэгдэл, хуурамч баримт бичиг, логоны хуурамч хэрэглээ.
- illegal: хууль бус үйлдэл, мансууруулах бодис, залилан, хуурамч гэрчилгээ.
- hate: үндэс, шашин, хүйс, үндэстний бүлгийг доромжлох.

ЗӨВШӨӨРӨХ (ok=true):
- Ажил, сургалт, бизнес, зар сурталчилгаа, баяр ёслол, гэр бүл, байгаль.
- Нэргүй, ерөнхий хүн дүрслэх ("залуу эмэгтэй дээлтэй") — асуудалгүй.
- Өөрийн бизнесийн лого, өөрийн бүтээгдэхүүн.
- Түүхэн, соёлын сэдэв.

Эргэлзэж байвал ЗӨВШӨӨР — гэхдээ дээрх 7 зүйлийн аль нэг нь ТОДОРХОЙ байвал татгалз.
Шалтгаанаа монголоор, эелдэг, нэг өгүүлбэрээр тайлбарла. Хэрэглэгчийг бүү зэмлэ.`;

export type StudioReject = "deepfake" | "minor" | "sexual" | "violence" | "political" | "illegal" | "hate";

const STUDIO_REASONS: StudioReject[] = ["deepfake", "minor", "sexual", "violence", "political", "illegal", "hate"];

export const STUDIO_MODERATE_SCHEMA = {
  type: "object",
  properties: {
    ok: { type: "boolean", description: "Хийж өгч болох эсэх" },
    reason: { type: "string", enum: ["ok", ...STUDIO_REASONS] },
    explanation: { type: "string", description: "Монголоор, эелдэг, нэг өгүүлбэр" },
  },
  required: ["ok", "reason", "explanation"],
  additionalProperties: false,
};

export interface StudioModerationOutput {
  ok: boolean;
  reason: StudioReject | "ok";
  explanation: string;
}

/** Хэрэглэгчид харуулах эелдэг татгалзал */
export const STUDIO_REJECT_LABEL: Record<StudioReject, string> = {
  deepfake: "Бодит, нэрлэсэн хүний царай эсвэл дуу хоолойг хуулбарлах промпт бэлдэж чадахгүй.",
  minor: "Хүүхдийг гол дүр болгосон зураг, видеоны промпт бэлдэж чадахгүй.",
  sexual: "Бэлгийн агуулгатай промпт бэлдэж чадахгүй.",
  violence: "Хүчирхийлэл, цус, зэвсгийн агуулгатай промпт бэлдэж чадахгүй.",
  political: "Улс төрийн эсвэл албан ёсны мэдэгдлийг дуурайсан агуулга бэлдэж чадахгүй.",
  illegal: "Хууль бус үйлдэлтэй холбоотой промпт бэлдэж чадахгүй.",
  hate: "Бүлэг хүмүүсийг доромжилсон агуулга бэлдэж чадахгүй.",
};

export interface StudioVerdict {
  ok: boolean;
  /** Татгалзсан бол хэрэглэгчид харуулах эелдэг мессеж */
  message: string | null;
  reason: StudioReject | null;
}

/**
 * Шалгалтын шийдвэр.
 *
 * LLM дуудлага унавал (null) ЗӨВШӨӨРНӨ — аюулгүй байдлын шалгалт унасныг
 * хэрэглэгч рүү чилээх нь буруу, харин доорх механик шүүлт хэвээр ажиллана.
 */
export function decideStudio(out: StudioModerationOutput | null): StudioVerdict {
  if (!out) return { ok: true, message: null, reason: null };
  const reason = STUDIO_REASONS.includes(out.reason as StudioReject) ? (out.reason as StudioReject) : null;
  if (out.ok || !reason) return { ok: true, message: null, reason: null };

  const extra = out.explanation?.trim();
  const label = STUDIO_REJECT_LABEL[reason];
  return {
    ok: false,
    reason,
    message: extra && extra !== label ? `${label} ${extra}` : label,
  };
}

/**
 * LLM-гүй урьдчилсан шүүлт — илт тохиолдлыг хямдхан барина.
 * Зөвхөн МАШ тодорхой үгсийг барина; эргэлзээтэйг LLM-д үлдээнэ.
 */
const HARD_BLOCK: [StudioReject, RegExp][] = [
  ["sexual", /(нүцгэн|порно|эротик|секс(ээ|ийн|тэй)?\b|nsfw|nude|porn)/iu],
  ["violence", /(цус сарвагар|толгой тас|алж буй|цаазал|бөөнөөр ал)/iu],
  ["illegal", /(мансууруул|героин|метамфетамин|хуурамч гэрчилгээ|хуурамч үнэмлэх|хуурамч паспорт)/iu],
];

export function hardBlock(request: string): StudioReject | null {
  for (const [reason, re] of HARD_BLOCK) if (re.test(request)) return reason;
  return null;
}
