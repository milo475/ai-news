/**
 * Студийн LLM урсгал — асуулт → brief → чиглэл → эцсийн гаргалт.
 *
 * Зардлыг алхам бүрт нэмж, дуудагчид буцаана (өдрийн төсөв хянана).
 * Асуулт/чиглэл нь хямд модель (SCORE_MODEL), эцсийн гаргалт нь сайн модель
 * (WRITE_MODEL) — гаргалт нь бүтээгдэхүүний чанарыг тодорхойлно.
 */
import { chatJson } from "../agent/llm";
import { craftDoc, ideasDoc, isMarketing, mongolDoc, toolDocs } from "./knowledge";
import {
  aspectFor, toolById, TOOLS, type StudioFormat, type StudioTool,
} from "./studio.api";
import {
  BRIEF_SCHEMA, BRIEF_SYSTEM, briefUser, DIRECTIONS_SCHEMA, DIRECTIONS_SYSTEM,
  orderDirections, QUESTION_SCHEMA, QUESTION_SYSTEM, questionUser, withExtras, briefText,
  type StudioBrief, type StudioDirection, type StudioQuestion,
} from "./prompts.api";
import { checkOutput, ISSUE_FEEDBACK, type StudioOutput, type ToolOutput } from "./output.api";
import {
  PLAN_SCHEMA, PLAN_SYSTEM, planUser, toolSchema, toolSystem, toolUser, type StepTimings,
} from "./parallel.api";
import { stripUnverified, type NumberClaim } from "./numbers.api";
import {
  applyRevision, REVISE_SCHEMA, REVISE_SYSTEM, reviseUser, type RevisionOut,
} from "./revise.api";

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

export interface BuildContext {
  brief: StudioBrief;
  format: StudioFormat;
  placement?: string | null;
  direction: StudioDirection;
  toolIds: string[];
  request?: string;
}

/** Дуудлага бүрт ижил хэрэгтэй лавлахууд — нэг удаа бэлдээд дахин ашиглана */
function context(a: BuildContext) {
  const tools = a.toolIds
    .map((id) => toolById(id, TOOLS))
    .filter((t): t is StudioTool => Boolean(t) && !t!.retired);
  const marketing = isMarketing(`${a.request ?? ""} ${a.brief.goal} ${a.brief.message}`);
  return {
    tools,
    aspect: aspectFor(a.format, a.placement),
    craft: craftDoc(),
    mongol: mongolDoc(),
    // Бүтээлч зарчмыг ЗӨВХӨН маркетингийн хүсэлтэд — бусад үед токен дэмий
    ideas: marketing ? ideasDoc() : undefined,
  };
}

/**
 * НЭГ хэрэгслийн гаргалт.
 *
 * П.1-д бүх хэрэгслийг нэг 12 000-токент дуудлагаар бичүүлдэг байсан (дунджаар
 * 100с, хамгийн муу нь 187с). Одоо хэрэгсэл бүр өөрийн жижиг дуудлагатай ба
 * зөвхөн ӨӨРИЙН лавлах ордог тул 3–4 дахин бага токен, зэрэг ажиллана.
 *
 * Тоон мэдэгдэл бүрийг тухайн хэрэгслийн лавлахтай тулгана: лавлахад байхгүй
 * тоог хасаж, «албан ёсны сайтаас шалгана уу» болгоно.
 */
export async function buildOneTool(
  a: BuildContext,
  toolId: string,
  opts: { chat?: Chat } = {},
): Promise<{ output: ToolOutput; stripped: NumberClaim[] } & Cost> {
  const chat = opts.chat ?? chatJson;
  const { aspect, craft, mongol, ideas } = context(a);
  const tool = toolById(toolId, TOOLS);
  if (!tool || tool.retired) throw new Error(`«${toolId}» хэрэгсэл олдсонгүй`);

  const doc = toolDocs([tool.doc])[tool.doc] ?? "";
  const out = await chat<Omit<ToolOutput, "tool">>({
    model: writeModel(),
    system: toolSystem(a.format, tool),
    user: toolUser({ brief: a.brief, format: a.format, aspect, direction: a.direction, tool, doc, craft, mongol, ideas }),
    schema: toolSchema(a.format),
    // 8000: 4000 дээр таслагдаад 2 дахин өргөтгөх retry ажиллаж, хугацаа
    // ХОЁР ДАХИН нэмэгдэж байсан (2026-09-28-ны eval). Бодох модель дотоод
    // бодолтдоо ~1200 токен иддэг, дээр нь бэлэн эх бичвэр орно.
    maxTokens: 8_000,
    temperature: 0.6,
    reasoning: false,
  });

  const fixed = fixNumbers({ ...out.data, tool: tool.id }, doc);
  return { output: fixed.output, stripped: fixed.removed, costUsd: out.costUsd };
}

/** Ерөнхий төлөвлөгөө — кадар, дүрийн тогтвортой байдал, хөгжим, угсралт, санаа */
export async function buildPlan(
  a: BuildContext,
  opts: { chat?: Chat } = {},
): Promise<{ plan: Omit<StudioOutput, "tools"> } & Cost> {
  const chat = opts.chat ?? chatJson;
  const { tools, aspect, craft, mongol, ideas } = context(a);
  const out = await chat<Omit<StudioOutput, "tools">>({
    model: writeModel(),
    system: PLAN_SYSTEM,
    user: planUser({ brief: a.brief, format: a.format, aspect, direction: a.direction, tools, craft, mongol, ideas }),
    schema: PLAN_SCHEMA,
    maxTokens: 6_000,
    temperature: 0.6,
    reasoning: false,
  });
  return { plan: out.data, costUsd: out.costUsd };
}

/**
 * Бүх хэрэгсэл + төлөвлөгөөг ЗЭРЭГ үүсгэнэ.
 *
 * Нийт хугацаа = хамгийн удаан дуудлагын хугацаа. Вэб дээр нь хэрэгсэл тус бүрийг
 * тусдаа action-оор дууддаг тул карт бэлэн болмогц нь гарна; энэ функц нь eval,
 * CLI зэрэг нэг дор бүгдийг хүсдэг дуудагчдад.
 */
export async function buildOutput(
  a: BuildContext,
  opts: { chat?: Chat; onTool?: (toolId: string) => void } = {},
): Promise<{
  output: StudioOutput;
  tools: StudioTool[];
  issues: string[];
  stripped: NumberClaim[];
} & Cost> {
  const { tools } = context(a);
  if (tools.length === 0) throw new Error("Хэрэгсэл сонгогдоогүй байна");

  const [toolResults, planResult] = await Promise.all([
    Promise.all(
      tools.map(async (t) => {
        const r = await buildOneTool(a, t.id, opts);
        opts.onTool?.(t.id);
        return r;
      }),
    ),
    buildPlan(a, opts),
  ]);

  const output = normalize({ ...planResult.plan, tools: toolResults.map((r) => r.output) });
  const issues = checkOutput(output, { format: a.format, toolIds: tools.map((t) => t.id) })
    .map((i) => ISSUE_FEEDBACK[i]);

  return {
    output,
    tools,
    issues,
    stripped: toolResults.flatMap((r) => r.stripped),
    costUsd: toolResults.reduce((n, r) => n + r.costUsd, 0) + planResult.costUsd,
  };
}

/** Хэрэгслийн гаргалтын БҮХ текстээс баталгаажаагүй тоог хасна */
function fixNumbers(t: ToolOutput, doc: string): { output: ToolOutput; removed: NumberClaim[] } {
  const removed: NumberClaim[] = [];
  const clean = (text: string): string => {
    const r = stripUnverified(text, doc);
    removed.push(...r.removed);
    return r.text;
  };
  return {
    output: {
      ...t,
      steps: (t.steps ?? []).map(clean),
      params: (t.params ?? []).map((p) => ({ ...p, why: clean(p.why) })),
      parts: (t.parts ?? []).map((p) => ({ ...p, why: clean(p.why) })),
      ...(t.draft ? { draft: t.draft } : {}),
    },
    removed,
  };
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

// ---------- Засах давталт ----------

/**
 * Vision чадвартай хямд модель — гарсан зургийг брифтэй харьцуулна.
 * Тусад нь тохируулаагүй бол WRITE_MODEL (Gemini Flash нь зураг уншина).
 */
export function visionModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.STUDIO_VISION_MODEL ?? env.WRITE_MODEL ?? "google/gemini-3.8-flash";
}

/**
 * Нэг хэрэгслийн промптыг засварлана.
 *
 * `imageDataUrl` нь санах ойд байгаа зураг — энэ дуудлагад л ашиглагдаад алга
 * болно. Дискэнд ч, DB-д ч бичигдэхгүй.
 */
export async function reviseTool(
  a: {
    brief: StudioBrief;
    tool: StudioTool;
    previous: ToolOutput;
    note: string;
    imageDataUrl?: string;
  },
  opts: { chat?: Chat } = {},
): Promise<{ revision: RevisionOut; output: ToolOutput } & Cost> {
  const chat = opts.chat ?? chatJson;
  const out = await chat<RevisionOut>({
    model: visionModel(),
    system: REVISE_SYSTEM,
    user: reviseUser({
      brief: a.brief,
      tool: a.tool.name,
      previousPrompt: a.previous.prompt,
      note: a.note,
      hasImage: Boolean(a.imageDataUrl),
    }),
    ...(a.imageDataUrl ? { imageDataUrl: a.imageDataUrl } : {}),
    schema: REVISE_SCHEMA,
    maxTokens: 2_500,
    temperature: 0.4,
    reasoning: false,
  });

  // Засварласан промптод ч тоог шалгана
  const doc = toolDocs([a.tool.doc])[a.tool.doc] ?? "";
  const revision: RevisionOut = {
    ...out.data,
    diagnosis: stripUnverified(out.data.diagnosis, doc).text,
    changes: (out.data.changes ?? []).map((c) => stripUnverified(c, doc).text),
    tip: stripUnverified(out.data.tip, doc).text,
  };
  return { revision, output: applyRevision(a.previous, revision), costUsd: out.costUsd };
}
