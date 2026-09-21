/**
 * LMArena (lmarena.ai) Elo — цэвэр функцууд (DB-гүй).
 *
 * Эх сурвалж: HuggingFace-ийн албан ёсны `lmarena-ai/leaderboard-dataset` дата,
 * datasets-server-ийн JSON API-аар. `text/latest` split-ийн эхний мөрүүд нь
 * "overall" ангилал бөгөөд байраараа эрэмбэлэгдсэн байдаг.
 *
 * Лиценз/ишлэл: "Source: LMArena (lmarena.ai), as of {date}."
 */
import { MODEL_ALIASES } from "../data/model-aliases";

const ROWS_URL = "https://datasets-server.huggingface.co/rows";
const DATASET = "lmarena-ai/leaderboard-dataset";
const TIMEOUT_MS = 20_000;

export interface ArenaRow {
  modelName: string;
  organization: string;
  /** Elo оноо */
  rating: number;
  voteCount: number;
  /** LMArena-ийн өөрийнх нь байр */
  arenaRank: number;
  /** Жагсаалт нийтлэгдсэн огноо, "2026-09-13" */
  publishDate: string;
}

interface RawRow {
  model_name?: string;
  organization?: string;
  rating?: number;
  vote_count?: number;
  rank?: number;
  category?: string;
  leaderboard_publish_date?: string;
}

/** datasets-server-ийн хариунаас "overall" мөрүүдийг гаргана (цэвэр, тесттэй) */
export function parseArenaRows(json: unknown): ArenaRow[] {
  const rows = (json as { rows?: { row?: RawRow }[] })?.rows ?? [];
  const out: ArenaRow[] = [];
  for (const { row } of rows) {
    if (!row || row.category !== "overall") continue;
    if (!row.model_name || typeof row.rating !== "number" || typeof row.rank !== "number") continue;
    out.push({
      modelName: row.model_name,
      organization: row.organization ?? "",
      rating: row.rating,
      voteCount: row.vote_count ?? 0,
      arenaRank: row.rank,
      publishDate: row.leaderboard_publish_date ?? "",
    });
  }
  return out;
}

export async function fetchArenaRows(limit = 100): Promise<ArenaRow[]> {
  const url = new URL(ROWS_URL);
  url.searchParams.set("dataset", DATASET);
  url.searchParams.set("config", "text");
  url.searchParams.set("split", "latest");
  url.searchParams.set("offset", "0");
  url.searchParams.set("length", String(Math.min(limit, 100)));

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`LMArena dataset ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return parseArenaRows(await res.json());
}

// ---------- Нэр тааруулах ----------

/**
 * Загварын хувилбарын суффикс. "-medium" зэрэг загварын хэмжээг заадаг үгийг
 * ЭНД ОРУУЛАХГҮЙ — "mistral-medium" нь "mistral" болж хувирна.
 */
const SUFFIXES = [
  "-max", "-xhigh", "-high", "-xlow", "-low", "-chat", "-preview", "-latest",
  "-exp", "-experimental", "-thinking", "-nothinking", "-instruct", "-it",
  "-beta", "-reasoning", "-32k", "-64k", "-128k", "-256k",
];

/** Огноо/хувилбарын сүүл: -20260913, -26-02-10, -02-24, -0309, -beta2 */
const TRAILING = /-(20\d{6}|\d{2}-\d{2}-\d{2}|\d{2}-\d{2}|\d{4}|beta\d+)$/;

/**
 * Харуулах нэрэнд тайрах суффикс — тааруулахынхаас нарийн.
 * "-max", "-chat", "-instruct" нь зарим загварт жинхэнэ нэрийн хэсэг
 * (qwen3.5-max, longcat-flash-chat) тул харуулахдаа үлдээнэ.
 */
const DISPLAY_SUFFIXES = SUFFIXES.filter((s) => !["-max", "-chat", "-instruct", "-it"].includes(s));

/**
 * Хувилбарын суффикс, огноог хасна — цэг, дэфисийг нь үлдээнэ.
 * "claude-opus-5-high" → "claude-opus-5", "muse-spark-1.2 (xHigh)" → "muse-spark-1.2".
 * Каталогт байхгүй моделийн харуулах нэрийг эндээс авна.
 */
export function stripVariants(name: string, suffixes: string[] = SUFFIXES): string {
  let x = name.toLowerCase().trim();
  x = x.replace(/\s*\([^)]*\)/g, "");   // "muse-spark-1.2 (xHigh)"
  x = x.replace(/[@:]\S+$/, "");         // "model:free", "model@date"
  for (let changed = true; changed; ) {
    changed = false;
    for (const suf of suffixes) {
      if (x.endsWith(suf)) { x = x.slice(0, -suf.length); changed = true; }
    }
    const m = TRAILING.exec(x);
    if (m) { x = x.slice(0, -m[0].length); changed = true; }
  }
  return x.trim();
}

/** Каталогт шинээр үүсгэх моделийн харуулах нэр */
export function displayName(name: string): string {
  return stripVariants(name, DISPLAY_SUFFIXES);
}

/**
 * "claude-opus-5-high" → "claudeopus5", "Mistral Medium 3.5" → "mistralmedium35".
 * Тааруулахад хэрэглэнэ — зай, дэфис, цэгийг бүгдийг арилгана.
 */
export function normalizeModelName(name: string): string {
  return stripVariants(name).replace(/[^a-z0-9]/g, "");
}

export interface CatalogModel {
  slug: string;
  name: string;
}

/** Каталогийн slug/нэрийг normalize хийж хайлтын хүснэгт болгоно */
export function buildCatalogIndex(models: CatalogModel[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const m of models) {
    const bare = m.slug.split("/").slice(1).join("/") || m.slug;
    for (const key of [normalizeModelName(bare), normalizeModelName(m.name)]) {
      if (key && !index.has(key)) index.set(key, m.slug);
    }
  }
  return index;
}

/** Arena-ийн нэрээс каталогийн slug. Автомат таарахгүй бол alias хүснэгтээс. */
export function matchArenaModel(
  arenaName: string,
  index: Map<string, string>,
  aliases: Record<string, string> = MODEL_ALIASES,
): string | null {
  const key = normalizeModelName(arenaName);
  return index.get(key) ?? aliases[key] ?? null;
}

export interface ArenaEntry {
  /** Каталогийн slug. Шинэ бол normalize хийсэн Arena нэр. */
  slug: string;
  rating: number;
  rank: number;
  /** Каталогт байхгүй — arenaOnly болж шинээр үүснэ */
  isNew: boolean;
  /** Шинэ модельд харуулах нэр (хувилбарын суффиксгүй) */
  name: string;
  /** Arena-гийн organization — шинэ модельд компани болно */
  organization: string;
}

/**
 * Нэг модельд Arena-гийн хэд хэдэн хувилбар таарч болно ("claude-opus-5-max" ба "-high").
 * Хамгийн өндөр Elo-тайг нь авч, дараа нь 1..N гэж шинээр эрэмбэлнэ.
 * Каталогт таараагүй нэрс `isNew: true` болж буцна — дуудагч нь AiModel үүсгэнэ.
 */
export function rankArena(
  rows: ArenaRow[],
  index: Map<string, string>,
  aliases: Record<string, string> = MODEL_ALIASES,
): ArenaEntry[] {
  const best = new Map<string, ArenaEntry>();
  for (const r of rows) {
    const matched = matchArenaModel(r.modelName, index, aliases);
    const slug = matched ?? normalizeModelName(r.modelName);
    if (!slug) continue;
    const prev = best.get(slug);
    if (prev && prev.rating >= r.rating) continue;
    best.set(slug, {
      slug,
      rating: r.rating,
      rank: 0,
      isNew: !matched,
      name: displayName(r.modelName),
      organization: r.organization,
    });
  }
  return [...best.values()]
    .sort((a, b) => (a.rating === b.rating ? a.slug.localeCompare(b.slug) : b.rating - a.rating))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
