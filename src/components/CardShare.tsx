"use client";

import { useState } from "react";
import { countCardCopyAction } from "@/gallery/actions";
import { embedCode, PLATFORM_LABEL, shareUrl, type SharePlatform } from "@/gallery/card.api";
import { track } from "@/lib/analytics";

const btn = "text-xs rounded border border-line px-2.5 py-1 text-muted hover:text-ink whitespace-nowrap";

/**
 * Хуваалцах, татах, embed — картын хуудас ба lightbox-д.
 *
 * Хуваалцах нь бүгд нийтийн share dialog — хэрэглэгч нэвтрэх шаардлагагүй.
 */
export function CardShare({
  articleId,
  slug,
  title,
  url,
  imageUrl,
  platforms,
  appId,
  showEmbed = true,
}: {
  articleId: string;
  slug: string;
  title: string;
  /** Картын хуудасны бүтэн хаяг — share dialog-д явна */
  url: string;
  imageUrl: string;
  platforms: SharePlatform[];
  appId?: string;
  showEmbed?: boolean;
}) {
  const [copied, setCopied] = useState<"image" | "embed" | null>(null);
  const [failed, setFailed] = useState(false);

  const flash = (what: "image" | "embed") => {
    setCopied(what);
    setFailed(false);
    window.setTimeout(() => setCopied(null), 2_000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {platforms.map((p) => (
        <a
          key={p}
          href={shareUrl(p, url, title, appId)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(`card_share_${p}`, { slug })}
          className={btn}
        >
          {PLATFORM_LABEL[p]}
        </a>
      ))}

      <a
        href={imageUrl}
        download={`ai-news-${slug}.jpg`}
        onClick={() => {
          track("card_download", { slug });
          void countCardCopyAction(articleId);
        }}
        className={btn}
      >
        Зураг татах
      </a>

      <button
        type="button"
        onClick={async () => {
          try {
            // Зургийг clipboard-д тавина — зарим хөтөч дэмждэггүй тул алдааг барина
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            flash("image");
            track("card_download", { slug, mode: "copy" });
            void countCardCopyAction(articleId);
          } catch {
            setFailed(true);
          }
        }}
        className={btn}
      >
        {copied === "image" ? "Хуулсан" : failed ? "Татаж авна уу" : "Зураг хуулах"}
      </button>

      {showEmbed && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                embedCode(new URL(url).origin, slug, title),
              );
              flash("embed");
              track("card_embed_copy", { slug });
            } catch {
              setFailed(true);
            }
          }}
          className={btn}
        >
          {copied === "embed" ? "Код хуулсан" : "Embed код"}
        </button>
      )}
    </div>
  );
}
