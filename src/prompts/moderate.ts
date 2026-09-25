/**
 * Автомат шалгалт — LLM дуудлага.
 */
import { chatJson } from "../agent/llm";
import { decide, MODERATE_SCHEMA, MODERATE_SYSTEM, type ModerationOutput, type Verdict } from "./moderate.api";

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
      maxTokens: 500,
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
