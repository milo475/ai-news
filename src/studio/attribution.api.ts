/**
 * Студийн хэмжилт — эх сурвалж, мэргэжил (цэвэр хэсэг).
 *
 * НУУЦЛАЛ: IP, хүсэлтийн бүтэн текстийг статистикт ХЭЗЭЭ Ч гаргахгүй.
 * Зөвхөн ангилал (домэйн, кампанит ажил, мэргэжлийн slug) хадгална.
 */

/** Танигдсан эх сурвалжууд — бусад нь домэйнээр */
const KNOWN: [RegExp, string][] = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$/i, "facebook"],
  [/(^|\.)instagram\.com$/i, "instagram"],
  [/(^|\.)google\./i, "google"],
  [/(^|\.)t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/i, "twitter"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, "youtube"],
  [/(^|\.)linkedin\.com$/i, "linkedin"],
];

/** Хадгалах утгын дээд урт — хог өгөгдлөөс хамгаална */
export const MAX_TAG = 40;

function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase().slice(0, MAX_TAG);
  // Зөвхөн энгийн тэмдэгт: хэрэглэгчийн оруулсан хог, URL хадгалахгүй
  return /^[a-z0-9][a-z0-9._-]*$/.test(s) ? s : null;
}

/**
 * Эх сурвалжийг тодорхойлно.
 *
 * Тэргүүлэх дараалал: utm_source → referrer-ийн домэйн → "direct".
 * Бүтэн URL, замыг хадгалахгүй — зөвхөн домэйн.
 */
export function sourceOf(a: { utmSource?: string | null; referrer?: string | null; host?: string | null }): string {
  const utm = clean(a.utmSource);
  if (utm) return utm;

  const ref = (a.referrer ?? "").trim();
  if (!ref) return "direct";

  let host: string;
  try {
    host = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "direct";
  }
  // Өөрийн сайтаас ирсэн бол дотоод шилжилт
  if (a.host && host === a.host.toLowerCase().replace(/^www\./, "")) return "internal";

  const known = KNOWN.find(([re]) => re.test(host));
  return known ? known[1] : (clean(host) ?? "direct");
}

export function campaignOf(utmCampaign: string | null | undefined): string | null {
  return clean(utmCampaign);
}

/** Мэргэжлийн slug — зөвхөн танигдсаныг хадгална */
export function personaOf(slug: string | null | undefined, known: string[]): string | null {
  const s = clean(slug);
  return s && known.includes(s) ? s : null;
}

// ---------- Хураангуй тоонууд ----------

export interface SessionRow {
  source: string | null;
  persona: string | null;
  completed: boolean;
  copied: boolean;
  revisionCount: number;
  costUsd: number;
  /** Гаргалтын хугацаа, мс */
  outputMs: number | null;
  tools: string[];
}

export interface Funnel {
  sessions: number;
  /** Өдөрт дунджаар */
  perDay: number;
  completed: number;
  completedPct: number;
  copied: number;
  copiedPct: number;
  revised: number;
  revisedPct: number;
  costPerSession: number;
  p50: number;
  p90: number;
}

function pct(n: number, of: number): number {
  return of > 0 ? Math.round((n / of) * 1000) / 10 : 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

export function funnelOf(rows: SessionRow[], days: number): Funnel {
  const n = rows.length;
  const completed = rows.filter((r) => r.completed).length;
  const copied = rows.filter((r) => r.copied).length;
  const revised = rows.filter((r) => r.revisionCount > 0).length;
  const ms = rows.map((r) => r.outputMs ?? 0).filter((x) => x > 0);
  const toSec = (v: number) => Math.round(v / 100) / 10;

  return {
    sessions: n,
    perDay: days > 0 ? Math.round((n / days) * 10) / 10 : 0,
    completed,
    completedPct: pct(completed, n),
    copied,
    copiedPct: pct(copied, n),
    revised,
    revisedPct: pct(revised, n),
    costPerSession: n > 0 ? Math.round((rows.reduce((s, r) => s + r.costUsd, 0) / n) * 10000) / 10000 : 0,
    p50: toSec(percentile(ms, 50)),
    p90: toSec(percentile(ms, 90)),
  };
}

export interface Bucket {
  key: string;
  count: number;
  /** Энэ бүлгийн дуусгалтын хувь */
  completedPct: number;
}

function group(rows: SessionRow[], keyOf: (r: SessionRow) => string | string[] | null): Bucket[] {
  const map = new Map<string, SessionRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const keys = k === null ? [] : Array.isArray(k) ? k : [k];
    for (const key of keys) map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map]
    .map(([key, list]) => ({
      key,
      count: list.length,
      completedPct: pct(list.filter((r) => r.completed).length, list.length),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function bySource(rows: SessionRow[]): Bucket[] {
  return group(rows, (r) => r.source ?? "direct");
}

export function byPersona(rows: SessionRow[], limit = 10): Bucket[] {
  return group(rows, (r) => r.persona).slice(0, limit);
}

export function byTool(rows: SessionRow[], limit = 10): Bucket[] {
  return group(rows, (r) => (r.tools.length ? r.tools : null)).slice(0, limit);
}
