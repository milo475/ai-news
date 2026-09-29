/**
 * Засварын төлөвлөгөөг диск дээр хадгалах — цэвэр хэсэг (I/O-гүй, тесттэй).
 *
 * Яагаад: `--apply` нь өмнө нь LLM-ийг ДАХИН дуудаж шинэ санал гаргадаг байв.
 * Өөрөөр хэлбэл миний хянасан текст биш, ӨӨР текст нийтлэгдэнэ — dry-run-ийн
 * утга алга болно. Одоо dry-run бүр саналаа файлд бичиж, `--apply` тэр файлыг л
 * хэрэглэнэ (LLM дуудахгүй, $0).
 *
 * `sourceHash` нь эх нийтлэл болон нийтлэлийн одоогийн текстээс гарна: dry-run
 * хийснээс хойш нийтлэл өөрчлөгдсөн бол (өөр хүн /admin дээр зассан, дахин
 * улирсан) хуучин саналыг хэрэглэх нь аюултай — hash зөрвөл няцаана.
 */
import { createHash } from "node:crypto";
import type { FixOut } from "./fix.api";
import type { FieldIssue } from "./prepublish.api";
import type { ClaimIssue } from "./audit.api";

/** Файлын нэрэнд орох УБ огноо */
export function ubDay(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** Хадгалсан саналын файлын нэр: 2026-09-30-<slug>.json */
export function planFileName(now: Date, slug: string): string {
  return `${ubDay(now)}-${slug}.json`;
}

/** Нэг өдрийн бүтэн гаралтын файлын нэр */
export function logFileName(now: Date): string {
  return `${ubDay(now)}.txt`;
}

/**
 * Нийтлэлийн одоогийн байдлын хурууны хээ.
 *
 * Эх текст ба бидний засварлах бүх талбар орно — алинд нь ч өөрчлөлт орвол
 * хуучин санал хүчингүй болно.
 */
export function stateHash(a: {
  sourceText: string | null;
  titleMn: string | null;
  summaryMn: string | null;
  bodyMn: string | null;
  fbText: string | null;
  fbHook: string | null;
}): string {
  const h = createHash("sha256");
  for (const v of [a.sourceText, a.titleMn, a.summaryMn, a.bodyMn, a.fbText, a.fbHook]) {
    h.update(v ?? "\u0000");
    h.update("\u001f"); // талбарын зааг — залгаснаас болж хоёрдмол утга гарахгүй
  }
  return h.digest("hex").slice(0, 32);
}

/** Диск дээр хадгалагдах бичлэг */
export interface StoredPlan {
  /** Формат хувилбар — дараа өөрчлөгдвөл хуучныг таньж татгалзана */
  version: 1;
  slug: string;
  /** Dry-run хийсэн агшин (ISO) */
  at: string;
  stateHash: string;
  before: {
    titleMn: string;
    summaryMn: string;
    bodyMn: string;
    fbText: string | null;
    fbHook: string | null;
  };
  proposed: FixOut;
  issues: FieldIssue[];
  claims: ClaimIssue[];
  /** Засварын дараа үлдсэн НОЦТОЙ зөрчлүүд */
  blocking: FieldIssue[];
  /** Зассан FB текстээс гарсан IG тайлбар ба шүүгчийн дүгнэлт */
  igCaption: { text: string; ok: boolean; issues: string[] } | null;
  /** Үсгийн алдаа, олдмол үг */
  spell: { word: string; suggestion: string; where: string }[];
  costUsd: number;
}

export const PLAN_VERSION = 1 as const;

export type LoadVerdict =
  | { ok: true; plan: StoredPlan }
  | { ok: false; reason: string };

/** Хадгалсан саналыг хэрэглэж болох эсэх */
export function validateStored(raw: unknown, current: { stateHash: string; slug: string }): LoadVerdict {
  const p = raw as Partial<StoredPlan> | null;
  if (!p || typeof p !== "object") return { ok: false, reason: "файл уншигдсангүй" };
  if (p.version !== PLAN_VERSION) {
    return { ok: false, reason: `формат ${String(p.version)} — энэ хувилбар ${PLAN_VERSION}` };
  }
  if (p.slug !== current.slug) return { ok: false, reason: `өөр нийтлэлийн санал (${String(p.slug)})` };
  if (!p.proposed?.bodyMn) return { ok: false, reason: "саналын биет хоосон" };
  if (p.stateHash !== current.stateHash) {
    return {
      ok: false,
      reason:
        "dry-run хийснээс хойш нийтлэл эсвэл эх текст ӨӨРЧЛӨГДСӨН — хуучин саналыг " +
        "хэрэглэхгүй. Dry-run-ыг дахин ажиллуулна уу.",
    };
  }
  return { ok: true, plan: p as StoredPlan };
}
