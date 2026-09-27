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
  addSpend, asJson, bumpCount, createSession, getSession, patchSession, recordRejected, setFeedback,
  spentToday, usedToday,
} from "./db";
import { askQuestions, buildBrief, buildDirections, buildOutput, writeModel } from "./run";
import { openRouterBalance } from "./balance";
import { studioLinks } from "./links";
import {
  aspectFor, defaultTools, detectFormat, FORMATS, limitLeft, OFF_MESSAGE, PLACEMENTS,
  placementById, studioOff, toolsFor, type StudioFormat,
} from "./studio.api";
import {
  askedAlready, BRIEF_FIELDS, MAX_ROUNDS, type StudioBrief, type StudioDirection, type StudioQuestion,
} from "./prompts.api";
import { warningsFor, type StudioOutput } from "./output.api";
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
  output?: StudioOutput;
  tools?: { id: string; name: string }[];
  warnings?: string[];
  links?: { tools: { label: string; href: string }[]; guides: { label: string; href: string }[] };
  aspect?: string;
  shareUrl?: string;
}

/** 3. Эцсийн гаргалт */
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
  const toolIds = a.toolIds.filter((t) => valid.has(t));
  const chosen = toolIds.length ? toolIds : defaultTools(format);
  const placement = placementById(a.placement)?.id ?? s.placement;

  try {
    const { output, tools, issues, costUsd } = await buildOutput({
      brief, format, placement, direction, toolIds: chosen,
    });

    const [links] = await Promise.all([
      studioLinks(tools as StudioTool[]),
      addSpend({ ...who, costUsd }),
      patchSession(a.sessionId, {
        brief: asJson(brief), tools: chosen, placement,
        direction: Math.max(0, directions.indexOf(direction)),
        outputs: asJson(output),
        costUsd: { increment: costUsd },
      }),
    ]);

    if (issues.length) {
      await logError({
        source: "studio", path: "output-issues",
        error: new Error(`${a.sessionId}: ${issues.join("; ")}`),
      });
    }

    return {
      ok: true,
      output,
      tools: tools.map((t) => ({ id: t.id, name: t.name })),
      warnings: warningsFor({ format, tools: tools as StudioTool[], request: s.request, brief }),
      links,
      aspect: aspectFor(format, placement),
      shareUrl: `/prompt/studio/${a.sessionId}`,
    };
  } catch (e) {
    await logError({ source: "studio", path: "create", error: e });
    return { ok: false, message: "Бүтээх явцад алдаа гарлаа. Дахин оролдоорой." };
  }
}

/** 4. 👍 / 👎 */
export async function rateStudio(sessionId: string, up: boolean): Promise<void> {
  const who = await whoami();
  const s = await getSession(sessionId);
  if (!s || !owns(s, who)) return;
  await setFeedback(sessionId, up);
}
