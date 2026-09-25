"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Хуулж болох prompt. bodyMd дотор ```prompt ... ``` гэж тэмдэглэсэн блок эндээс гарна.
 */
export function PromptBox({ text, guideSlug }: { text: string; guideSlug?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-accent/20 px-3 py-1.5">
        <span className="text-xs uppercase tracking-widest text-accent">Prompt</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              track("prompt_copy", guideSlug ? { slug: guideSlug } : undefined);
              window.setTimeout(() => setCopied(false), 2_000);
            } catch {
              // Clipboard хаалттай (http, зөвшөөрөлгүй) — хэрэглэгч гараар сонгож хуулна
              setCopied(false);
            }
          }}
          className="text-xs rounded border border-accent/40 px-2 py-0.5 text-accent hover:bg-accent/10"
        >
          {copied ? "Хуулсан" : "Хуулах"}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-sm whitespace-pre-wrap break-words font-mono">{text}</pre>
    </div>
  );
}
