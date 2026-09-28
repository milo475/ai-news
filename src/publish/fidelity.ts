/**
 * Гарчгийн үнэн зөв байдлын шүүгч — хямд моделиор нэг дуудлага.
 *
 * `pickHook`-ийн ДАРААХ шат: оноогоор хамгийн сайн гарчиг ч эх мэдээг хэтрүүлсэн бол
 * ашиглахгүй. Оноо нь үнэн зөв байдлаас хэзээ ч давуу биш.
 */
import { chatJson } from "../agent/llm";
import { ubDateLabel } from "../jobs/day";
import {
  dropsAttribution, dropsHedge, dropsRelay, FIDELITY_BODY_CHARS, FIDELITY_DAILY_WARN,
  FIDELITY_SCHEMA, fidelitySystem, fidelityUser, hardensSpeculation, isUsableVerdict,
  normalizeVerdict, type FidelityInput, type FidelityVerdict,
} from "./fidelity.api";

type Chat = typeof chatJson;

/** Шүүгчийн модель — гарчиг богино тул хямд нь хангалттай */
export function fidelityModel(env: Record<string, string | undefined> = process.env): string {
  return (env.FIDELITY_MODEL ?? "").trim() || env.SCORE_MODEL || "deepseek/deepseek-v4.1-flash";
}

export interface FidelityResult extends FidelityVerdict {
  costUsd: number;
  /**
   * Шүүгч шийдвэр гаргаж чадсан эсэх.
   *
   * `false` = дуудлага унасан, хоосон эсвэл таслагдсан → **шийдвэр байхгүй**.
   * Ийм үед гарчгийг «үнэнч» гэж хүлээн авч БОЛОХГҮЙ: шалгагдаагүй гарчиг нь
   * шалгагдаад унасантай ижил эрсдэлтэй. Дуудагч нь нийтлэлийн өөрийн гарчгийг ашиглана.
   */
  ok: boolean;
}

/**
 * Шалгаж буй текстийг (гарчиг, FB текст, IG тайлбар) нийтлэлтэй харьцуулна.
 *
 * Шүүгч унавал `ok: false` — гарчгийг хүлээн авахгүй. Өмнө нь «үнэнч» гэж тооцдог
 * байсан нь шалгагдаагүй гарчиг нийтэд гарах цоорхой байв.
 */
export async function judgeFidelity(
  a: FidelityInput,
  opts: { chat?: Chat } = {},
): Promise<FidelityResult> {
  // 1. Механик шалгалтууд — LLM дуудахгүйгээр илт зөрчлийг барина
  const sourceText = [a.titleMn, a.summaryMn].filter(Boolean).join(" ");
  if (dropsAttribution(a.hook, sourceText)) {
    return {
      ok: true,
      faithful: false,
      issues: ["Эх мэдээ нь буруутгал/мэдэгдэл байтал гарчиг нь болсон баримт мэт бичсэн — «...гэж буруутгав», «...хэмээн шүүхэд өгчээ» гэх мэтээр эх сурвалжийг үлдээ."],
      costUsd: 0,
    };
  }

  // «түр зогсоосон» → «зогсоолоо». Биетийг ч хардаг: гарчгаас «түр» хасагдсан ч
  // нийтлэлийн биед үлдсэн байдаг (2026-09-27-ны OpenAI pauses training тохиолдол).
  const withBody = [sourceText, (a.bodyMn ?? "").slice(0, FIDELITY_BODY_CHARS)].join(" ");
  if (dropsHedge(a.hook, withBody)) {
    return {
      ok: true,
      faithful: false,
      issues: ["Эх мэдээ нь ТҮР/хэсэгчилсэн үйлдлийг хэлж байтал эцсийн, бүрэн зогссон мэт бичсэн — «түр», «зарим», «хойшлуулсан» гэдгийг үлдээ."],
      costUsd: 0,
    };
  }

  // «Bloomberg-ийн мэдээлснээр» гэсэн давхаргыг хассан эсэх
  if (dropsRelay(a.hook, sourceText)) {
    return {
      ok: true,
      faithful: false,
      issues: ["Нийтлэл нь өөр хэвлэлээс ДАМЖУУЛСАН мэдээлэл боловч гарчигт эх сурвалж нь алга — «…гэж Bloomberg мэдээлэв» гэх мэтээр дамжуулсныг үлдээ."],
      costUsd: 0,
    };
  }

  // «магадгүй / санал болгов» → «мэдэгдсэн / тогтоов»
  if (hardensSpeculation(a.hook, withBody)) {
    return {
      ok: true,
      faithful: false,
      issues: ["Эх мэдээ нь ТААМАГ (магадгүй, санал болгов, байж болзошгүй) байтал баталгаажсан баримт мэт бичсэн — «гэж үзэж байна», «байж болзошгүй» гэдгийг үлдээ."],
      costUsd: 0,
    };
  }

  // 2. LLM шүүгч
  const chat = opts.chat ?? chatJson;
  try {
    const out = await chat<FidelityVerdict>({
      model: fidelityModel(),
      system: fidelitySystem(a.kind),
      user: fidelityUser(a),
      schema: FIDELITY_SCHEMA,
      maxTokens: 1_200,
      temperature: 0,
      reasoning: false,
    });
    // Хоосон/дутуу хариу — шийдвэр биш
    if (!isUsableVerdict(out.data)) {
      await recordJudgeFailure(new Error(`шүүгч дутуу хариу буцаав: ${JSON.stringify(out.data).slice(0, 200)}`));
      return { ok: false, faithful: false, issues: [], costUsd: out.costUsd };
    }
    return { ok: true, ...normalizeVerdict(out.data), costUsd: out.costUsd };
  } catch (e) {
    await recordJudgeFailure(e);
    return { ok: false, faithful: false, issues: [], costUsd: 0 };
  }
}

/**
 * Шүүгчийн алдааг /admin/aldaa-д бүртгэнэ.
 *
 * Мөрийн түлхүүрт УБ-ийн өдрийг оруулсан тул `count` нь **тухайн өдрийн** тоо болно —
 * өдөрт FIDELITY_DAILY_WARN-оос их бол анхааруулна (шүүгч эвдэрсэн байж болзошгүй).
 * Бүртгэл өөрөө унах нь картыг унагаах ёсгүй.
 */
async function recordJudgeFailure(error: unknown): Promise<void> {
  const message = (error as Error).message?.slice(0, 120) ?? String(error);
  try {
    // Залхуу импорт — энэ модуль зөвхөн алдаа гарах үед л DB-д хүрнэ
    const { logError } = await import("../lib/errors");
    const today = await logError({
      source: "card",
      path: `fidelity/${ubDateLabel(new Date())}`,
      error,
    });
    console.warn(
      `  ⚠ fidelity шүүгч ажиллсангүй (өнөөдөр ${today} удаа): ${message}` +
        (today > FIDELITY_DAILY_WARN ? "\n  ⚠ Шүүгч эвдэрсэн байж болзошгүй — /admin/aldaa шалгана уу." : ""),
    );
  } catch {
    console.warn(`  ⚠ fidelity шүүгч ажиллсангүй: ${message}`);
  }
}
