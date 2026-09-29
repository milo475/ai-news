"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy } from "./Copy";
import { rateStudio, reviseStudio } from "@/studio/actions";
import type { StudioOutput } from "@/studio/output.api";

export interface ResultData {
  output: StudioOutput;
  tools: { id: string; name: string }[];
  warnings: string[];
  links: { tools: { label: string; href: string }[]; guides: { label: string; href: string }[] };
  aspect?: string;
  shareUrl?: string;
  /** Хэрэгслийн мэдлэгийн сан хэзээ шалгагдсан — tool id → "2026-09-27" */
  checked?: Record<string, string | null>;
  /** Үлдсэн засварын тоо */
  revisionsLeft?: number;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PromptBlock({ text, sessionId }: { text: string; sessionId?: string }) {
  return (
    <div className="flex items-start gap-2 rounded border border-line bg-card p-3">
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
        {text}
      </pre>
      <Copy text={text} sessionId={sessionId} />
    </div>
  );
}

export function StudioResult({ data, canRate = true }: { data: ResultData; canRate?: boolean }) {
  const { output, tools, warnings, links } = data;
  const sessionId = data.shareUrl?.split("/").pop();
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
          {t.draft && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Бэлэн эх бичвэр — хуулж аваад шууд ашиглаж болно:</p>
              <div className="flex items-start gap-2 rounded border border-accent/40 bg-accent/5 p-3">
                <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {t.draft}
                </pre>
                <Copy text={t.draft} sessionId={sessionId} />
              </div>
              <p className="text-xs text-muted">Доорх промпт нь үүнийг засах, өөр хувилбар гаргуулахад:</p>
            </div>
          )}
          <PromptBlock text={t.prompt} sessionId={sessionId} />

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

          {data.checked?.[t.tool] && (
            <p className="text-xs text-muted">
              Мэдээлэл шалгасан: {data.checked[t.tool]}
            </p>
          )}

          {data.shareUrl && (
            <Revise
              sessionId={data.shareUrl.split("/").pop()!}
              toolId={t.tool}
              toolName={nameOf(t.tool)}
              left={data.revisionsLeft ?? 0}
            />
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

/** «Үр дүн таарахгүй байна уу?» — юу нь буруугаа бичээд, гарсан зургаа оруулна */
function Revise({
  sessionId, toolId, toolName, left,
}: { sessionId: string; toolId: string; toolName: string; left: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    diagnosis: string; prompt: string; changes: string[]; tip: string;
  } | null>(null);
  const [remaining, setRemaining] = useState(left);

  if (remaining <= 0 && !result) return null;

  return (
    <details
      className="rounded border border-line"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-3 py-2 text-sm">
        Үр дүн таарахгүй байна уу? <span className="text-muted">({remaining} засвар үлдсэн)</span>
      </summary>

      <form
        className="space-y-3 border-t border-line p-3"
        action={async (form) => {
          setBusy(true);
          setError("");
          form.set("sessionId", sessionId);
          form.set("toolId", toolId);
          const r = await reviseStudio(form);
          setBusy(false);
          if (!r.ok || !r.revision) return setError(r.message ?? "Алдаа гарлаа.");
          setResult(r.revision);
          setRemaining(r.left ?? 0);
        }}
      >
        <div>
          <label htmlFor={`note-${toolId}`} className="text-sm">
            Юу нь таарахгүй байна вэ?
          </label>
          <textarea
            id={`note-${toolId}`}
            name="note"
            rows={2}
            maxLength={600}
            required
            className="mt-1 w-full rounded border border-line bg-card p-2.5 text-sm"
            placeholder={`Жишээ: ${toolName} дээр гарсан зураг хэт харанхуй, гутал нь харагдахгүй байна`}
          />
        </div>

        <div>
          <label htmlFor={`img-${toolId}`} className="text-sm">
            Гарсан зургаа оруулах <span className="text-muted">(заавал биш, JPG/PNG/WEBP ≤ 5MB)</span>
          </label>
          <input
            id={`img-${toolId}`}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1 block w-full text-sm text-muted"
          />
          <p className="mt-1 text-xs text-muted">
            Зургийг хадгалахгүй — шинжлээд тэр дор нь устгана.
          </p>
        </div>

        {error && <p className="text-sm text-down">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded border border-accent/60 px-3 py-1.5 text-sm text-accent disabled:opacity-40"
        >
          {busy ? "Шинжилж байна…" : "Засвар авах"}
        </button>
      </form>

      {result && (
        <div className="space-y-3 border-t border-line p-3">
          <div>
            <p className="text-sm font-medium">Юу зөрсөн бэ</p>
            <p className="mt-1 text-sm text-muted">{result.diagnosis}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Засварласан промпт</p>
            <div className="mt-1 flex items-start gap-2 rounded border border-line bg-card p-3">
              <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[13px]">
                {result.prompt}
              </pre>
              <Copy text={result.prompt} />
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {result.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {result.tip && <p className="text-sm text-muted">💡 {result.tip}</p>}
        </div>
      )}
    </details>
  );
}
