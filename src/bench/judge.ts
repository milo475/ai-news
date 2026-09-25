/**
 * Шүүгчийн дуудлага.
 */
import { chatJson } from "../agent/llm";
import {
  combineScores, JUDGE_SCHEMA, JUDGE_SYSTEM, judgeUser, needsSecondJudge, parseScore,
  type JudgeOutput,
} from "./judge.api";
import type { RubricItem } from "./task.api";

type Chat = typeof chatJson;

export interface JudgeInput {
  taskTitle: string;
  prompt: string;
  reference: string | null;
  rubric: RubricItem[];
  output: string;
}

export interface JudgeVerdict {
  score: number | null;
  score2: number | null;
  note: string;
  costUsd: number;
}

async function askJudge(
  model: string,
  input: JudgeInput,
  chat: Chat,
): Promise<{ score: number | null; note: string; costUsd: number }> {
  const out = await chat<JudgeOutput>({
    model,
    system: JUDGE_SYSTEM,
    user: judgeUser(input),
    schema: JUDGE_SCHEMA,
    // Бодох моделийн reasoning токен max_tokens-оос иддэг — 500 дээр заримдаа тасардаг байсан
    maxTokens: 1_200,
    temperature: 0,
    reasoning: false,
  });
  return {
    score: parseScore(out.data.score),
    note: (out.data.note ?? "").trim().slice(0, 500),
    costUsd: out.costUsd,
  };
}

/**
 * Хариултыг үнэлнэ. Шүүгч өөрийн компанийн моделийг үнэлж байвал хоёр дахь
 * шүүгчээр давхар үнэлж дунджална.
 */
export async function judge(
  input: JudgeInput,
  target: { modelSlug: string; judgeModel: string; judgeModel2: string | null },
  opts: { chat?: Chat } = {},
): Promise<JudgeVerdict> {
  const chat = opts.chat ?? chatJson;
  let costUsd = 0;

  const first = await askJudge(target.judgeModel, input, chat);
  costUsd += first.costUsd;

  const second =
    target.judgeModel2 && needsSecondJudge(target.judgeModel, target.modelSlug)
      ? await askJudge(target.judgeModel2, input, chat)
      : null;
  if (second) costUsd += second.costUsd;

  return {
    score: combineScores(first.score, second?.score ?? null),
    score2: second?.score ?? null,
    note: second ? `${first.note} | 2: ${second.note}` : first.note,
    costUsd,
  };
}
