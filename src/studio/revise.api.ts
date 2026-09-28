/**
 * Засах давталт — «үр дүн таарахгүй байна» гэсэн хэрэглэгчид.
 *
 * Хоёр оролт: юу нь буруу байгааг бичсэн текст, ба заавал биш — ГАРСАН ЗУРАГ.
 * Зургийг санах ойд л боловсруулна: DB-д ч, дискэнд ч хадгалахгүй, EXIF-гүй.
 */
import type { StudioBrief } from "./prompts.api";
import { briefText } from "./prompts.api";
import type { ToolOutput } from "./output.api";

/** Нэг сессэд хэдэн удаа засварлаж болох вэ */
export const MAX_REVISIONS = 3;

/** Зургийн дээд хэмжээ */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImageReject = "хэт том" | "буруу төрөл" | "хоосон";

export function checkImage(file: { size: number; type: string } | null): ImageReject | null {
  if (!file || file.size === 0) return "хоосон";
  if (file.size > MAX_IMAGE_BYTES) return "хэт том";
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return "буруу төрөл";
  return null;
}

export const IMAGE_REJECT_MESSAGE: Record<ImageReject, string> = {
  "хэт том": `Зураг ${MAX_IMAGE_BYTES / 1024 / 1024}MB-аас бага байх ёстой.`,
  "буруу төрөл": "Зөвхөн JPG, PNG, WEBP.",
  хоосон: "Зураг сонгогдоогүй байна.",
};

export function revisionsLeft(used: number): number {
  return Math.max(0, MAX_REVISIONS - used);
}

// ---------- LLM ----------

export interface RevisionOut {
  /** Юу зөрсөнийг монголоор, 2–4 өгүүлбэр */
  diagnosis: string;
  /** Засварласан промпт — анхны промптын хэлээр */
  prompt: string;
  /** Юуг яаж өөрчилснийг монголоор, 2–4 мөр */
  changes: string[];
  /** Дараагийн оролдлогод анхаарах зүйл, монголоор */
  tip: string;
}

export const REVISE_SCHEMA = {
  type: "object",
  properties: {
    diagnosis: { type: "string", description: "Юу зөрсөнийг монголоор, 2–4 өгүүлбэр" },
    prompt: { type: "string", description: "Засварласан промпт, анхныхтай ижил хэлээр" },
    changes: {
      type: "array", minItems: 2, maxItems: 5, items: { type: "string" },
      description: "Юуг яаж өөрчилснийг монголоор",
    },
    tip: { type: "string", description: "Дараагийн оролдлогод анхаарах зүйл, монголоор" },
  },
  required: ["diagnosis", "prompt", "changes", "tip"],
  additionalProperties: false,
};

export const REVISE_SYSTEM = `Чи AI промптын засварчин. Хэрэглэгч промптоор зураг/видео/бичвэр
гаргасан ч үр дүн нь хүссэнээрээ гараагүй байна.

Даалгавар:
1. diagnosis — ДААЛГАВАР (brief) болон гарсан үр дүнг харьцуулж юу зөрсөнийг
   МОНГОЛООР тайлбарла. Зураг өгөгдсөн бол түүнийг нягт хараад бодитоор дүрсэл:
   юу байх ёстой байсан, юу гарсан бэ. Ерөнхий үг бүү хэл.
2. prompt — засварласан промпт. Анхны промптын ХЭЛИЙГ хадгал (англи бол англи).
   Зөрсөн зүйлийг шийдэх ТОДОРХОЙ үг нэм; ажиллаж байсан хэсгийг бүү хөнд.
3. changes — юуг яаж өөрчилснийг монголоор, мөр бүр нэг өөрчлөлт.
4. tip — дараагийн оролдлогод анхаарах нэг зүйл, монголоор.

ДҮРЭМ:
- Зураг дээр кирилл текст гаргах гэж бүү оролд — текстийг Canva/CapCut дээр нэмнэ.
- Кредит, хязгаар, үнэ зэрэг ТООГ бүү зохио.
- Хэрэглэгчийг бүү зэмлэ. «Та буруу бичсэн» гэхгүй, «промптод … дутуу байсан» гэж хэл.`;

export function reviseUser(a: {
  brief: StudioBrief;
  tool: string;
  previousPrompt: string;
  note: string;
  hasImage: boolean;
}): string {
  return [
    `ХЭРЭГСЭЛ: ${a.tool}`,
    "",
    "ДААЛГАВАР:",
    briefText(a.brief),
    "",
    "ӨМНӨХ ПРОМПТ:",
    a.previousPrompt,
    "",
    `ХЭРЭГЛЭГЧ ЮУ ГЭСЭН БЭ: ${a.note.trim()}`,
    a.hasImage
      ? "\nГарсан зургийг хавсаргав — түүнийг нягт хараад дүгнэ."
      : "\nЗураг хавсаргаагүй — хэрэглэгчийн тайлбар дээр тулгуурла.",
  ].join("\n");
}

/** Засварыг өмнөх гаргалтад суулгана */
export function applyRevision(tool: ToolOutput, r: RevisionOut): ToolOutput {
  return { ...tool, prompt: r.prompt.trim() || tool.prompt };
}
