"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy } from "./Copy";
import { rateStudio } from "@/studio/actions";
import type { StudioOutput } from "@/studio/output.api";

export interface ResultData {
  output: StudioOutput;
  tools: { id: string; name: string }[];
  warnings: string[];
  links: { tools: { label: string; href: string }[]; guides: { label: string; href: string }[] };
  aspect?: string;
  shareUrl?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PromptBlock({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded border border-line bg-card p-3">
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
        {text}
      </pre>
      <Copy text={text} />
    </div>
  );
}

export function StudioResult({ data, canRate = true }: { data: ResultData; canRate?: boolean }) {
  const { output, tools, warnings, links } = data;
  const nameOf = (id: string) => tools.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      {warnings.length > 0 && (
        <ul className="space-y-1.5 rounded border border-warn/40 bg-warn/5 p-3 text-sm text-muted">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {output.tools.map((t) => (
        <Section key={t.tool} title={nameOf(t.tool)}>
          <PromptBlock text={t.prompt} />

          {t.params.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-3 font-normal">Параметр</th>
                    <th className="py-1 pr-3 font-normal">Утга</th>
                    <th className="py-1 font-normal">Юунд</th>
                  </tr>
                </thead>
                <tbody>
                  {t.params.map((p) => (
                    <tr key={`${p.name}-${p.value}`} className="border-t border-line align-top">
                      <td className="py-1.5 pr-3 font-mono text-xs">{p.name}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{p.value}</td>
                      <td className="py-1.5 text-muted">{p.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {t.parts.length > 0 && (
            <details className="rounded border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm">
                Промпт юу гэсэн үг вэ — хэсэг бүрийн тайлбар
              </summary>
              <ul className="space-y-2 border-t border-line p-3 text-sm">
                {t.parts.map((p) => (
                  <li key={p.part}>
                    <code className="font-mono text-xs text-accent">{p.part}</code>
                    <p className="text-muted">{p.why}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {t.steps.length > 0 && (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
        </Section>
      ))}

      {output.storyboard.length > 0 && (
        <Section title={`Кадарын төлөвлөгөө (${output.storyboard.length} кадар)`}>
          <div className="space-y-3">
            {output.storyboard.map((s) => (
              <div key={s.n} className="rounded border border-line p-3">
                <p className="text-sm">
                  <span className="text-accent">Кадар {s.n}</span>
                  <span className="text-muted"> · {s.seconds} сек</span>
                </p>
                <p className="mt-1 text-sm text-muted">{s.mn}</p>
                <div className="mt-2 flex items-start gap-2">
                  <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px]">
                    {s.prompt}
                  </pre>
                  <Copy text={s.prompt} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {output.consistency && (
        <Section title="Дүрээ кадар бүрт ижил байлгах">
          <p className="text-sm text-muted">{output.consistency}</p>
        </Section>
      )}

      {output.music && (
        <Section title="Хөгжим (Suno)">
          <PromptBlock text={output.music.prompt} />
          <p className="text-sm text-muted">{output.music.mn}</p>
        </Section>
      )}

      {output.assembly.length > 0 && (
        <Section title="Эцсийн угсралт">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {output.assembly.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Section>
      )}

      {output.ideas.length > 0 && (
        <Section title="Нэмэлт санаа">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
            {output.ideas.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      )}

      {(links.tools.length > 0 || links.guides.length > 0) && (
        <Section title="Цааш унших">
          <div className="flex flex-wrap gap-2">
            {links.tools.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink"
              >
                {l.label} — хэрэгслийн тухай
              </Link>
            ))}
            {links.guides.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {canRate && data.shareUrl && <Rate sessionId={data.shareUrl.split("/").pop()!} share={data.shareUrl} />}
    </div>
  );
}

function Rate({ sessionId, share }: { sessionId: string; share: string }) {
  const [sent, setSent] = useState<boolean | null>(null);
  const url = typeof window === "undefined" ? share : `${window.location.origin}${share}`;

  return (
    <section className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
      {sent === null ? (
        <>
          <span className="text-muted">Тус болов уу?</span>
          <button
            type="button"
            onClick={() => { setSent(true); void rateStudio(sessionId, true); }}
            className="rounded border border-line px-3 py-1.5 hover:border-up hover:text-up"
          >
            👍 Тийм
          </button>
          <button
            type="button"
            onClick={() => { setSent(false); void rateStudio(sessionId, false); }}
            className="rounded border border-line px-3 py-1.5 hover:border-down hover:text-down"
          >
            👎 Үгүй
          </button>
        </>
      ) : (
        <span className="text-muted">Баярлалаа.</span>
      )}
      <span className="ml-auto flex items-center gap-2">
        <span className="text-muted">Холбоос:</span>
        <Copy text={url} label="Хуваалцах" />
      </span>
    </section>
  );
}
