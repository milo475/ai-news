/**
 * OpenRouter chat completions — бүтэцтэй (JSON schema) хариу авах цэвэр давхарга.
 *
 * DB-гүй. Дуудагч нь ямар модель, ямар schema хэрэглэхээ өөрөө шийднэ.
 * Лимит/түр алдаа (429, 5xx) болон JSON задлах алдаанд 2 удаа дахин оролдоно.
 */
import { loadEnv } from "../lib/env";
import { siteUrl } from "../lib/site";

const URL_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = siteUrl();
const TITLE = "AI News";

/** Дахин оролдох хүлээлт: 2с, 6с. Гурав дахь удаад алдааг дамжуулна. */
const BACKOFF_MS = [2_000, 6_000];

/**
 * Түлхүүр буруу, хүчингүй эсвэл огт байхгүй (401/403).
 *
 * Дахин оролдоод, өөр модель сонгоод, дараагийн зүйл рүү үсэрч ч ЯМАР ч тус болохгүй —
 * бүх дуудлага яг ижил унана. Тиймээс дуудагч нар үүнийг барьж авалгүй дамжуулж,
 * скрипт ЭХНИЙ алдаан дээр зогсох ёстой (эс тэгвээс 80 даалгавар «0 оноотой
 * амжилттай» гэж DB-д бичигддэг).
 */
export class LlmAuthError extends Error {
  /** HTTP статус; 0 = түлхүүр огт тохируулаагүй */
  readonly status: number;

  constructor(status: number, detail: string) {
    super(
      status === 0
        ? `OPENROUTER_API_KEY тохируулаагүй байна${detail ? ` (${detail})` : ""}`
        : `OpenRouter ${status}: түлхүүр буруу эсвэл эрх хүрэхгүй — ${detail}`,
    );
    this.name = "LlmAuthError";
    this.status = status;
  }
}

export function isAuthError(e: unknown): e is LlmAuthError {
  return e instanceof LlmAuthError;
}

/**
 * Нэг удаа 401 гармагц бусад дуудлага сүлжээнд огт хүрэхгүй.
 * (Загварын түвшинд түгжинэ — процесс дуустал.)
 */
let authFailure: LlmAuthError | null = null;

/** Түлхүүрийг уншиж, өмнө нь 401 гарсан эсэхийг шалгана */
function apiKeyOrThrow(): string {
  if (authFailure) throw authFailure;
  // Railway Console дээр env дутуу байж болно — PID 1-ээс нөхнө (нэг л удаа)
  loadEnv();
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    authFailure = new LlmAuthError(0, "Railway Console дээр бол үйлчилгээний Variables-ыг шалгана уу");
    throw authFailure;
  }
  return key;
}

/** 401/403 бол түгжээг тавиад алдааг буцаана, үгүй бол null */
function authErrorFor(status: number, body: string): LlmAuthError | null {
  if (status !== 401 && status !== 403) return null;
  authFailure = new LlmAuthError(status, body.slice(0, 200));
  return authFailure;
}

/** Тестэд түгжээг сэргээнэ */
export function resetAuthFailure(): void {
  authFailure = null;
}

export interface ChatJsonOptions {
  model: string;
  system: string;
  user: string;
  /** JSON Schema — response_format.json_schema.schema */
  schema: object;
  maxTokens: number;
  /** default 0.3 */
  temperature?: number;
  /** default true. false үед бодох моделийн reasoning-ийг унтраана (токен хэмнэнэ) */
  reasoning?: boolean;
}

interface ChatResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { total_tokens?: number; cost?: number };
  error?: { message?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Модель заримдаа ```json ... ``` fence дотор буцаадаг — fence-ийг хасна */
export function stripFence(text: string): string {
  const t = text.trim();
  const m = /^```[a-z]*\s*\n?([\s\S]*?)\n?```$/i.exec(t);
  return (m ? m[1]! : t).trim();
}

/** Нэг дуудлага — алдаа гаргавал дээд түвшний давталт дахин оролдоно */
async function callOnce<T>(
  apiKey: string,
  opts: ChatJsonOptions,
  noReasoning: boolean,
): Promise<{ data: T; tokens: number; costUsd: number }> {
  const res = await fetch(URL_CHAT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": REFERER,
      "X-Title": TITLE,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens,
      ...(noReasoning ? { reasoning: { enabled: false } } : {}),
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: true, schema: opts.schema },
      },
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    const auth = authErrorFor(res.status, body);
    if (auth) throw auth;
    const err = new Error(`OpenRouter chat ${res.status}: ${body}`) as Error & {
      retryable?: boolean;
      reasoningRejected?: boolean;
      affordableTokens?: number;
    };
    // "You requested up to 4000 tokens, but can only afford 3608" — кредитийн үлдэгдлийн таг
    err.affordableTokens = Number(/can only afford (\d+)/.exec(body)?.[1] ?? 0);
    // Түр алдаа: лимит, сервер, мөн OpenRouter-ийн "in-flight budget" түр хязгаар
    err.retryable =
      res.status === 429 || res.status >= 500 || (res.status === 402 && /in_flight/i.test(body));
    // Зарим provider reasoning-ийг унтраахыг зөвшөөрдөггүй ("Reasoning is mandatory for this endpoint")
    err.reasoningRejected = res.status === 400 && /reasoning/i.test(body);
    throw err;
  }

  const json = (await res.json()) as ChatResponse;
  if (json.error) throw new Error(`OpenRouter chat: ${json.error.message ?? "тодорхойгүй алдаа"}`);

  const choice = json.choices?.[0];
  // Бодох модельд reasoning токен нь max_tokens-оос иддэг — дахин оролдоод нэмэргүй
  if (choice?.finish_reason === "length") {
    throw new Error(`OpenRouter chat: хариу таслагдсан (max_tokens=${opts.maxTokens} хүрэлцэхгүй)`);
  }
  const content = choice?.message?.content;
  if (!content) throw new Error("OpenRouter chat: хоосон хариу");

  let data: T;
  try {
    data = JSON.parse(stripFence(content)) as T;
  } catch {
    // JSON биш ирсэн — дахин оролдоход засрах магадлалтай
    const err = new Error(`JSON задлах алдаа: ${content.slice(0, 200)}`);
    (err as Error & { retryable?: boolean }).retryable = true;
    throw err;
  }
  return { data, tokens: json.usage?.total_tokens ?? 0, costUsd: json.usage?.cost ?? 0 };
}

/**
 * Бүтэцтэй JSON хариу авна. Алдаа гарвал 2с, 6с хүлээж дахин оролдоно.
 * costUsd — OpenRouter-ийн тайлагнасан бодит зардал (өдрийн төсөв хянахад).
 */
export async function chatJson<T>(
  opts: ChatJsonOptions,
): Promise<{ data: T; tokens: number; costUsd: number }> {
  const apiKey = apiKeyOrThrow();

  let call = opts;
  let noReasoning = opts.reasoning === false;
  let lowered = false;
  let attempt = 0;
  for (;;) {
    try {
      return await callOnce<T>(apiKey, call, noReasoning);
    } catch (e) {
      // Provider reasoning-ийг шаардаж байвал асаагаад шууд дахин — оролдлого зарцуулахгүй
      if ((e as { reasoningRejected?: boolean }).reasoningRejected && noReasoning) {
        noReasoning = false;
        continue;
      }
      // Кредит хүрэлцэхгүй бол OpenRouter-ийн зөвшөөрсөн хэмжээгээр нэг удаа дахин
      const afford = (e as { affordableTokens?: number }).affordableTokens ?? 0;
      if (!lowered && afford > 200 && afford < call.maxTokens) {
        lowered = true;
        console.warn(`  ↓ ${call.model}: кредит хүрэлцэхгүй — max_tokens ${call.maxTokens} → ${afford}`);
        call = { ...call, maxTokens: afford };
        continue;
      }
      const retryable = (e as { retryable?: boolean }).retryable ?? false;
      if (!retryable || attempt >= BACKOFF_MS.length) throw e;
      console.warn(`  ↻ ${call.model}: ${(e as Error).message.slice(0, 120)} — ${BACKOFF_MS[attempt]! / 1000}с дараа дахин`);
      await sleep(BACKOFF_MS[attempt]!);
      attempt++;
    }
  }
}

// ---------- Зураг үүсгэх (image output) ----------

export interface ChatTextOptions {
  model: string;
  system?: string;
  user: string;
  maxTokens: number;
  /** default 0.3 */
  temperature?: number;
  /** Секундээр — хугацаа хэтэрвэл таслана */
  timeoutMs?: number;
  reasoning?: boolean;
}

export interface ChatTextResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
}

/**
 * Энгийн текст хариу (JSON schema-гүй) — бенчмаркт модель бүрийг ижил нөхцөлд дуудна.
 *
 * Дахин оролдлого нь chatJson-той ижил: 429/5xx дээр 2с, 6с хүлээнэ. Хугацаа хэтэрсэн
 * нь ч дахин оролдоно (сүлжээний түр саатал).
 */
export async function chatText(opts: ChatTextOptions): Promise<ChatTextResult> {
  const apiKey = apiKeyOrThrow();

  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(URL_CHAT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": REFERER,
          "X-Title": TITLE,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            ...(opts.system ? [{ role: "system", content: opts.system }] : []),
            { role: "user", content: opts.user },
          ],
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens,
          ...(opts.reasoning === false ? { reasoning: { enabled: false } } : {}),
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      });

      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        const auth = authErrorFor(res.status, body);
        if (auth) throw auth;
        const err = new Error(`OpenRouter chat ${res.status}: ${body}`) as Error & { retryable?: boolean };
        err.retryable = res.status === 429 || res.status >= 500;
        throw err;
      }

      const json = (await res.json()) as ChatResponse & {
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      if (json.error) throw new Error(`OpenRouter chat: ${json.error.message ?? "тодорхойгүй алдаа"}`);

      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("OpenRouter chat: хоосон хариу");

      return {
        text,
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        costUsd: json.usage?.cost ?? 0,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      const retryable =
        (e as { retryable?: boolean }).retryable === true ||
        (e as Error).name === "TimeoutError" ||
        (e as Error).name === "AbortError";
      const wait = BACKOFF_MS[attempt];
      if (!retryable || wait === undefined) throw e;
      await sleep(wait);
    }
  }
}

export interface ChatImageResult {
  /** Зургийн эх бинари */
  buffer: Buffer;
  /** "image/png" гэх мэт */
  mime: string;
  tokens: number;
  /** OpenRouter-ийн тайлагнасан зардал, USD */
  costUsd: number;
}

interface ImageResponse {
  choices?: { message?: { content?: string; images?: { image_url?: { url?: string } }[] } }[];
  usage?: { total_tokens?: number; cost?: number };
  error?: { message?: string };
}

/**
 * Зураг үүсгэнэ (OpenRouter-ийн image-output модель, жишээ google/gemini-2.5-flash-image).
 * Хариу нь data:image/...;base64 URL хэлбэрээр ирдэг.
 */
export async function chatImage(opts: { model: string; prompt: string }): Promise<ChatImageResult> {
  const apiKey = apiKeyOrThrow();

  const res = await fetch(URL_CHAT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": REFERER,
      "X-Title": TITLE,
    },
    body: JSON.stringify({
      model: opts.model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: opts.prompt }],
    }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    const auth = authErrorFor(res.status, body);
    if (auth) throw auth;
    throw new Error(`OpenRouter image ${res.status}: ${body}`);
  }

  const json = (await res.json()) as ImageResponse;
  if (json.error) throw new Error(`OpenRouter image: ${json.error.message ?? "тодорхойгүй алдаа"}`);

  const message = json.choices?.[0]?.message;
  const url = message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith("data:")) {
    // Модель заримдаа зургийн оронд текст (татгалзал, тайлбар) буцаадаг — шалтгааныг нь харуулна
    const said = message?.content?.replace(/\s+/g, " ").slice(0, 150);
    throw new Error(`OpenRouter image: зураг ирсэнгүй${said ? ` — "${said}"` : ""}`);
  }
  const [head, b64] = url.slice(5).split(",", 2);
  return {
    buffer: Buffer.from(b64 ?? "", "base64"),
    mime: (head ?? "image/png").replace(";base64", ""),
    tokens: json.usage?.total_tokens ?? 0,
    costUsd: json.usage?.cost ?? 0,
  };
}
