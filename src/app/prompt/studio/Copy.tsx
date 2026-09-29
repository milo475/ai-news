"use client";

import { useState } from "react";
import { markCopied } from "@/studio/actions";

/** Промпт хуулах — студийн бүх промпт дээр нэг ижил товч */
export function Copy({
  text, label = "Хуулах", sessionId,
}: {
  text: string;
  label?: string;
  /** Өгвөл «хуулсан» гэж тэмдэглэнэ — бодит ашиглалтын дохио */
  sessionId?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
          if (sessionId) void markCopied(sessionId);
          window.setTimeout(() => setState("idle"), 2_000);
        } catch {
          setState("fail");
        }
      }}
      className={`shrink-0 rounded border px-3 py-1.5 text-sm transition-colors ${
        state === "done" ? "border-up/60 text-up" : "border-accent/60 text-accent hover:bg-accent/10"
      }`}
    >
      {state === "fail" ? "Гараар хуулна уу" : state === "done" ? "Хуулсан" : label}
    </button>
  );
}
