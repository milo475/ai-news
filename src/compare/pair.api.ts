/**
 * Харьцуулалтын хаягийн кодчилол — цэвэр (DB, React-гүй тул тесттэй).
 *
 * Моделийн slug нь "openai/gpt-5.1" хэлбэртэй. `/model/openai/gpt-5.1-vs-google/gemini-4`
 * гэвэл catch-all route-той зөрчилдөж, хаяг ч уншигдахгүй. Тиймээс тусдаа `/harits/<pair>`
 * route: "/" → "~", хоёр slug-ийг "--vs--"-ээр залгана.
 */

/** slug-ийн "/" нь хаягт орохгүй тул "~" болно */
export const SLASH = "~";
export const SEPARATOR = "--vs--";

export function encodeSlug(slug: string): string {
  return slug.trim().toLowerCase().replaceAll("/", SLASH);
}

export function decodeSlug(encoded: string): string {
  return encoded.trim().toLowerCase().replaceAll(SLASH, "/");
}

/**
 * Хоёр моделийн хосын түлхүүр. **Цагаан толгойн эрэмбэтэй** —
 * ижил хос үргэлж ижил хаягтай байж SEO-д хуваагдахгүй.
 */
export function pairKey(a: string, b: string): string {
  const [first, second] = [encodeSlug(a), encodeSlug(b)].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  return `${first}${SEPARATOR}${second}`;
}

/** Хаягаас хоёр slug. Танигдахгүй бол null. */
export function parsePair(pair: string): [string, string] | null {
  const raw = pair.trim().toLowerCase();
  const i = raw.indexOf(SEPARATOR);
  if (i <= 0) return null;
  const a = decodeSlug(raw.slice(0, i));
  const b = decodeSlug(raw.slice(i + SEPARATOR.length));
  if (!a || !b || a === b) return null;
  return [a, b];
}

/** Хаяг нь canonical (цагаан толгойн) эрэмбэтэй эсэх — эс тэгвээс 301 */
export function isCanonicalPair(pair: string): boolean {
  const parsed = parsePair(pair);
  return parsed !== null && pair.trim().toLowerCase() === pairKey(parsed[0], parsed[1]);
}

export function pairPath(a: string, b: string): string {
  return `/harits/${pairKey(a, b)}`;
}

// ——— «✓ дээр» логик ———

/** Тухайн үзүүлэлтэд их нь дээр үү, бага нь дээр үү */
export type Direction = "higher" | "lower";

export type Winner = "a" | "b" | null;

/**
 * Хоёр утгыг харьцуулна. Аль нэг нь мэдэгдэхгүй (null) бол **тэмдэг тавихгүй** —
 * өгөгдөл дутуу байхад «дээр» гэж хэлэх нь уншигчийг мэхлэх болно.
 * Тэнцвэл ч тэмдэггүй.
 */
export function better(a: number | null | undefined, b: number | null | undefined, dir: Direction): Winner {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return null;
  const aWins = dir === "higher" ? a > b : a < b;
  return aWins ? "a" : "b";
}

/** Үнэ 0 нь «үнэгүй» — хамгийн хямд гэж тооцно, хоосонтой андуурахгүй */
export function betterPrice(a: number | null | undefined, b: number | null | undefined): Winner {
  return better(a, b, "lower");
}

// ——— «Хэн юунд сонгох вэ» ———

export const USE_CASES = ["orchuulga", "bichih", "code", "hyamd"] as const;
export type CompareUseCase = (typeof USE_CASES)[number];

export const USE_CASE_LABEL: Record<CompareUseCase, string> = {
  orchuulga: "Орчуулга, монгол хэл",
  bichih: "Текст бичих",
  code: "Код бичих",
  hyamd: "Хямдаар их хэмжээ",
};

export const USE_CASE_HINT: Record<CompareUseCase, string> = {
  orchuulga: "Монгол хэлний бенчмаркийн орчуулгын оноо, дараа нь нийт MN оноо",
  bichih: "Монгол хэлний нийт оноо ба Arena Elo",
  code: "Arena Elo, дараа нь context ба гаралтын хэмжээ",
  hyamd: "Монгол 1000 үгийн үнэ, дараа нь гаралтын тариф",
};

/** Харьцуулалтад хэрэгтэй бүх үзүүлэлт. null = мэдэгдэхгүй. */
export interface CompareStats {
  slug: string;
  name: string;
  company: string;
  /** Монгол хэлний бенчмаркийн нийт оноо, 0–10 */
  mnScore: number | null;
  /** Ангилал бүрийн оноо */
  mnByCategory: Record<string, number>;
  /** Монгол 1000 үгийн үнэ, USD */
  mnCostPer1k: number | null;
  /** Бенчмаркийн дундаж хугацаа, мс */
  latencyMs: number | null;
  arenaElo: number | null;
  usageRank: number | null;
  usageTokens: number | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  inputPricePerM: number | null;
  outputPricePerM: number | null;
  modality: string | null;
  inputModalities: string[];
  releasedAt: Date | null;
}

export interface Recommendation {
  useCase: CompareUseCase;
  winner: Winner;
  /** Яагаад — өгөгдлөөс гарсан тайлбар */
  reason: string;
}

/** Elo зэрэг аравтын бутархайтай оноог бүхэлчилж харуулна */
function num(v: number | null): string {
  return v === null ? "—" : String(Math.round(v));
}

/**
 * Хэрэглээний хувилбар тус бүрт аль нь тохирохыг **дүрмээр** тодорхойлно (LLM биш).
 *
 * Дүрэм нь дараалалтай: эхний шалгуур тэнцвэл дараагийнх шийднэ. Бүгд тэнцвэл,
 * эсвэл өгөгдөл дутвал winner нь null — «хоёулаа ойролцоо» гэж хэлнэ.
 */
export function recommend(a: CompareStats, b: CompareStats): Recommendation[] {
  const out: Recommendation[] = [];

  // Орчуулга — бенчмаркийн орчуулгын ангиллууд, дараа нь нийт MN оноо
  const trA = translationScore(a);
  const trB = translationScore(b);
  const orch = better(trA, trB, "higher") ?? better(a.mnScore, b.mnScore, "higher");
  out.push({
    useCase: "orchuulga",
    winner: orch,
    reason:
      trA !== null && trB !== null
        ? `Орчуулгын оноо ${trA.toFixed(1)} vs ${trB.toFixed(1)}`
        : a.mnScore !== null && b.mnScore !== null
          ? `Монгол хэлний нийт оноо ${a.mnScore.toFixed(2)} vs ${b.mnScore.toFixed(2)}`
          : "Монгол хэлний хэмжилт хоёуланд байхгүй",
  });

  // Бичих — нийт MN оноо, тэнцвэл Arena Elo
  const bichih = better(a.mnScore, b.mnScore, "higher") ?? better(a.arenaElo, b.arenaElo, "higher");
  out.push({
    useCase: "bichih",
    winner: bichih,
    reason:
      a.mnScore !== null && b.mnScore !== null
        ? `Монгол хэлний оноо ${a.mnScore.toFixed(2)} vs ${b.mnScore.toFixed(2)}`
        : a.arenaElo !== null && b.arenaElo !== null
          ? `Arena Elo ${num(a.arenaElo)} vs ${num(b.arenaElo)}`
          : "Хэмжилт дутуу",
  });

  // Код — Arena Elo, тэнцвэл context
  const code =
    better(a.arenaElo, b.arenaElo, "higher") ?? better(a.contextLength, b.contextLength, "higher");
  out.push({
    useCase: "code",
    winner: code,
    reason:
      a.arenaElo !== null && b.arenaElo !== null
        ? `Arena Elo ${num(a.arenaElo)} vs ${num(b.arenaElo)}`
        : a.contextLength !== null && b.contextLength !== null
          ? `Context ${num(a.contextLength)} vs ${num(b.contextLength)} токен`
          : "Хэмжилт дутуу",
  });

  // Хямдаар их хэмжээ — монгол 1000 үгийн бодит үнэ, тэнцвэл гаралтын тариф
  const hyamd =
    betterPrice(a.mnCostPer1k, b.mnCostPer1k) ??
    betterPrice(a.outputPricePerM, b.outputPricePerM);
  out.push({
    useCase: "hyamd",
    winner: hyamd,
    reason:
      a.mnCostPer1k !== null && b.mnCostPer1k !== null
        ? `Монгол 1000 үг $${a.mnCostPer1k.toFixed(3)} vs $${b.mnCostPer1k.toFixed(3)}`
        : a.outputPricePerM !== null && b.outputPricePerM !== null
          ? `Гаралт 1M токен $${a.outputPricePerM} vs $${b.outputPricePerM}`
          : "Үнийн мэдээлэл дутуу",
  });

  return out;
}

/** Бенчмаркийн орчуулгын хоёр ангиллын дундаж */
export function translationScore(s: CompareStats): number | null {
  const scores = ["ORCHUULGA_MN_EN", "ORCHUULGA_EN_MN"]
    .map((c) => s.mnByCategory[c])
    .filter((v): v is number => typeof v === "number");
  if (scores.length === 0) return null;
  return scores.reduce((n, v) => n + v, 0) / scores.length;
}

// ——— Дүгнэлтийн кэш ———

/** Дүгнэлт хэдэн хоногийн дараа хуучирна */
export const SUMMARY_MAX_AGE_DAYS = 30;

export function summaryStale(generatedAt: Date | null | undefined, now = new Date()): boolean {
  if (!generatedAt) return true;
  return now.getTime() - generatedAt.getTime() > SUMMARY_MAX_AGE_DAYS * 86_400_000;
}

// ——— «Модель сонгох» хуудасны дүрэм ———

export const PICKER_TASKS = ["orchuulga", "bichih", "code", "yarilzah", "zurag"] as const;
export type PickerTask = (typeof PICKER_TASKS)[number];

export const PICKER_TASK_LABEL: Record<PickerTask, string> = {
  orchuulga: "Орчуулга",
  bichih: "Текст бичих",
  code: "Код бичих",
  yarilzah: "Ярилцах, асуулт асуух",
  zurag: "Зураг ойлгох",
};

export const BUDGETS = ["unegui", "hyamd", "hamaagui"] as const;
export type Budget = (typeof BUDGETS)[number];

export const BUDGET_LABEL: Record<Budget, string> = {
  unegui: "Үнэгүй",
  hyamd: "Хямд",
  hamaagui: "Хамаагүй",
};

export interface PickerAnswers {
  task: PickerTask;
  budget: Budget;
  /** Монгол хэл чухал эсэх */
  mongolian: boolean;
}

/** Хямд гэж юуг тооцох вэ — гаралтын 1M токены үнэ */
export const CHEAP_OUTPUT_PRICE = 2;

/**
 * Хариултаас моделиудыг эрэмбэлж санал болгоно — **зөвхөн дүрмээр**.
 *
 * Шүүлт: үнэгүй → үнэ 0; хямд → гаралт ≤$2/1M. Зураг ойлгох → inputModalities-д image.
 * Эрэмбэ: монгол хэл чухал бол MN оноо тэргүүн, эс тэгвээс тухайн ажилд тохирох үзүүлэлт.
 */
export function pickModels(all: CompareStats[], answers: PickerAnswers, limit = 3): CompareStats[] {
  let pool = all;

  if (answers.budget === "unegui") {
    pool = pool.filter((m) => m.outputPricePerM === 0);
  } else if (answers.budget === "hyamd") {
    pool = pool.filter((m) => m.outputPricePerM !== null && m.outputPricePerM <= CHEAP_OUTPUT_PRICE);
  }
  if (answers.task === "zurag") {
    pool = pool.filter((m) => m.inputModalities.includes("image"));
  }
  // Шүүлт хэт хатуу бол хоосон хуудас гаргахгүй — шүүлтгүй эрэмбээр гүйцээнэ
  if (pool.length === 0) pool = all;

  const score = (m: CompareStats): number[] => {
    const mn = m.mnScore ?? -1;
    const elo = m.arenaElo ?? -1;
    const usage = m.usageRank === null ? -1 : 1_000 - m.usageRank;
    const task =
      answers.task === "orchuulga" ? (translationScore(m) ?? mn)
      : answers.task === "code" ? elo
      : answers.task === "zurag" ? (m.inputModalities.includes("image") ? 1 : 0)
      : mn;

    // Монгол хэл чухал бол MN оноо тэргүүн эрэмбэ болно
    return answers.mongolian ? [mn, task, elo, usage] : [task, elo, mn, usage];
  };

  return [...pool]
    .sort((x, y) => {
      const sx = score(x);
      const sy = score(y);
      for (let i = 0; i < sx.length; i++) {
        if (sx[i]! !== sy[i]!) return sy[i]! - sx[i]!;
      }
      return x.name.localeCompare(y.name);
    })
    .slice(0, limit);
}
