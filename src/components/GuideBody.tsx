import ReactMarkdown from "react-markdown";
import { headingId } from "@/guides/markdown.api";
import { PromptBox } from "./PromptBox";

/** ReactMarkdown-ийн хүүхдээс цэвэр текст гаргана (гарчгийн id тооцоход) */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

/**
 * Зааврын бие. h2 бүр TOC-той таарах id авна, ```prompt блок нь «Хуулах» товчтой болно.
 */
export function GuideBody({ md, slug }: { md: string; slug?: string }) {
  // Гарчиг давхардвал tocFromMarkdown -2 залгадаг тул энд ч ижил тоолуур барина
  const used = new Map<string, number>();

  return (
    <div className="space-y-4 leading-relaxed text-[15px]">
      <ReactMarkdown
        components={{
          // Fenced блокийг code component өөрөө бүтнээр нь рендерлэнэ
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const text = String(children).replace(/\n$/, "");
            if (className?.includes("language-prompt")) return <PromptBox text={text} guideSlug={slug} />;
            if (className?.startsWith("language-")) {
              return (
                <pre className="rounded-lg border border-line px-3 py-2.5 text-sm overflow-x-auto">
                  <code>{text}</code>
                </pre>
              );
            }
            return <code className="rounded bg-line/50 px-1 py-0.5 text-[0.9em]">{children}</code>;
          },
          h2: ({ children }) => {
            const base = headingId(textOf(children));
            const n = (used.get(base) ?? 0) + 1;
            used.set(base, n);
            return (
              <h2 id={n === 1 ? base : `${base}-${n}`} className="text-xl font-semibold pt-4 scroll-mt-20">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => <h3 className="text-lg font-semibold pt-2">{children}</h3>,
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {children}
            </a>
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
