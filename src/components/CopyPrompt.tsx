"use client";

import { useState } from "react";
import { countCopyAction } from "@/prompts/actions";
import { track } from "@/lib/analytics";

/**
 * «Хуулах» — нэвтрэхгүйгээр ажиллана. Хуулсан тоог серверт нэмнэ.
 */
export function CopyPrompt({
  promptId,
  slug,
  text,
  compact = false,
}: {
  promptId: string;
  slug: string;
  /** Хувьсагч бөглөсөн бэлэн текст */
  text: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setFailed(false);
          track("prompt_copy", { slug, from: "prompt" });
          void countCopyAction(promptId);
          window.setTimeout(() => setCopied(false), 2_000);
        } catch {
          // Clipboard хаалттай (http, зөвшөөрөлгүй) — гараар сонгоно
          setFailed(true);
        }
      }}
      className={`rounded border transition-colors ${
        compact ? "text-xs px-2 py-1" : "text-sm px-3 py-1.5"
      } ${copied ? "border-up/60 text-up" : "border-accent/60 text-accent hover:bg-accent/10"}`}
    >
      {failed ? "Гараар хуулна уу" : copied ? "Хуулсан" : "Хуулах"}
    </button>
  );
}
