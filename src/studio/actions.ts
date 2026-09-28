"use server";

/**
 * «Промпт студи»-ийн server action-ууд.
 *
 * Дөрвөн алхам: эхлэх → хариулах → бүтээх → үнэлэх. Алхам бүр нэг дэлгэц.
 * Бүх LLM дуудлага энд — клиентэд түлхүүр очихгүй.
 */
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { currentUser } from "@/auth/session";
import { moderateStudioRequest } from "@/prompts/moderate";
import { rateLimit } from "@/newsletter/rate-limit";
import { logError } from "@/lib/errors";
import {
  addCost, addSpend, asJson, bumpCount, bumpStripped, createSession, getSession, patchSession,
  recordRejected, setFeedback, spentToday, usedToday,
} from "./db";
import {
  askQuestions, buildBrief, buildDirections, buildOneTool, buildPlan, reviseTool, writeModel,
  type BuildContext,
} from "./run";
import { openRouterBalance } from "../lib/balance";
import { studioLinks } from "./links";
import { docCheckedDate } from "./knowledge";
import {
  aspectFor, defaultTools, detectFormat, FORMATS, limitLeft, OFF_MESSAGE, PLACEMENTS,
  placementById, studioOff, toolById, toolsFor, type StudioFormat,
} from "./studio.api";
import {
  askedAlready, BRIEF_FIELDS, MAX_ROUNDS, type StudioBrief, type StudioDirection, type StudioQuestion,
} from "./prompts.api";
import { warningsFor, type StudioOutput, type ToolOutput } from "./output.api";
import { checkImage, IMAGE_REJECT_MESSAGE, MAX_REVISIONS, revisionsLeft, type RevisionOut } from "./revise.api";
import type { StepTimings } from "./parallel.api";
import type { StudioTool } from "./studio.api";

const ANON_COOKIE = "studio_anon";
/** Хүсэлтийн урт — үүнээс урт бол шаардлагагүй (токен, зардал) */
const MAX_REQUEST = 600;

async function anonId(): Promise<string> {
  const jar = await cookies();
  const hit = jar.get(ANON_COOKIE)?.value;
  if (hit && /^[a-f0-9-]{10,40}$/i.test(hit)) return hit;
  const id = randomUUID();
  jar.set(ANON_COOKIE, id, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

async function ipOf(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

interface Who {
  userId: string | null;
  anonId: string;
  ip: string;
  loggedIn: boolean;
}

async function whoami(): Promise<Who> {
  const [user, anon, ip] = await Promise.all([currentUser(), anonId(), ipOf()]);
  return { userId: user?.id ?? null, anonId: anon, ip, loggedIn: Boolean(user) };
}

/**
 * Хэн ажлаа үргэлжлүүлж болох вэ.
 *
 * `userId` ЭСВЭЛ `anonId` таарвал болно: хэрэглэгч ажлынхаа дундуур нэвтэрч болно —
 * тэр үед session-д userId бичигдээгүй ч cookie нь хэвээр.
 */
function owns(s: { userId: string | null; anonId: string }, who: Who): boolean {
  if (s.userId && who.userId) return s.userId === who.userId;
  return s.anonId === who.anonId;
}

export interface StartResult {
  ok: boolean;
  /** Хаалттай/хязгаар/татгалзсан бол хэрэглэгчид харуулах мессеж */
  message?: string;
  sessionId?: string;
  format?: StudioFormat;
  questions?: StudioQuestion[];
  /** Өнөөдөр хэдэн бүтээл үлдсэн */
  left?: number;
}

/** 1. Хүсэлтийг шалгаж, эхний асуултуудыг гаргана */
export async function startStudio(a: {
  request: string;
  format?: string;
  placement?: string;
}): Promise<StartResult> {
  const request = a.request.trim().slice(0, MAX_REQUEST);
  if (request.length < 5) return { ok: false, message: "Юу хийхээ хоёр гурван үгээр бичээрэй." };

  const who = await whoami();

  // Хүчтэй дарлалтаас хамгаална — квотоос тусдаа, минутын хязгаар
  if (!(await rateLimit(`studio:${who.ip}`, 6, 60_000))) {
    return { ok: false, message: "Хэт олон хүсэлт. Минутын дараа дахин оролдоорой." };
  }

  const used = await usedToday(who);
  const left = limitLeft(used, who.loggedIn);
  if (left <= 0) {
    return {
      ok: false,
      message: who.loggedIn
        ? "Өнөөдрийн хязгаар дүүрлээ. Маргааш дахин үргэлжлүүлээрэй."
        : "Өнөөдрийн үнэгүй хязгаар дүүрлээ. Бүртгүүлбэл өдөрт 10 бүтээл хийх боломжтой.",
    };
  }

  const [spent, balance] = await Promise.all([spentToday(), openRouterBalance()]);
  const off = studioOff({ spentUsd: spent, balanceUsd: balance });
  if (off) return { ok: false, message: OFF_MESSAGE[off] };

  const format = (FORMATS.includes(a.format as StudioFormat) ? a.format : detectFormat(request)) as
    | StudioFormat
    | null;

  const verdict = await moderateStudioRequest(request);
  if (!verdict.ok) {
    // Татгалзлыг бүртгэнэ — /admin дээр prompt-оо сайжруулахад хэрэгтэй
    await recordRejected({
      userId: who.userId, anonId: who.anonId, request,
      format: format ?? "TEXT", reason: verdict.reason ?? "unknown",
    }).catch(() => {});
    return { ok: false, message: verdict.message ?? "Энэ хүсэлтийг гүйцэтгэж чадахгүй." };
  }

  if (!format) {
    return { ok: false, message: "Юу хийх гэж байгаагаа сонгоно уу: зураг, видео, бичвэр, дуу, слайд." };
  }

  const placement = placementById(a.placement)?.id ?? null;
  const sessionId = await createSession({
    userId: who.userId, anonId: who.anonId, request, format,
    tools: defaultTools(format), placement,
  });

  try {
    await bumpCount(who);
    const { questions, costUsd } = await askQuestions({ request, format, known: [], round: 0 });
    await Promise.all([
      addSpend({ ...who, costUsd }),
      patchSession(sessionId, { questions: asJson(questions), costUsd, model: writeModel() }),
    ]);
    return { ok: true, sessionId, format, questions, left: left - 1 };
  } catch (e) {
    await logError({ source: "studio", path: "start", error: e });
    return { ok: false, message: "Одоогоор ачаалал их байна. Хэсэг хүлээгээд дахин оролдоорой." };
  }
}

export interface AnswerResult {
  ok: boolean;
  message?: string;
  /** Дахин асуух бол */
  questions?: StudioQuestion[];
  brief?: StudioBrief;
  directions?: StudioDirection[];
  /** Санал болгож буй хэрэгслүүд */
  tools?: { id: string; name: string; note: string; free: boolean; selected: boolean }[];
  placements?: { id: string; label: string; aspect: string }[];
}

/** 2. Хариултаас brief ба 3 чиглэл. Хэрэв 1-р раунд бол хоёр дахь асуултын багц. */
export async function answerStudio(a: {
  sessionId: string;
  answers: Record<string, string>;
  round: number;
}): Promise<AnswerResult> {
  const who = await whoami();
  const s = await getSession(a.sessionId);
  if (!s || !owns(s, who)) return { ok: false, message: "Ажил олдсонгүй." };

  const answers = { ...((s.answers as Record<string, string> | null) ?? {}), ...a.answers };
  const format = s.format as StudioFormat;

  try {
    if (a.round + 1 < MAX_ROUNDS) {
      const prev = ((s.questions as StudioQuestion[] | null) ?? []);
      const known = askedAlready([prev], answers);
      const { questions, costUsd } = await askQuestions({
        request: s.request, format, known, round: a.round + 1,
      });
      await Promise.all([
        addSpend({ ...who, costUsd }),
        patchSession(a.sessionId, { answers: asJson(answers), questions: asJson([...prev, ...questions]) }),
      ]);
      // Нэмэлт асуух зүйл үлдээгүй бол шууд цааш
      if (questions.length > 0) return { ok: true, questions };
    }

    const { brief, costUsd: c1 } = await buildBrief({
      request: s.request, format, answers, placement: s.placement,
    });
    const { directions, costUsd: c2 } = await buildDirections({ brief, format });

    await Promise.all([
      addSpend({ ...who, costUsd: c1 + c2 }),
      patchSession(a.sessionId, { answers: asJson(answers), brief: asJson(brief), directions: asJson(directions) }),
    ]);

    const selected = new Set(s.tools);
    return {
      ok: true,
      brief,
      directions,
      tools: toolsFor(format).map((t) => ({
        id: t.id, name: t.name, note: t.note, free: t.free, selected: selected.has(t.id),
      })),
      placements: PLACEMENTS.filter((p) => p.formats.includes(format)).map((p) => ({
        id: p.id, label: p.label, aspect: p.aspect,
      })),
    };
  } catch (e) {
    await logError({ source: "studio", path: "answer", error: e });
    return { ok: false, message: "Бэлтгэх явцад алдаа гарлаа. Дахин оролдоорой." };
  }
}

export interface CreateResult {
  ok: boolean;
  message?: string;
  /** Зэрэг үүсгэх хэрэгслүүд — клиент тус бүрд нь `createTool` дуудна */
  tools?: { id: string; name: string }[];
  aspect?: string;
}

/**
 * 3a. Бүтээхэд бэлтгэнэ — бриф, чиглэл, хэрэгслээ хадгалж, хэрэгслийн жагсаалт өгнө.
 *
 * Гаргалт нь ХЭРЭГСЭЛ ТУС БҮРЭЭР тусдаа дуудлагаар үүснэ (`createTool`), клиент
 * тэднийг зэрэг дуудаж, бэлэн болсон картыг шууд харуулна.
 */
export async function createStudio(a: {
  sessionId: string;
  brief: Record<string, string>;
  direction: string;
  toolIds: string[];
  placement?: string;
}): Promise<CreateResult> {
  const who = await whoami();
  const s = await getSession(a.sessionId);
  if (!s || !owns(s, who)) return { ok: false, message: "Ажил олдсонгүй." };

  const format = s.format as StudioFormat;
  const stored = (s.brief as Partial<StudioBrief> | null) ?? {};
  // Хэрэглэгчийн засварыг дагана, хоосон талбарыг LLM-ийн бичсэнээр нөхнө
  const brief = Object.fromEntries(
    BRIEF_FIELDS.map((f) => [f, (a.brief[f] ?? "").trim() || (stored[f] ?? "")]),
  ) as unknown as StudioBrief;

  const directions = (s.directions as StudioDirection[] | null) ?? [];
  const direction = directions.find((d) => d.key === a.direction) ?? directions[0];
  if (!direction) return { ok: false, message: "Чиглэл олдсонгүй. Эхнээс нь эхлүүлнэ үү." };

  const valid = new Set(toolsFor(format).map((t) => t.id));
  const chosen = a.toolIds.filter((t) => valid.has(t));
  const toolIds = chosen.length ? chosen : defaultTools(format);
  const placement = placementById(a.placement)?.id ?? s.placement;

  await patchSession(a.sessionId, {
    brief: asJson(brief), tools: toolIds, placement,
    direction: Math.max(0, directions.indexOf(direction)),
  });

  return {
    ok: true,
    tools: toolIds.map((id) => ({ id, name: toolById(id)?.name ?? id })),
    aspect: aspectFor(format, placement),
  };
}

/** Session-оос бүтээх контекстийг сэргээнэ */
async function contextOf(s: NonNullable<Awaited<ReturnType<typeof getSession>>>): Promise<BuildContext | null> {
  const brief = s.brief as StudioBrief | null;
  const directions = (s.directions as StudioDirection[] | null) ?? [];
  const direction = directions[s.direction ?? 0] ?? directions[0];
  if (!brief || !direction) return null;
  return {
    brief, direction, request: s.request,
    format: s.format as StudioFormat,
    placement: s.placement,
    toolIds: s.tools,
  };
}

export interface ToolResult {
  ok: boolean;
  message?: string;
  output?: ToolOutput;
  /** Мэдлэгийн сангаас баталгаажаагүй тул хасагдсан тоо */
  stripped?: number;
  /** Хэрэгслийн лавлах хэзээ шалгагдсан — UI-д «Мэдээлэл шалгасан: …» */
  checked?: string | null;
  ms?: number;
}

/** 3b. НЭГ хэрэгслийн гаргалт — клиент эдгээрийг зэрэг дуудна */
export async function createTool(sessionId: string, toolId: string): Promise<ToolResult> {
  const who = await whoami();
  const s = await getSession(sessionId);
  if (!s || !owns(s, who)) return { ok: false, message: "Ажил олдсонгүй." };
  if (!s.tools.includes(toolId)) return { ok: false, message: "Хэрэгсэл сонгогдоогүй." };

  const ctx = await contextOf(s);
  if (!ctx) return { ok: false, message: "Даалгавар дутуу. Эхнээс нь эхлүүлнэ үү." };

  const started = Date.now();
  try {
    const r = await buildOneTool(ctx, toolId);
    const ms = Date.now() - started;
    await Promise.all([
      addSpend({ ...who, costUsd: r.costUsd }),
      addCost(sessionId, r.costUsd),
      r.stripped.length ? bumpStripped(sessionId, r.stripped.length) : Promise.resolve(),
    ]);
    return {
      ok: true, output: r.output, stripped: r.stripped.length, ms,
      checked: docCheckedDate(toolId),
    };
  } catch (e) {
    await logError({ source: "studio", path: `tool/${toolId}`, error: e });
    return { ok: false, message: `${toolById(toolId)?.name ?? toolId}: бэлдэж чадсангүй.` };
  }
}

export interface PlanResult {
  ok: boolean;
  message?: string;
  plan?: Omit<StudioOutput, "tools">;
  ms?: number;
}

/** 3c. Ерөнхий төлөвлөгөө — кадар, хөгжим, угсралт, санаа */
export async function createPlan(sessionId: string): Promise<PlanResult> {
  const who = await whoami();
  const s = await getSession(sessionId);
  if (!s || !owns(s, who)) return { ok: false, message: "Ажил олдсонгүй." };

  const ctx = await contextOf(s);
  if (!ctx) return { ok: false, message: "Даалгавар дутуу." };

  const started = Date.now();
  try {
    const r = await buildPlan(ctx);
    await Promise.all([
      addSpend({ ...who, costUsd: r.costUsd }),
      addCost(sessionId, r.costUsd),
    ]);
    return { ok: true, plan: r.plan, ms: Date.now() - started };
  } catch (e) {
    await logError({ source: "studio", path: "plan", error: e });
    return { ok: false, message: "Төлөвлөгөө бэлдэж чадсангүй." };
  }
}

export interface FinishResult {
  ok: boolean;
  message?: string;
  warnings?: string[];
  links?: { tools: { label: string; href: string }[]; guides: { label: string; href: string }[] };
  shareUrl?: string;
  revisionsLeft?: number;
}

/** 3d. Бүх хэсгийг нэгтгэж хадгална */
export async function finishStudio(a: {
  sessionId: string;
  output: StudioOutput;
  timings: StepTimings;
}): Promise<FinishResult> {
  const who = await whoami();
  const s = await getSession(a.sessionId);
  if (!s || !owns(s, who)) return { ok: false, message: "Ажил олдсонгүй." };

  const format = s.format as StudioFormat;
  const tools = s.tools.map((t) => toolById(t)).filter((t): t is StudioTool => Boolean(t));

  try {
    const links = await studioLinks(tools);
    await patchSession(a.sessionId, {
      outputs: asJson(a.output),
      timings: asJson(a.timings),
    });
    return {
      ok: true,
      links,
      warnings: warningsFor({
        format, tools, request: s.request, brief: (s.brief as Partial<StudioBrief>) ?? {},
      }),
      shareUrl: `/prompt/studio/${a.sessionId}`,
      revisionsLeft: revisionsLeft(s.revisionCount),
    };
  } catch (e) {
    await logError({ source: "studio", path: "finish", error: e });
    return { ok: false, message: "Хадгалах явцад алдаа гарлаа." };
  }
}

export interface ReviseResult {
  ok: boolean;
  message?: string;
  revision?: RevisionOut;
  output?: ToolOutput;
  left?: number;
}

/**
 * 5. Засах давталт — юу нь буруу байгааг бичээд, гарсан зургаа оруулна.
 *
 * Зураг нь ЗӨВХӨН нэвтэрсэн хэрэглэгчид ба санах ойд л боловсруулагдана:
 * DB-д ч, дискэнд ч хадгалахгүй.
 */
export async function reviseStudio(form: FormData): Promise<ReviseResult> {
  const sessionId = String(form.get("sessionId") ?? "");
  const toolId = String(form.get("toolId") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 600);
  if (note.length < 5) return { ok: false, message: "Юу нь таарахгүй байгааг богинохон бичээрэй." };

  const who = await whoami();
  const s = await getSession(sessionId);
  if (!s || !owns(s, who)) return { ok: false, message: "Ажил олдсонгүй." };

  if (s.revisionCount >= MAX_REVISIONS) {
    return { ok: false, message: `Нэг ажилд ${MAX_REVISIONS} удаа засварлаж болно.`, left: 0 };
  }

  // Өдрийн хязгаар ба төсөвт засвар бүр тооцогдоно
  const used = await usedToday(who);
  if (limitLeft(used, who.loggedIn) <= 0) {
    return { ok: false, message: "Өнөөдрийн хязгаар дүүрлээ." };
  }
  const [spent, balance] = await Promise.all([spentToday(), openRouterBalance()]);
  const off = studioOff({ spentUsd: spent, balanceUsd: balance });
  if (off) return { ok: false, message: OFF_MESSAGE[off] };

  const outputs = s.outputs as StudioOutput | null;
  const previous = outputs?.tools?.find((t) => t.tool === toolId);
  const tool = toolById(toolId);
  const brief = s.brief as StudioBrief | null;
  if (!previous || !tool || !brief) return { ok: false, message: "Энэ хэрэгслийн гаргалт олдсонгүй." };

  // Зураг — санах ойд, хадгалахгүй
  let imageDataUrl: string | undefined;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    if (!who.loggedIn) return { ok: false, message: "Зураг оруулахын тулд нэвтэрнэ үү." };
    const bad = checkImage(file);
    if (bad) return { ok: false, message: IMAGE_REJECT_MESSAGE[bad] };
    const buf = Buffer.from(await file.arrayBuffer());
    imageDataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
  }

  try {
    await bumpCount(who);
    const r = await reviseTool({ brief, tool, previous, note, imageDataUrl }, {});
    const left = revisionsLeft(s.revisionCount + 1);

    const revisions = [
      ...(((s.revisions as unknown[] | null) ?? [])),
      {
        at: new Date().toISOString(), toolId, note,
        hadImage: Boolean(imageDataUrl),
        changes: r.revision.changes, costUsd: r.costUsd,
      },
    ];
    const nextOutputs: StudioOutput | null = outputs
      ? { ...outputs, tools: outputs.tools.map((t) => (t.tool === toolId ? r.output : t)) }
      : null;

    await Promise.all([
      addSpend({ ...who, costUsd: r.costUsd }),
      addCost(sessionId, r.costUsd),
      patchSession(sessionId, {
        revisions: asJson(revisions),
        revisionCount: { increment: 1 },
        ...(nextOutputs ? { outputs: asJson(nextOutputs) } : {}),
      }),
    ]);
    return { ok: true, revision: r.revision, output: r.output, left };
  } catch (e) {
    await logError({ source: "studio", path: "revise", error: e });
    return { ok: false, message: "Засварлах явцад алдаа гарлаа. Дахин оролдоорой." };
  }
}

/** 4. 👍 / 👎 */
export async function rateStudio(sessionId: string, up: boolean): Promise<void> {
  const who = await whoami();
  const s = await getSession(sessionId);
  if (!s || !owns(s, who)) return;
  await setFeedback(sessionId, up);
}
