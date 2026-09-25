/**
 * Сайтын prompt-уудыг LLM-ээр бичүүлэх — цэвэр хэсэг.
 */
import { MAX_DESCRIPTION } from "./prompt.api";
import type { PromptCategory } from "../generated/prisma/enums";

export const MIN_WORDS = 60;
export const MAX_WORDS = 250;

export const SEED_SYSTEM = `Чи монгол хэрэглэгчдэд зориулж AI prompt бичдэг мэргэжилтэн.
Өгсөн сэдвээр БОДИТ АЖИЛД ашиглаж болох prompt бич.

ХЭЛЛЭГ
- Prompt-ыг монголоор бич. Чи AI-д хандаж «Чи …» гэж эхэл.
- Бодит монгол нөхцөл ашигла: ХХК-ийн санхүүч, ЕБС-ийн багш, СЭЗИС-ийн оюутан,
  Улаанбаатарын жижиг дэлгүүр, хөдөө орон нутгийн үйлчилгээ гэх мэт.
- Emoji хэрэглэхгүй.

ХУВЬСАГЧ
- Хэрэглэгч өөрийн мэдээллээр солих хэсгийг {хаалтанд} бич: {компанийн нэр}, {сарын орлого}.
- 2–6 хувьсагчтай бай. Хувьсагчийн нэрийг монголоор, тодорхой бич.
- Хувьсагчийг зөвхөн нэг удаа тайлбарлаж, дахин давтахгүй.

БҮТЭЦ
- Prompt нь ${MIN_WORDS}–${MAX_WORDS} үг. AI-д үүрэг, нөхцөл, хүссэн гаралтын хэлбэрийг тодорхой хэл.
- Гаралтын хэлбэрийг заавал зааж өг (жагсаалт, хүснэгт, 3 хувилбар гэх мэт).

БУЦААХ ЗҮЙЛ
- title: ≤60 тэмдэгт, юу хийхийг шууд хэлсэн.
- description: ЯГ нэг өгүүлбэр, ≤${MAX_DESCRIPTION} тэмдэгт — хэн, юунд ашиглахыг хэлнэ.
- body: prompt-ын бүтэн текст.
- tools: тохирох хэрэгслүүд (ChatGPT, Gemini, Claude, Copilot, Canva, Perplexity-оос 1–3).`;

export const SEED_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    body: { type: "string" },
    tools: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
  },
  required: ["title", "description", "body", "tools"],
  additionalProperties: false,
};

export interface SeedDraft {
  title: string;
  description: string;
  body: string;
  tools: string[];
}

export interface SeedProblem {
  code: "title-long" | "description-long" | "few-words" | "many-words" | "no-variables" | "emoji" | "empty";
  detail: string;
}

const EMOJI = /[\p{Extended_Pictographic}️]/u;

function words(s: string): number {
  return s.split(/\s+/u).filter(Boolean).length;
}

export function checkSeed(d: SeedDraft, variables: string[]): SeedProblem[] {
  const p: SeedProblem[] = [];
  if (!d.title?.trim() || !d.body?.trim()) {
    p.push({ code: "empty", detail: "гарчиг эсвэл текст хоосон" });
    return p;
  }
  if (d.title.trim().length > 60) p.push({ code: "title-long", detail: `${d.title.length} тэмдэгт` });
  if ((d.description ?? "").trim().length > MAX_DESCRIPTION) {
    p.push({ code: "description-long", detail: `${d.description.length} тэмдэгт` });
  }
  const n = words(d.body);
  if (n < MIN_WORDS) p.push({ code: "few-words", detail: `${n} үг` });
  if (n > MAX_WORDS) p.push({ code: "many-words", detail: `${n} үг` });
  if (variables.length < 2) p.push({ code: "no-variables", detail: `${variables.length} хувьсагч` });
  if (EMOJI.test(`${d.title} ${d.description} ${d.body}`)) p.push({ code: "emoji", detail: "emoji байна" });
  return p;
}

export function sanitizeSeed(d: SeedDraft): SeedDraft {
  const strip = (s: string) => (s ?? "").replace(/[\p{Extended_Pictographic}️]/gu, "");
  return {
    title: strip(d.title).replace(/\s+/g, " ").trim(),
    description: strip(d.description ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION),
    // Prompt дотор мөр таслалт утгатай тул хадгална; мөрийн сүүлийн зайг л цэвэрлэнэ
    body: strip(d.body).replace(/[ \t]+$/gm, "").trim(),
    tools: (d.tools ?? []).map((t) => strip(t).trim()).filter(Boolean),
  };
}

export interface SeedTopic {
  topic: string;
  category: PromptCategory;
}

/** 40 суурь сэдэв — ангилал бүрт 4–5 */
export const SEED_TOPICS: SeedTopic[] = [
  // AJIL
  { topic: "Долоо хоногийн ажлын тайлан бичих", category: "AJIL" },
  { topic: "Хурлын тэмдэглэлээс хийх ажлын жагсаалт гаргах", category: "AJIL" },
  { topic: "Ажлын байрны тодорхойлолт бичих", category: "AJIL" },
  { topic: "Төслийн эрсдэлийн жагсаалт гаргах", category: "AJIL" },
  // SURGALT
  { topic: "Хичээлийн төлөвлөгөө боловсруулах", category: "SURGALT" },
  { topic: "Сэдвээр шалгалтын тест үүсгэх", category: "SURGALT" },
  { topic: "Хэцүү сэдвийг энгийн үгээр тайлбарлуулах", category: "SURGALT" },
  { topic: "Дипломын сэдэв, төлөвлөгөө гаргах", category: "SURGALT" },
  { topic: "Шалгалтад бэлдэх долоо хоногийн хуваарь", category: "SURGALT" },
  // BIZNES
  { topic: "Шинэ бүтээгдэхүүний үнийн стратеги санал болгох", category: "BIZNES" },
  { topic: "Үйлчлүүлэгчийн гомдолд хариу бичих", category: "BIZNES" },
  { topic: "Сарын борлуулалтын тайлан шинжлэх", category: "BIZNES" },
  { topic: "Жижиг бизнесийн маркетингийн 30 хоногийн төлөвлөгөө", category: "BIZNES" },
  { topic: "Өрсөлдөгчийн судалгааны асуултууд гаргах", category: "BIZNES" },
  // BICHIH
  { topic: "Facebook пост бичих (жижиг бизнес)", category: "BICHIH" },
  { topic: "Албан бичиг, хүсэлт боловсруулах", category: "BICHIH" },
  { topic: "CV болон ажилд орох захидал бичих", category: "BICHIH" },
  { topic: "Бүтээгдэхүүний тайлбар бичих", category: "BICHIH" },
  { topic: "Урт текстийг товч хураангуйлах", category: "BICHIH" },
  // CODE
  { topic: "Excel-ийн томьёо гаргаж тайлбарлуулах", category: "CODE" },
  { topic: "Кодын алдааг олж засуулах", category: "CODE" },
  { topic: "SQL query бичүүлэх", category: "CODE" },
  { topic: "Google Sheets-ийн автоматжуулалт (Apps Script)", category: "CODE" },
  { topic: "Кодыг мөр мөрөөр тайлбарлуулах", category: "CODE" },
  // ZURAG
  { topic: "Дэлгүүрийн зар сурталчилгааны зургийн дүрслэл", category: "ZURAG" },
  { topic: "Логоны санаа гаргуулах", category: "ZURAG" },
  { topic: "Нийгмийн сүлжээний хавтасны зураг", category: "ZURAG" },
  { topic: "Бүтээгдэхүүний зургийн дэвсгэр солих дүрслэл", category: "ZURAG" },
  // ORCHUULGA
  { topic: "Англи текстийг монгол руу байгалийн хэллэгээр орчуулах", category: "ORCHUULGA" },
  { topic: "Монгол албан бичгийг англи руу орчуулах", category: "ORCHUULGA" },
  { topic: "Орчуулгын чанарыг шалгуулж сайжруулах", category: "ORCHUULGA" },
  { topic: "Мэргэжлийн нэр томьёоны толь гаргах", category: "ORCHUULGA" },
  // AMIDRAL
  { topic: "Долоо хоногийн хоолны цэс, худалдан авалтын жагсаалт", category: "AMIDRAL" },
  { topic: "Аялалын маршрут төлөвлөх", category: "AMIDRAL" },
  { topic: "Сарын төсөв гаргаж хэмнэлтийн зөвлөгөө авах", category: "AMIDRAL" },
  { topic: "Дасгалын хуваарь гаргуулах", category: "AMIDRAL" },
  // BUSAD
  { topic: "Гэрээний төслийн эрсдэлтэй заалтыг олуулах", category: "BUSAD" },
  { topic: "Санал асуулгын асуултууд боловсруулах", category: "BUSAD" },
  { topic: "Мэдээллийн эх сурвалжийг шалгуулах", category: "BUSAD" },
  { topic: "Ажилтны гүйцэтгэлийн үнэлгээний санал бэлтгэх", category: "BUSAD" },
];
