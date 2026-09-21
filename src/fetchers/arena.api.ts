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

/** Огноо/хувилбарын сүүл: -20260913, -26-02-10, -0309, -beta2 */
const TRAILING = /-(20\d{6}|\d{2}-\d{2}-\d{2}|\d{4}|beta\d+)$/;

/**
 * "claude-opus-5-high" → "claudeopus5", "Mistral Medium 3.5" → "mistralmedium35".
 * Жижиг үсэг, хаалтан доторх тайлбар, хувилбарын суффикс, огноо, зай/дэфисийг арилгана.
 */
export function normalizeModelName(name: string): string {
  let x = name.toLowerCase().trim();
  x = x.replace(/\s*\([^)]*\)/g, "");   // "muse-spark-1.2 (xHigh)"
  x = x.replace(/[@:]\S+$/, "");         // "model:free", "model@date"
  for (let changed = true; changed; ) {
    changed = false;
    for (const suf of SUFFIXES) {
      if (x.endsWith(suf)) { x = x.slice(0, -suf.length); changed = true; }
    }
    const m = TRAILING.exec(x);
    if (m) { x = x.slice(0, -m[0].length); changed = true; }
  }
  return x.replace(/[^a-z0-9]/g, "");
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

export interface RankedArena {
  slug: string;
  rating: number;
  rank: number;
}

/**
 * Нэг каталог модельд Arena-гийн хэд хэдэн хувилбар таарч болно
 * ("claude-opus-5-max" ба "-high" хоёр). Хамгийн өндөр Elo-тайг нь авч,
 * дараа нь 1..N гэж шинээр эрэмбэлнэ (бидний таарсан багц доторх байр).
 */
export function rankArena(
  rows: ArenaRow[],
  index: Map<string, string>,
  aliases: Record<string, string> = MODEL_ALIASES,
): {
  ranked: RankedArena[];
  unmatched: { name: string; key: string; organization: string }[];
} {
  const best = new Map<string, number>();
  const unmatched: { name: string; key: string; organization: string }[] = [];
  for (const r of rows) {
    const slug = matchArenaModel(r.modelName, index, aliases);
    if (!slug) {
      unmatched.push({ name: r.modelName, key: normalizeModelName(r.modelName), organization: r.organization });
      continue;
    }
    if (!best.has(slug) || r.rating > best.get(slug)!) best.set(slug, r.rating);
  }
  const ranked = [...best.entries()]
    .sort(([sa, a], [sb, b]) => (a === b ? sa.localeCompare(sb) : b - a))
    .map(([slug, rating], i) => ({ slug, rating, rank: i + 1 }));
  return { ranked, unmatched };
}
