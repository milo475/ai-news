/**
 * Студийн LLM урсгал — асуулт → brief → чиглэл → эцсийн гаргалт.
 *
 * Зардлыг алхам бүрт нэмж, дуудагчид буцаана (өдрийн төсөв хянана).
 * Асуулт/чиглэл нь хямд модель (SCORE_MODEL), эцсийн гаргалт нь сайн модель
 * (WRITE_MODEL) — гаргалт нь бүтээгдэхүүний чанарыг тодорхойлно.
 */
import { chatJson } from "../agent/llm";
import { craftDoc, mongolDoc, toolDocs } from "./knowledge";
import {
  aspectFor, toolById, TOOLS, type StudioFormat, type StudioTool,
} from "./studio.api";
import {
  BRIEF_SCHEMA, BRIEF_SYSTEM, briefUser, DIRECTIONS_SCHEMA, DIRECTIONS_SYSTEM,
  orderDirections, QUESTION_SCHEMA, QUESTION_SYSTEM, questionUser, withExtras, briefText,
  type StudioBrief, type StudioDirection, type StudioQuestion,
} from "./prompts.api";
import {
  checkOutput, ISSUE_FEEDBACK, OUTPUT_SCHEMA, outputSystem, outputUser,
  type StudioOutput,
} from "./output.api";

type Chat = typeof chatJson;

export function scoreModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.SCORE_MODEL ?? "deepseek/deepseek-v4.1-flash";
}

export function writeModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.WRITE_MODEL ?? env.SCORE_MODEL ?? "deepseek/deepseek-v4.1-flash";
}

export interface Cost {
  costUsd: number;
}

/** 1. Тодруулах асуултууд */
export async function askQuestions(
  a: { request: string; format: StudioFormat; known: string[]; round: number },
  opts: { chat?: Chat } = {},
): Promise<{ questions: StudioQuestion[] } & Cost> {
  const chat = opts.chat ?? chatJson;
  const out = await chat<{ questions: StudioQuestion[] }>({
    model: scoreModel(),
    system: QUESTION_SYSTEM,
    user: questionUser(a),
    schema: QUESTION_SCHEMA,
    // Кирилл нь токен идэмхий: 5 асуулт × 5 сонголт ≈ 900 токен
    maxTokens: 2_500,
    temperature: 0.4,
    reasoning: false,
  });
  const questions = (out.data.questions ?? [])
    .filter((q) => !a.known.includes(q.field))
    .map((q) => ({ ...q, options: withExtras(q.options ?? []) }));
  return { questions, costUsd: out.costUsd };
}

/** 2. Бүтэцтэй даалгавар */
export async function buildBrief(
  a: { request: string; format: StudioFormat; answers: Record<string, string>; placement?: string | null },
  opts: { chat?: Chat } = {},
): Promise<{ brief: StudioBrief } & Cost> {
  const chat = opts.chat ?? chatJson;
  const out = await chat<StudioBrief>({
    model: scoreModel(),
    system: BRIEF_SYSTEM,
    user: briefUser({ ...a, aspect: aspectFor(a.format, a.placement) }),
    schema: BRIEF_SCHEMA,
    maxTokens: 3_000,
    temperature: 0.4,
    reasoning: false,
  });
  return { brief: out.data, costUsd: out.costUsd };
}

/** 3. Гурван чиглэл */
export async function buildDirections(
  a: { brief: StudioBrief; format: StudioFormat },
  opts: { chat?: Chat } = {},
): Promise<{ directions: StudioDirection[] } & Cost> {
  const chat = opts.chat ?? chatJson;
  const out = await chat<{ directions: StudioDirection[] }>({
    model: scoreModel(),
    system: DIRECTIONS_SYSTEM,
    user: `Хэлбэр: ${a.format}\n\nДААЛГАВАР:\n${briefText(a.brief)}`,
    schema: DIRECTIONS_SCHEMA,
    maxTokens: 3_000,
    temperature: 0.7,
    reasoning: false,
  });
  return { directions: orderDirections(out.data.directions ?? []), costUsd: out.costUsd };
}

/**
 * 4. Эцсийн гаргалт.
 *
 * Шалгалт (checkOutput) унавал НЭГ удаа засуулна — хамгийн түгээмэл алдаа нь
 * промптыг монголоор, тайлбарыг англиар бичих.
 */
export async function buildOutput(
  a: {
    brief: StudioBrief;
    format: StudioFormat;
    placement?: string | null;
    direction: StudioDirection;
    toolIds: string[];
  },
  opts: { chat?: Chat } = {},
): Promise<{ output: StudioOutput; tools: StudioTool[]; issues: string[] } & Cost> {
  const chat = opts.chat ?? chatJson;
  const tools = a.toolIds
    .map((id) => toolById(id, TOOLS))
    .filter((t): t is StudioTool => Boolean(t) && !t!.retired);
  if (tools.length === 0) throw new Error("Хэрэгсэл сонгогдоогүй байна");

  const user = outputUser({
    brief: a.brief,
    format: a.format,
    aspect: aspectFor(a.format, a.placement),
    direction: a.direction,
    tools,
    docs: Object.fromEntries(tools.map((t) => [t.id, toolDocs([t.doc])[t.doc] ?? ""])),
    craft: craftDoc(),
    mongol: mongolDoc(),
  });

  let costUsd = 0;
  let last: StudioOutput | null = null;
  let issues: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const feedback = issues.length
      ? `\n\n=== ӨМНӨХ ОРОЛДЛОГЫН АЛДАА (заавал засаарай) ===\n${issues.join("\n")}`
      : "";
    const out = await chat<StudioOutput>({
      model: writeModel(),
      system: outputSystem(a.format),
      user: user + feedback,
      schema: OUTPUT_SCHEMA,
      // Видеоны 8 кадар + 3 хэрэгслийн тайлбар нь урт: монгол кирилл токен идэмхий
      maxTokens: 12_000,
      temperature: 0.6,
      reasoning: false,
    });
    costUsd += out.costUsd;
    last = normalize(out.data);
    const found = checkOutput(last, { format: a.format, toolIds: tools.map((t) => t.id) });
    if (found.length === 0) return { output: last, tools, issues: [], costUsd };
    issues = found.map((i) => ISSUE_FEEDBACK[i]);
  }

  // Хоёр дахь оролдлого ч төгс биш — гаргалт байгаа тул хэрэглэгчид өгнө,
  // үлдсэн алдааг нь тэмдэглэнэ (шинжилгээнд хэрэгтэй)
  if (!last) throw new Error("Студи гаргалт өгсөнгүй");
  return { output: last, tools, issues, costUsd };
}

/** LLM-ийн буцаасныг ашиглахад бэлэн болгоно — дутуу массивыг хоосноор нөхнө */
function normalize(raw: StudioOutput): StudioOutput {
  const storyboard = (raw.storyboard ?? []).map((s, i) => ({ ...s, n: s.n || i + 1 }));
  return {
    tools: (raw.tools ?? []).map((t) => ({
      ...t,
      params: t.params ?? [],
      parts: t.parts ?? [],
      steps: t.steps ?? [],
    })),
    storyboard,
    consistency: raw.consistency ?? "",
    music: raw.music ?? null,
    assembly: raw.assembly ?? [],
    ideas: raw.ideas ?? [],
  };
}
