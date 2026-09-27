"use client";

import { useState } from "react";
import { answerStudio, createStudio, startStudio } from "@/studio/actions";
import { FORMAT_LABEL, FORMATS, type StudioFormat } from "@/studio/studio.api";
import {
  BRIEF_FIELDS, BRIEF_LABEL, DIRECTION_HINT, DIRECTION_LABEL,
  FREE_OPTION, type StudioDirection, type StudioQuestion,
} from "@/studio/prompts.api";
import { StudioResult, type ResultData } from "./Result";

const EXAMPLES = [
  "Албаны шинэ жилийн мэндчилгээ видео хийе",
  "Бүтээгдэхүүнийхээ Facebook зар зураг хэрэгтэй",
  "Сургалтын танилцуулга слайд",
  "Дэлгүүрийнхээ Reels бичлэг",
];

type Step = "request" | "questions" | "brief" | "result";

const STEP_LABEL: Record<Step, string> = {
  request: "Хүсэлт",
  questions: "Тодруулга",
  brief: "Даалгавар",
  result: "Бэлэн",
};
const STEPS: Step[] = ["request", "questions", "brief", "result"];

function Progress({ step }: { step: Step }) {
  const i = STEPS.indexOf(step);
  return (
    <ol className="flex items-center gap-1.5 text-xs" aria-label="Явц">
      {STEPS.map((s, n) => (
        <li key={s} className="flex flex-1 items-center gap-1.5">
          <span
            className={`h-1 flex-1 rounded ${n <= i ? "bg-accent" : "bg-line"}`}
            aria-hidden="true"
          />
          <span className={n === i ? "text-accent" : "text-muted"}>{STEP_LABEL[s]}</span>
        </li>
      ))}
    </ol>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <p className="text-sm text-muted">{label}</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded border border-line bg-card" />
      ))}
    </div>
  );
}

export function StudioWizard() {
  const [step, setStep] = useState<Step>("request");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [request, setRequest] = useState("");
  const [format, setFormat] = useState<StudioFormat | "">("");
  const [sessionId, setSessionId] = useState("");
  const [left, setLeft] = useState<number | null>(null);

  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState<StudioQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [free, setFree] = useState<Record<string, boolean>>({});

  const [brief, setBrief] = useState<Record<string, string>>({});
  const [directions, setDirections] = useState<StudioDirection[]>([]);
  const [direction, setDirection] = useState("safe");
  const [tools, setTools] = useState<
    { id: string; name: string; note: string; free: boolean; selected: boolean }[]
  >([]);
  const [placements, setPlacements] = useState<{ id: string; label: string; aspect: string }[]>([]);
  const [placement, setPlacement] = useState("");

  const [result, setResult] = useState<ResultData | null>(null);

  async function onStart() {
    setError("");
    setBusy("Хүсэлтийг уншиж байна…");
    const r = await startStudio({ request, format: format || undefined });
    setBusy("");
    if (!r.ok || !r.sessionId) return setError(r.message ?? "Алдаа гарлаа.");
    setSessionId(r.sessionId);
    setFormat(r.format!);
    setQuestions(r.questions ?? []);
    setLeft(r.left ?? null);
    setAnswers({});
    setRound(0);
    setStep("questions");
  }

  async function onAnswers() {
    setError("");
    setBusy("Даалгавраа бэлдэж байна…");
    const r = await answerStudio({ sessionId, answers, round });
    setBusy("");
    if (!r.ok) return setError(r.message ?? "Алдаа гарлаа.");

    if (r.questions?.length) {
      setQuestions(r.questions);
      setRound(round + 1);
      return;
    }
    setBrief((r.brief ?? {}) as unknown as Record<string, string>);
    setDirections(r.directions ?? []);
    setDirection(r.directions?.[0]?.key ?? "safe");
    setTools(r.tools ?? []);
    setPlacements(r.placements ?? []);
    setStep("brief");
  }

  async function onCreate() {
    setError("");
    setBusy("Промптоо бичиж байна… (15–40 секунд)");
    const r = await createStudio({
      sessionId,
      brief,
      direction,
      toolIds: tools.filter((t) => t.selected).map((t) => t.id),
      placement: placement || undefined,
    });
    setBusy("");
    if (!r.ok || !r.output) return setError(r.message ?? "Алдаа гарлаа.");
    setResult({
      output: r.output,
      tools: r.tools ?? [],
      warnings: r.warnings ?? [],
      links: r.links ?? { tools: [], guides: [] },
      aspect: r.aspect,
      shareUrl: r.shareUrl,
    });
    setStep("result");
  }

  function restart() {
    setStep("request");
    setRequest("");
    setFormat("");
    setResult(null);
    setError("");
  }

  return (
    <div className="space-y-6">
      <Progress step={step} />

      {error && (
        <p className="rounded border border-down/40 bg-down/5 p-3 text-sm text-down">{error}</p>
      )}

      {busy ? (
        <Skeleton label={busy} />
      ) : step === "request" ? (
        <section className="space-y-4">
          <div>
            <label htmlFor="studio-request" className="text-sm font-medium">
              Юу хийхийг хүсэж байна?
            </label>
            <p className="mt-1 text-sm text-muted">
              Монголоор, энгийн үгээр бичээрэй. Жишээ нь «албаны шинэ жилийн мэндчилгээ видео».
            </p>
            <textarea
              id="studio-request"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              maxLength={600}
              className="mt-2 w-full rounded border border-line bg-card p-3 text-base"
              placeholder="Жишээ: дэлгүүрийнхээ шинэ бүтээгдэхүүнийг танилцуулах Facebook зураг"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setRequest(e)}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
              >
                {e}
              </button>
            ))}
          </div>

          <div>
            <p className="text-sm font-medium">Юу үүсгэх вэ?</p>
            <p className="mt-1 text-sm text-muted">Сонгохгүй бол бичсэнээс тань таана.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(format === f ? "" : f)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    format === f ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onStart}
            disabled={request.trim().length < 5}
            className="w-full rounded bg-accent px-4 py-3 text-base font-medium text-bg disabled:opacity-40"
          >
            Эхлэх
          </button>
        </section>
      ) : step === "questions" ? (
        <section className="space-y-6">
          <p className="text-sm text-muted">
            {questions.length} богино асуулт. Сонголт таарахгүй бол «{FREE_OPTION}» дээр дарж
            өөрөө бичнэ үү.
          </p>
          {questions.map((q) => (
            <fieldset key={q.field} className="space-y-2">
              <legend className="text-sm font-medium">{q.question}</legend>
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      if (o === FREE_OPTION) {
                        setFree({ ...free, [q.field]: true });
                        setAnswers({ ...answers, [q.field]: "" });
                        return;
                      }
                      setFree({ ...free, [q.field]: false });
                      setAnswers({ ...answers, [q.field]: o });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      answers[q.field] === o || (free[q.field] && o === FREE_OPTION)
                        ? "border-accent text-accent"
                        : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {free[q.field] && (
                <input
                  type="text"
                  value={answers[q.field] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.field]: e.target.value })}
                  maxLength={200}
                  aria-label={q.question}
                  className="w-full rounded border border-line bg-card p-2.5 text-base"
                  placeholder="Өөрийн хариултаа бичнэ үү"
                />
              )}
            </fieldset>
          ))}
          <button
            type="button"
            onClick={onAnswers}
            className="w-full rounded bg-accent px-4 py-3 text-base font-medium text-bg"
          >
            Үргэлжлүүлэх
          </button>
        </section>
      ) : step === "brief" ? (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Даалгавар</h2>
            <p className="text-sm text-muted">Буруу байвал шууд засаарай.</p>
            {BRIEF_FIELDS.map((f) => (
              <div key={f}>
                <label htmlFor={`brief-${f}`} className="text-xs text-muted">
                  {BRIEF_LABEL[f]}
                </label>
                <textarea
                  id={`brief-${f}`}
                  value={brief[f] ?? ""}
                  onChange={(e) => setBrief({ ...brief, [f]: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded border border-line bg-card p-2.5 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">Чиглэлээ сонго</h2>
            {directions.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDirection(d.key)}
                className={`block w-full rounded border p-3 text-left ${
                  direction === d.key ? "border-accent" : "border-line hover:border-muted"
                }`}
              >
                <p className="text-sm font-medium">
                  <span className="text-accent">{DIRECTION_LABEL[d.key]}</span> — {d.title}
                </p>
                <p className="mt-1 text-sm text-muted">{d.idea}</p>
                <p className="mt-1 text-xs text-muted">{DIRECTION_HINT[d.key]}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold">Хэрэгсэл</h2>
            {tools.map((t) => (
              <label key={t.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.selected}
                  onChange={(e) =>
                    setTools(tools.map((x) => (x.id === t.id ? { ...x, selected: e.target.checked } : x)))
                  }
                  className="mt-1"
                />
                <span>
                  {t.name}
                  {t.free ? <span className="ml-1 text-xs text-up">үнэгүй</span> : null}
                  <span className="block text-xs text-muted">{t.note}</span>
                </span>
              </label>
            ))}
          </div>

          {placements.length > 0 && (
            <div>
              <label htmlFor="studio-placement" className="text-sm font-medium">
                Хаана тавих вэ?
              </label>
              <select
                id="studio-placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                className="mt-2 w-full rounded border border-line bg-card p-2.5 text-base"
              >
                <option value="">Сонгоогүй</option>
                {placements.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.aspect})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onCreate}
            className="w-full rounded bg-accent px-4 py-3 text-base font-medium text-bg"
          >
            Промпт бэлдэх
          </button>
        </section>
      ) : result ? (
        <>
          <StudioResult data={result} />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
            <button type="button" onClick={restart} className="rounded border border-line px-3 py-1.5">
              Шинээр эхлэх
            </button>
            {left !== null && (
              <span className="text-muted">Өнөөдөр {left} бүтээл үлдлээ</span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
