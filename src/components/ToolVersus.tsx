import Link from "next/link";
import { MnBadge, PriceBadge, Stars } from "./ToolList";
import { ToolClickOut } from "./ToolClickOut";
import { ToolLogo } from "./ToolLogo";
import type { ToolDetail } from "@/tools/queries";
import { PLATFORM_LABEL, TOOL_CATEGORY_LABEL, TOOL_PLAN_LABEL, type Platform } from "@/tools/tool.api";

function head(t: ToolDetail) {
  return (
    <div className="space-y-2">
      <Link href={`/hereglel/${t.slug}`} className="flex items-center gap-2 hover:text-accent">
        <ToolLogo name={t.name} slug={t.slug} hasLogo={t.hasLogo} size={36} />
        <span className="font-medium">{t.name}</span>
      </Link>
      <p className="text-sm text-muted">{t.tagline}</p>
    </div>
  );
}

/** Хоёр хэрэгслийг хажуу хажуугаар — энгийн хүснэгт (Б.2-д моделиудаар өргөжинө) */
export function ToolVersus({ a, b }: { a: ToolDetail; b: ToolDetail }) {
  const rows: { label: string; cell: (t: ToolDetail) => React.ReactNode }[] = [
    { label: "Үнэ", cell: (t) => <PriceBadge tool={t} /> },
    {
      label: "Сарын тариф",
      cell: (t) => (t.priceFrom ? `$${t.priceFrom}` : t.pricing === "FREE" ? "үнэгүй" : "—"),
    },
    { label: "Монгол хэл", cell: (t) => <MnBadge support={t.mongolianSupport} /> },
    { label: "Үнэлгээ", cell: (t) => <Stars rating={t.rating} count={t.reviewCount} /> },
    { label: "Санал", cell: (t) => <span className="tabular-nums">▲ {t.upvotes}</span> },
    {
      label: "Ангилал",
      cell: (t) => t.categories.map((c) => TOOL_CATEGORY_LABEL[c]).join(", ") || "—",
    },
    {
      label: "Платформ",
      cell: (t) => t.platforms.map((p) => PLATFORM_LABEL[p as Platform] ?? p).join(", ") || "—",
    },
    { label: "Төлбөрийн хэлбэр", cell: (t) => TOOL_PLAN_LABEL[t.pricing] },
    {
      label: "Вэбсайт",
      cell: (t) => (
        <ToolClickOut
          toolId={t.id} slug={t.slug} href={t.affiliateUrl ?? t.website}
          affiliate={Boolean(t.affiliateUrl)} label="Нээх" compact
        />
      ),
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-xl">
        <thead>
          <tr className="border-b border-line align-bottom">
            <th className="py-3 pr-3 text-left w-32 font-normal text-xs text-muted">Шалгуур</th>
            <th className="py-3 px-3 text-left">{head(a)}</th>
            <th className="py-3 pl-3 text-left">{head(b)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-0">
              <td className="py-2 pr-3 text-xs text-muted align-top">{r.label}</td>
              <td className="py-2 px-3 align-top">{r.cell(a)}</td>
              <td className="py-2 pl-3 align-top">{r.cell(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
