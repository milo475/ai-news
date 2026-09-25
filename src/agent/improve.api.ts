/**
 * Нийтлэлийн текстийг нэг удаа сайжруулах — цэвэр хэсэг (LLM, DB-гүй, тесттэй).
 *
 * Агент хурдан бичдэг тул гарчиг урт, эхний өгүүлбэр сул, хэллэг давхардсан байдаг.
 * БЭЛТГЭХ горимд нийтлэл бүрийг нэг л удаа дахин уншуулж засварлана (`improvedAt`).
 */

/** Гарчгийн дээд урт */
export const MAX_TITLE_CHARS = 60;

/** Хэдэн нийтлэлийг бэлэн байлгах вэ — дараагийн 2 slot + нөөц */
export const DEFAULT_READY_TARGET = 3;

/** Зураг урьдчилан үүсгэх дээд тоо (дараагийн 2 slot) */
export const IMAGE_AHEAD = 2;

/** PREPARE_READY_TARGET — хэдэн бэлэн нийтлэл барих вэ */
export function readyTarget(env: Record<string, string | undefined> = process.env): number {
  const raw = env.PREPARE_READY_TARGET?.trim();
  if (!raw) return DEFAULT_READY_TARGET;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_READY_TARGET;
}

export const IMPROVE_SYSTEM = `Чи монгол хэлний редактор. Өгөгдсөн мэдээг агуулгыг нь өөрчлөхгүйгээр засварла.

Засах зүйлс:
- Гарчиг: ${MAX_TITLE_CHARS} тэмдэгтээс богино, баримттай, кликбейтгүй. Хамгийн чухал үйлдэл/сэдвийг эхэнд нь.
- Эхний өгүүлбэр: хүчтэй байх — хэн, юу хийсэн нь шууд ойлгогдоно. "Саяхан", "сүүлийн үед" гэх мэт сул эхлэл хориотой.
- Давхардсан хэллэг, утга давтсан өгүүлбэрийг нэгтгэ эсвэл хас.
- Юу ч хэлээгүй ерөнхий өгүүлбэрийг («технологи хурдацтай хөгжиж байна») бүрмөсөн хас.
- Албан бичгийн хүнд хэллэгийг энгийн болго.
- Бүтцийг хадгал: lead → "## Гол баримт" (тоотой bullet) → дэд гарчигтай догол мөрүүд →
  "## Монголд юу гэсэн үг". Дутуу байвал байгаа агуулгаас нь бүрдүүл, шинэ баримт бүү нэм.
- Догол мөр бүр 3-аас илүүгүй өгүүлбэр.

Хориотой:
- Шинэ баримт, тоо, нэр нэмэхгүй. Байхгүй зүйлийг таамаглахгүй.
- Байгаа баримт, тоог хасахгүй, өөрчлөхгүй.
- Хэмжээг эрс багасгахгүй: биет нь эх хэмжээнийхээ 70 хувиас багагүй байна.

Зөвхөн JSON буцаа.`;

export const IMPROVE_SCHEMA = {
  type: "object",
  properties: {
    titleMn: { type: "string", description: `Засварласан гарчиг, ${MAX_TITLE_CHARS} тэмдэгтээс богино` },
    summaryMn: { type: "string", description: "1–2 өгүүлбэр, 200 тэмдэгт хүртэл" },
    bodyMn: { type: "string", description: "Засварласан биет, markdown, эх хэмжээний 70%-аас багагүй" },
    changed: { type: "array", items: { type: "string" }, description: "Юу заасныг товч жагсаана" },
  },
  required: ["titleMn", "summaryMn", "bodyMn", "changed"],
  additionalProperties: false,
};

export interface ImproveOut {
  titleMn: string;
  summaryMn: string;
  bodyMn: string;
  changed: string[];
}

export interface ImproveCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Засвар хүлээн авахуйц эсэх. Модель заримдаа нийтлэлийг тайрч эсвэл хоосон буцаадаг —
 * тийм тохиолдолд эхний хувилбарыг хэвээр үлдээнэ.
 */
export function checkImproved(before: { titleMn: string; bodyMn: string }, after: ImproveOut): ImproveCheck {
  const problems: string[] = [];
  const title = after.titleMn?.trim() ?? "";
  const body = after.bodyMn?.trim() ?? "";

  if (!title) problems.push("гарчиг хоосон");
  else if (title.length > MAX_TITLE_CHARS) problems.push(`гарчиг ${title.length} тэмдэгт`);
  if (!body) problems.push("биет хоосон");
  else if (body.length < before.bodyMn.length * 0.7) {
    problems.push(`биет хэт богиносгосон (${body.length} < ${Math.round(before.bodyMn.length * 0.7)})`);
  }
  if (!after.summaryMn?.trim()) problems.push("хураангуй хоосон");

  return { ok: problems.length === 0, problems };
}

/** Гарчиг хэтэрсэн бол үгээр нь таслана (LLM дахин оролдсоны дараа ч урт бол) */
export function trimTitle(title: string, max = MAX_TITLE_CHARS): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:—-]+$/, "");
}
