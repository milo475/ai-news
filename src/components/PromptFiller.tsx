"use client";

import { useMemo, useState } from "react";
import { chatGptUrl, fillVariables, geminiUrl, splitVariables } from "@/prompts/prompt.api";
import { track } from "@/lib/analytics";
import { CopyPrompt } from "./CopyPrompt";

/**
 * Prompt-ын бүтэн текст + хувьсагч бөглөх хэсэг.
 *
 * Нүх бүрт input; бичих бүрт дээрх текст бодит цагт солигдоно. «Хуулах» нь
 * бөглөсөн хувилбарыг хуулна.
 */
export function PromptFiller({
  promptId,
  slug,
  body,
  variables,
}: {
  promptId: string;
  slug: string;
  body: string;
  variables: string[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = useMemo(() => fillVariables(body, values), [body, values]);
  const segments = useMemo(() => splitVariables(body), [body]);
  const done = variables.filter((v) => (values[v] ?? "").trim()).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
          <span className="text-xs uppercase tracking-widest text-muted">Prompt</span>
          <CopyPrompt promptId={promptId} slug={slug} text={filled} compact />
        </div>
        <pre className="px-3 py-3 text-sm whitespace-pre-wrap break-words font-mono">
          {variables.length === 0
            ? body
            : segments.map((s, i) =>
                s.variable ? (
                  <span
                    key={i}
                    className={`rounded px-1 ${
                      values[s.text]?.trim() ? "bg-up/15 text-ink" : "bg-accent/15 text-accent"
                    }`}
                  >
                    {values[s.text]?.trim() || `{${s.text}}`}
                  </span>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
        </pre>
      </div>

      {variables.length > 0 && (
        <section className="rounded-lg border border-line p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Хувьсагчаа бөглөх</h2>
            <span className="text-xs text-muted tabular-nums">{done}/{variables.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {variables.map((name) => (
              <label key={name} className="block space-y-1">
                <span className="text-xs text-muted">{name}</span>
                <input
                  value={values[name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                  placeholder={name}
                  className="w-full rounded border border-line bg-transparent px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">
            Бөглөөгүй нүх нь {"{"}хаалт{"}"} хэвээр хуулагдана — дараа нь гараар нөхөж болно.
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <CopyPrompt promptId={promptId} slug={slug} text={filled} />
        <a
          href={chatGptUrl(filled)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("prompt_open_chatgpt", { slug })}
          className="text-sm rounded border border-line px-3 py-1.5 text-muted hover:text-ink"
        >
          ChatGPT-д нээх ↗
        </a>
        <a
          href={geminiUrl(filled)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm rounded border border-line px-3 py-1.5 text-muted hover:text-ink"
        >
          Gemini-д нээх ↗
        </a>
      </div>
      <p className="text-xs text-muted">
        Товч ажиллахгүй бол «Хуулах» дараад хэрэгсэл дээрээ буулгана уу — зарим хэрэгсэл бэлэн
        текстийг хаягаар хүлээж авдаггүй.
      </p>
    </div>
  );
}
