"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { finishQuizAction, saveQuizPreferenceAction } from "@/songolt/actions";
import { track } from "@/lib/analytics";

export interface ResultItem {
  slug: string;
  name: string;
  tagline: string;
  reason: string;
  score: number;
  guide: { slug: string; title: string } | null;
  prompt: { slug: string; title: string } | null;
}

const link = "text-xs rounded border border-line px-2.5 py-1 text-muted hover:text-ink whitespace-nowrap";

/**
 * Үр дүнгийн 3 карт + хуваалцах.
 *
 * Бүртгэл (finishQuizAction) нь зөвхөн нэг удаа — дахин ачаалахад давхар тоологдохгүйн
 * тулд sessionStorage-д тэмдэглэнэ.
 */
export function QuizResult({ code, items }: { code: string; items: ResultItem[] }) {
  const [copied, setCopied] = useState(false);
  const [savedPref, setSavedPref] = useState(false);

  useEffect(() => {
    const key = `quiz-done-${code}`;
    let already = false;
    try {
      already = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage хаалттай — давхар тоологдож магадгүй, тоолуур чухал биш
    }
    if (already) return;

    track("quiz_finish", { tool: items[0]?.slug ?? "" });
    void finishQuizAction(code, items.map((i) => i.slug));
    // Нэвтэрсэн бол сонирхлыг автоматаар бөглөнө (аль хэдийн тохируулсан бол хөндөхгүй)
    void saveQuizPreferenceAction(code).then((r) => setSavedPref(r.saved));
  }, [code, items]);

  const url = typeof window === "undefined" ? "" : window.location.href;
  const top = items[0];

  return (
    <div className="space-y-4">
      {top && (
        <article className="rounded-lg border border-accent/40 bg-accent/5 p-5 space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs uppercase tracking-widest text-accent">Танд тохирох #1</span>
            <span className="ml-auto text-xs text-muted tabular-nums">{top.score.toFixed(1)} оноо</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{top.name}</h2>
          <p className="text-muted">{top.tagline}</p>
          <p className="text-[15px] leading-relaxed">{top.reason}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/hereglel/${top.slug}`} className="rounded bg-accent text-white px-3 py-1.5 text-sm font-medium hover:opacity-90">
              Каталогт үзэх →
            </Link>
            {top.guide && <Link href={`/zaavar/${top.guide.slug}`} className={link}>Заавар</Link>}
            {top.prompt && <Link href={`/prompt/${top.prompt.slug}`} className={link}>Prompt</Link>}
          </div>
        </article>
      )}

      {items.length > 1 && (
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.slice(1).map((i, idx) => (
            <li key={i.slug} className="rounded-lg border border-line p-4 space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-muted">#{idx + 2}</span>
                <Link href={`/hereglel/${i.slug}`} className="font-medium hover:text-accent">{i.name}</Link>
                <span className="ml-auto text-xs text-muted tabular-nums">{i.score.toFixed(1)}</span>
              </div>
              <p className="text-sm text-muted line-clamp-2">{i.tagline}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/hereglel/${i.slug}`} className={link}>Каталогт үзэх</Link>
                {i.guide && <Link href={`/zaavar/${i.guide.slug}`} className={link}>Заавар</Link>}
                {i.prompt && <Link href={`/prompt/${i.prompt.slug}`} className={link}>Prompt</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("quiz_share", { platform: "facebook", tool: top?.slug ?? "" })}
          className="rounded border border-accent/60 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
        >
          Facebook-т хуваалцах
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              track("quiz_share", { platform: "copy", tool: top?.slug ?? "" });
              window.setTimeout(() => setCopied(false), 2_000);
            } catch {
              setCopied(false);
            }
          }}
          className="rounded border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          {copied ? "Хуулсан" : "Холбоос хуулах"}
        </button>
        <Link href="/songolt" className="rounded border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
          Дахин эхлэх
        </Link>
      </div>

      {savedPref && (
        <p className="text-xs text-up">
          Таны сонирхлыг профайлд хадгаллаа — нүүр хуудсанд «Таны сонирхол» блок гарч ирнэ.
        </p>
      )}
    </div>
  );
}
