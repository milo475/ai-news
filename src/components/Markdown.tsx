import ReactMarkdown from "react-markdown";

/** bodyMn-ийг үзүүлнэ. Raw HTML идэвхгүй (react-markdown-ийн үндсэн байдал). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 leading-relaxed">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          h1: ({ children }) => <h2 className="text-xl font-semibold pt-2">{children}</h2>,
          h2: ({ children }) => <h2 className="text-xl font-semibold pt-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold pt-2">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-line pl-4 text-muted">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
