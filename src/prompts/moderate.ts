/**
 * Автомат шалгалт — LLM дуудлага.
 */
import { chatJson } from "../agent/llm";
import {
  decide, decideStudio, hardBlock, MODERATE_SCHEMA, MODERATE_SYSTEM, STUDIO_MODERATE_SCHEMA,
  STUDIO_MODERATE_SYSTEM, STUDIO_REJECT_LABEL,
  type ModerationOutput, type StudioModerationOutput, type StudioVerdict, type Verdict,
} from "./moderate.api";

type Chat = typeof chatJson;

export async function moderatePrompt(
  input: { title: string; description: string; body: string },
  opts: { chat?: Chat } = {},
): Promise<Verdict> {
  const chat = opts.chat ?? chatJson;
  try {
    const out = await chat<ModerationOutput>({
      model: process.env.SCORE_MODEL ?? "deepseek/deepseek-v4.1-flash",
      system: MODERATE_SYSTEM,
      user: [
        `Гарчиг: ${input.title}`,
        `Тайлбар: ${input.description}`,
        `Prompt:\n${input.body.slice(0, 3_000)}`,
      ].join("\n"),
      schema: MODERATE_SCHEMA,
      // Кирилл текст токен идэмхий; бодох модель max_tokens-оос иддэг
      maxTokens: 1_500,
      temperature: 0,
      reasoning: false,
    });
    return decide(out.data);
  } catch (e) {
    // Шалгалт ажиллаагүй нь хэрэглэгчийн буруу биш — админд үлдээнэ
    console.warn(`  ⚠ prompt шалгалт ажиллсангүй: ${(e as Error).message.slice(0, 120)}`);
    return decide(null);
  }
}

/**
 * Студийн хүсэлтийн шалгалт.
 *
 * Эхлээд механик шүүлт (үнэгүй), дараа нь LLM. Дуудлага унавал зөвшөөрнө —
 * механик шүүлт хэвээр хамгаална.
 */
export async function moderateStudioRequest(
  request: string,
  opts: { chat?: Chat } = {},
): Promise<StudioVerdict> {
  const hard = hardBlock(request);
  if (hard) return { ok: false, reason: hard, message: STUDIO_REJECT_LABEL[hard] };

  const chat = opts.chat ?? chatJson;
  try {
    const out = await chat<StudioModerationOutput>({
      model: process.env.SCORE_MODEL ?? "deepseek/deepseek-v4.1-flash",
      system: STUDIO_MODERATE_SYSTEM,
      user: request.slice(0, 2_000),
      schema: STUDIO_MODERATE_SCHEMA,
      maxTokens: 1_000,
      temperature: 0,
      reasoning: false,
    });
    return decideStudio(out.data);
  } catch (e) {
    console.warn(`  ⚠ студийн шалгалт ажиллсангүй: ${(e as Error).message.slice(0, 120)}`);
    return decideStudio(null);
  }
}
