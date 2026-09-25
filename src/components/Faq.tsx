import type { FaqItem } from "@/guides/queries";

/** <details> ашигладаг тул JS-гүй ч нээгдэнэ. */
export function Faq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">Түгээмэл асуулт</h2>
      <div className="divide-y divide-line rounded-lg border border-line">
        {items.map((f) => (
          <details key={f.q} className="group p-4">
            <summary className="cursor-pointer list-none font-medium flex gap-2 items-start">
              <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
              <span>{f.q}</span>
            </summary>
            <p className="mt-2 pl-5 text-sm text-muted leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
