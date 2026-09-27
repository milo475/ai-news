/**
 * Гарчгийн үнэн зөв байдлын шүүгч — хямд моделиор нэг дуудлага.
 *
 * `pickHook`-ийн ДАРААХ шат: оноогоор хамгийн сайн гарчиг ч эх мэдээг хэтрүүлсэн бол
 * ашиглахгүй. Оноо нь үнэн зөв байдлаас хэзээ ч давуу биш.
 */
import { chatJson } from "../agent/llm";
import {
  dropsAttribution, FIDELITY_SCHEMA, FIDELITY_SYSTEM, fidelityUser, normalizeVerdict,
  type FidelityInput, type FidelityVerdict,
} from "./fidelity.api";

type Chat = typeof chatJson;

/** Шүүгчийн модель — гарчиг богино тул хямд нь хангалттай */
export function fidelityModel(env: Record<string, string | undefined> = process.env): string {
  return (env.FIDELITY_MODEL ?? "").trim() || env.SCORE_MODEL || "deepseek/deepseek-v4.1-flash";
}

export interface FidelityResult extends FidelityVerdict {
  costUsd: number;
}

/**
 * Гарчгийг нийтлэлтэй харьцуулна.
 *
 * Шүүгч өөрөө унавал **үнэнч гэж тооцно** — нэг дуудлага унасны улмаас карт
 * бүхэлдээ үүсэхгүй байх нь илүү муу. Механик шалгалт (ишлэл) нь хэвээр ажиллана.
 */
export async function judgeFidelity(
  a: FidelityInput,
  opts: { chat?: Chat } = {},
): Promise<FidelityResult> {
  // 1. Механик: эх мэдээ буруутгал/мэдэгдэл атал гарчиг нь шууд батлан хэлж байвал
  const sourceText = [a.titleMn, a.summaryMn].filter(Boolean).join(" ");
  if (dropsAttribution(a.hook, sourceText)) {
    return {
      faithful: false,
      issues: ["Эх мэдээ нь буруутгал/мэдэгдэл байтал гарчиг нь болсон баримт мэт бичсэн — «...гэж буруутгав», «...хэмээн шүүхэд өгчээ» гэх мэтээр эх сурвалжийг үлдээ."],
      costUsd: 0,
    };
  }

  // 2. LLM шүүгч
  const chat = opts.chat ?? chatJson;
  try {
    const out = await chat<FidelityVerdict>({
      model: fidelityModel(),
      system: FIDELITY_SYSTEM,
      user: fidelityUser(a),
      schema: FIDELITY_SCHEMA,
      maxTokens: 1_200,
      temperature: 0,
      reasoning: false,
    });
    return { ...normalizeVerdict(out.data), costUsd: out.costUsd };
  } catch (e) {
    console.warn(`  ⚠ fidelity шүүгч ажиллсангүй: ${(e as Error).message.slice(0, 120)}`);
    return { faithful: true, issues: [], costUsd: 0 };
  }
}
