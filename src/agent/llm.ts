/**
 * OpenRouter chat completions — бүтэцтэй (JSON schema) хариу авах цэвэр давхарга.
 *
 * DB-гүй. Дуудагч нь ямар модель, ямар schema хэрэглэхээ өөрөө шийднэ.
 * Лимит/түр алдаа (429, 5xx) болон JSON задлах алдаанд 2 удаа дахин оролдоно.
 */
import { loadEnv } from "../lib/env";
import { recordCall } from "../lib/spend";
import { siteUrl } from "../lib/site";

const URL_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = siteUrl();
const TITLE = "AI News";

/** Дахин оролдох хүлээлт: 2с, 6с. Гурав дахь удаад алдааг дамжуулна. */
const BACKOFF_MS = [2_000, 6_000];

/** Хариу багтсангүй үед max_tokens-ыг хэдээр үржүүлэх вэ (нэг л удаа) */
export const TRUNCATION_WIDEN = 2;

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
  /** `credits` = данс дууссан (түлхүүр зөв ч дуудлага гарахгүй) */
  readonly kind: "auth" | "credits";

  constructor(status: number, detail: string, kind: "auth" | "credits" = "auth") {
    super(
      kind === "credits"
        ? `OpenRouter: данс дууссан — openrouter.ai/settings/credits дээр цэнэглэнэ үү (${detail})`
        : status === 0
          ? `OPENROUTER_API_KEY тохируулаагүй байна${detail ? ` (${detail})` : ""}`
          : `OpenRouter ${status}: түлхүүр буруу эсвэл эрх хүрэхгүй — ${detail}`,
    );
    this.name = "LlmAuthError";
    this.status = status;
    this.kind = kind;
  }
}

/**
 * Кредит дууссаны алдаа — 402-ийн БҮХ хэлбэр.
 *
 * OpenRouter 402-ыг гурван өөр бичвэрээр буцаадаг бөгөөд гурвуулаа «одоо мөнгө
 * хүрэхгүй» гэсэн НЭГ утгатай (2026-09-27-ны production):
 *   1. «would exceed your available credits given your current in-flight requests»
 *   2. «requires more credits, or fewer max_tokens … can only afford N»
 *   3. «Insufficient credits»
 *
 * Гурвыг нь үхлийн алдаа гэж үзнэ. Өмнө нь (1) нь «түр хязгаар» гэж дахин оролдож,
 * (2) нь max_tokens-ыг бууруулж ажилласаар байсан тул бенчмарк дуусах хүртлээ
 * хагас хариу, хоосон хариу цуглуулж, /benchmark дээр хуурамч оноо гарсан.
 */
export class LlmCreditError extends LlmAuthError {
  constructor(detail: string) {
    super(402, detail, "credits");
    this.name = "LlmCreditError";
  }
}

export function isAuthError(e: unknown): e is LlmAuthError {
  return e instanceof LlmAuthError;
}

export function isCreditError(e: unknown): e is LlmCreditError {
  return e instanceof LlmCreditError;
}

/** 402-ийн бичвэрээс ойлгомжтой монгол тайлбар */
export function creditDetail(body: string): string {
  if (/in-?flight/i.test(body)) return "зэрэг явж буй дуудлагууд үлдэгдлээс хэтэрлээ";
  if (/can only afford/i.test(body)) {
    const n = /can only afford (\d+)/.exec(body)?.[1];
    return n ? `дээд тал нь ${n} токен л хүрэлцэнэ` : "хүссэн токенд хүрэлцэхгүй";
  }
  if (/insufficient credits/i.test(body)) return "үлдэгдэл хүрэлцэхгүй";
  return body.slice(0, 120);
}

/**
 * Хариу нь `max_tokens`-д багтаагүй (finish_reason = "length").
 *
 * Дахин оролдох нь утгагүй — ижил урттай хариу дахин гарна. Дуудагч нь эсвэл
 * max_tokens-оо нэмэх, эсвэл ажлаа жижиг хэсгүүдэд хуваах ёстой.
 */
export function isTruncated(e: unknown): boolean {
  return (e as { truncated?: boolean } | null)?.truncated === true;
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

/**
 * Дахин оролдох утгагүй алдаа бол түгжээг тавиад буцаана, үгүй бол null.
 *
 *   401/403 — түлхүүр буруу
 *   402 (БҮХ хэлбэр) — данс дууссан. Бүх дараагийн дуудлага мөн л унах тул
 *     эндээс зогсоох нь чухал: эс тэгвээс алхам бүр дахин оролдож лог, цаг, мөнгө үрнэ.
 */
function authErrorFor(status: number, body: string): LlmAuthError | null {
  if (status === 401 || status === 403) {
    authFailure = new LlmAuthError(status, body.slice(0, 200));
    return authFailure;
  }
  // 402-ийн БҮХ хэлбэр — дахин оролдох, max_tokens бууруулах нь утгагүй
  if (status === 402) {
    authFailure = new LlmCreditError(creditDetail(body));
    return authFailure;
  }
  return null;
}

/** Тестэд түгжээг сэргээнэ */
export function resetAuthFailure(): void {
  authFailure = null;
}

/**
 * Хоосон хариуны алдаа.
 *
 * Бодох (reasoning) моделиуд `finish_reason: "stop"` буцаасан ч агуулга нь хоосон
 * байдаг: бүх max_tokens-ыг дотоод бодолт идсэн байна. Ийм хариуг **таслагдсантай
 * адил** гэж үзэж, нэг удаа max_tokens-ыг хоёр дахин нэмж, reasoning-ийг унтраан
 * дахин оролдоно (2026-09-27-ны бенчмаркт space-bunny-alpha 11, deepseek 13 удаа
 * хоосон хариу өгсөн).
 */
function emptyError(maxTokens: number, json: ChatResponse): Error & {
  truncated?: boolean;
  reasoningTokens?: number;
  emptyReply?: boolean;
} {
  const reasoning = json.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  const err = new Error(
    `OpenRouter chat: хоосон хариу (max_tokens=${maxTokens}${reasoningNote(json)})`,
  ) as Error & { truncated?: boolean; reasoningTokens?: number; emptyReply?: boolean };
  // Бодолт токен идсэн бол өргөтгөх нь тусална; идээгүй бол загвар үнэхээр юу ч
  // хэлээгүй — тэр тохиолдолд дахин оролдоод ч ялгаагүй, гэхдээ нэг удаа туршина.
  err.truncated = true;
  err.reasoningTokens = reasoning;
  err.emptyReply = true;
  return err;
}

/** Хариу хоосон ирсэн эсэх (таслагдсанаас ялгах) */
export function isEmptyReply(e: unknown): boolean {
  return (e as { emptyReply?: boolean })?.emptyReply === true;
}

export interface ChatJsonOptions {
  model: string;
  system: string;
  user: string;
  /**
   * `data:image/...;base64,...` — vision дуудлага.
   *
   * Зургийг ЗӨВХӨН энэ дуудлагад ашиглана: DB-д ч, дискэнд ч хадгалахгүй.
   */
  imageDataUrl?: string;
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
  usage?: {
    total_tokens?: number;
    cost?: number;
    /** Бодох моделийн дотоод «бодолт» — max_tokens-оос иддэг */
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string };
}

/** Хариу нь max_tokens-д багтаагүй үед хэдэн токеныг reasoning идсэнийг харуулна */
function reasoningNote(json: ChatResponse): string {
  const r = json.usage?.completion_tokens_details?.reasoning_tokens;
  return r ? ` — үүнээс ${r} токеныг reasoning идсэн` : "";
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
        // Зураг өгөгдсөн бол vision хэлбэрээр — OpenRouter-ийн олон модель дэмждэг
        opts.imageDataUrl
          ? {
              role: "user",
              content: [
                { type: "text", text: opts.user },
                { type: "image_url", image_url: { url: opts.imageDataUrl } },
              ],
            }
          : { role: "user", content: opts.user },
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
      status?: number;
    };
    err.status = res.status;
    // Түр алдаа: зөвхөн лимит ба серверийн алдаа. 402 нь энд хүрэхгүй — дээр
    // LlmCreditError болж шидэгдсэн байна.
    err.retryable = res.status === 429 || res.status >= 500;
    // Зарим provider reasoning-ийг унтраахыг зөвшөөрдөггүй ("Reasoning is mandatory for this endpoint")
    err.reasoningRejected = res.status === 400 && /reasoning/i.test(body);
    throw err;
  }

  const json = (await res.json()) as ChatResponse;
  if (json.error) throw new Error(`OpenRouter chat: ${json.error.message ?? "тодорхойгүй алдаа"}`);

  const choice = json.choices?.[0];
  // Бодох модельд reasoning токен нь max_tokens-оос иддэг — дахин оролдоод нэмэргүй
  if (choice?.finish_reason === "length") {
    const err = new Error(
      `OpenRouter chat: хариу таслагдсан (max_tokens=${opts.maxTokens} хүрэлцэхгүй${reasoningNote(json)})`,
    ) as Error & { truncated?: boolean; reasoningTokens?: number };
    err.truncated = true;
    err.reasoningTokens = json.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    throw err;
  }
  const content = choice?.message?.content;
  if (!content) throw emptyError(opts.maxTokens, json);

  let data: T;
  try {
    data = JSON.parse(stripFence(content)) as T;
  } catch {
    // JSON биш ирсэн — дахин оролдоход засрах магадлалтай
    const err = new Error(`JSON задлах алдаа: ${content.slice(0, 200)}`);
    (err as Error & { retryable?: boolean }).retryable = true;
    throw err;
  }
  const costUsd = json.usage?.cost ?? 0;
  // Төв бүртгэл — алхам нь зардлаа мартах боломжгүй
  recordCall(costUsd);
  return { data, tokens: json.usage?.total_tokens ?? 0, costUsd };
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
  let widened = false;
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
      // Хариу багтсангүй — НЭГ удаа хоёр дахин өргөн, reasoning-ийг унтраагаад дахин.
      // Бодох модель нь max_tokens-ийг дотоод бодолтод иддэг тул зүгээр дахин оролдох нь
      // ижил үр дүн өгнө.
      if (isTruncated(e) && !widened) {
        widened = true;
        const wider = call.maxTokens * TRUNCATION_WIDEN;
        console.warn(
          `  ↔ ${call.model}: max_tokens ${call.maxTokens} → ${wider}, reasoning унтраав ` +
            `(${(e as Error).message.replace(/^OpenRouter chat: /, "")})`,
        );
        call = { ...call, maxTokens: wider };
        noReasoning = true;
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
  /** "stop" | "length" | … — бенчмаркт хадгалж, хоосон хариуг шинжилнэ */
  finishReason: string | null;
  /** Бодох моделийн дотоод бодолт идсэн токен */
  reasoningTokens: number;
}

/**
 * Энгийн текст хариу (JSON schema-гүй) — бенчмаркт модель бүрийг ижил нөхцөлд дуудна.
 *
 * Дахин оролдлого нь chatJson-той ижил: 429/5xx дээр 2с, 6с хүлээнэ. Хугацаа хэтэрсэн
 * нь ч дахин оролдоно (сүлжээний түр саатал).
 */
export async function chatText(opts: ChatTextOptions): Promise<ChatTextResult> {
  const apiKey = apiKeyOrThrow();

  let call = opts;
  let noReasoning = opts.reasoning === false;
  let widened = false;

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
          model: call.model,
          messages: [
            ...(call.system ? [{ role: "system", content: call.system }] : []),
            { role: "user", content: call.user },
          ],
          temperature: call.temperature ?? 0.3,
          max_tokens: call.maxTokens,
          ...(noReasoning ? { reasoning: { enabled: false } } : {}),
        }),
        signal: AbortSignal.timeout(call.timeoutMs ?? 60_000),
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

      const choice = json.choices?.[0];
      if (choice?.finish_reason === "length") {
        const err = new Error(
          `OpenRouter chat: хариу таслагдсан (max_tokens=${call.maxTokens} хүрэлцэхгүй${reasoningNote(json)})`,
        ) as Error & { truncated?: boolean; reasoningTokens?: number };
        err.truncated = true;
        err.reasoningTokens = json.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
        throw err;
      }

      const text = choice?.message?.content ?? "";
      if (!text.trim()) throw emptyError(call.maxTokens, json);

      const costUsd = json.usage?.cost ?? 0;
      recordCall(costUsd);
      return {
        text,
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        costUsd,
        latencyMs: Date.now() - started,
        finishReason: choice?.finish_reason ?? null,
        reasoningTokens: json.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      };
    } catch (e) {
      // Хариу багтсангүй — chatJson-той ижил дүрэм: нэг удаа 2 дахин өргөн, reasoning унтраана
      if (isTruncated(e) && !widened) {
        widened = true;
        const wider = call.maxTokens * TRUNCATION_WIDEN;
        console.warn(
          `  ↔ ${call.model}: max_tokens ${call.maxTokens} → ${wider}, reasoning унтраав ` +
            `(${(e as Error).message.replace(/^OpenRouter chat: /, "")})`,
        );
        call = { ...call, maxTokens: wider };
        noReasoning = true;
        attempt--; // өргөтгөл нь дахин оролдлогын тооноос иддэггүй
        continue;
      }
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
  // Зураг үүсгэлтийн зардал ч төв бүртгэлд орно
  const costUsd = json.usage?.cost ?? 0;
  recordCall(costUsd);
  return {
    buffer: Buffer.from(b64 ?? "", "base64"),
    mime: (head ?? "image/png").replace(";base64", ""),
    tokens: json.usage?.total_tokens ?? 0,
    costUsd,
  };
}
