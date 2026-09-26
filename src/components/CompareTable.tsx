import Link from "next/link";
import { better, betterPrice, type CompareStats, type Winner } from "@/compare/pair.api";
import { BENCH_CATEGORIES, BENCH_CATEGORY_LABEL } from "@/bench/task.api";
import { fmtDate, fmtTokens } from "@/components/format";

/** «✓ дээр» тэмдэг. Тэнцсэн эсвэл өгөгдөл дутуу үед тэмдэггүй. */
function Mark({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="text-up ml-1" title="дээр">✓</span>;
}

interface Row {
  label: string;
  hint?: string;
  a: React.ReactNode;
  b: React.ReactNode;
  winner: Winner;
}

function fmtCtx(v: number | null): string {
  return v === null ? "—" : `${Math.round(v / 1000)}K`;
}

function fmtPrice(v: number | null): string {
  if (v === null) return "—";
  return v === 0 ? "үнэгүй" : `$${v}`;
}

export function CompareTable({ a, b }: { a: CompareStats; b: CompareStats }) {
  const rows: Row[] = [
    {
      label: "Монгол хэлний оноо",
      hint: "AI News-ийн бенчмарк, 0–10",
      a: a.mnScore === null ? "—" : a.mnScore.toFixed(2),
      b: b.mnScore === null ? "—" : b.mnScore.toFixed(2),
      winner: better(a.mnScore, b.mnScore, "higher"),
    },
    {
      label: "Arena Elo",
      hint: "LMArena-ийн хүний сонголтын оноо",
      a: a.arenaElo === null ? "—" : Math.round(a.arenaElo),
      b: b.arenaElo === null ? "—" : Math.round(b.arenaElo),
      winner: better(a.arenaElo, b.arenaElo, "higher"),
    },
    {
      label: "Хэрэглээний байр",
      hint: "OpenRouter дээрх өдрийн токен",
      a: a.usageRank === null ? "—" : `#${a.usageRank}`,
      b: b.usageRank === null ? "—" : `#${b.usageRank}`,
      // Байр бага нь дээр
      winner: betterPrice(a.usageRank, b.usageRank),
    },
    {
      label: "Токен / өдөр",
      a: a.usageTokens === null ? "—" : fmtTokens(String(a.usageTokens)),
      b: b.usageTokens === null ? "—" : fmtTokens(String(b.usageTokens)),
      winner: better(a.usageTokens, b.usageTokens, "higher"),
    },
    {
      label: "Context",
      hint: "Нэг удаад уншиж чадах текстийн хэмжээ",
      a: fmtCtx(a.contextLength),
      b: fmtCtx(b.contextLength),
      winner: better(a.contextLength, b.contextLength, "higher"),
    },
    {
      label: "Оролт, 1M токен",
      a: fmtPrice(a.inputPricePerM),
      b: fmtPrice(b.inputPricePerM),
      winner: betterPrice(a.inputPricePerM, b.inputPricePerM),
    },
    {
      label: "Гаралт, 1M токен",
      a: fmtPrice(a.outputPricePerM),
      b: fmtPrice(b.outputPricePerM),
      winner: betterPrice(a.outputPricePerM, b.outputPricePerM),
    },
    {
      label: "Монгол 1000 үгийн үнэ",
      hint: "Бенчмаркийн бодит хэмжилтээс",
      a: a.mnCostPer1k === null ? "—" : `$${a.mnCostPer1k.toFixed(3)}`,
      b: b.mnCostPer1k === null ? "—" : `$${b.mnCostPer1k.toFixed(3)}`,
      winner: betterPrice(a.mnCostPer1k, b.mnCostPer1k),
    },
    {
      label: "Хариу өгөх хугацаа",
      hint: "Бенчмаркийн дундаж",
      a: a.latencyMs === null ? "—" : `${(a.latencyMs / 1000).toFixed(1)}с`,
      b: b.latencyMs === null ? "—" : `${(b.latencyMs / 1000).toFixed(1)}с`,
      winner: betterPrice(a.latencyMs, b.latencyMs),
    },
    {
      label: "Оролтын төрөл",
      a: a.inputModalities.join(", ") || a.modality || "—",
      b: b.inputModalities.join(", ") || b.modality || "—",
      // Олон төрөл дэмждэг нь илүү боломжтой
      winner: better(a.inputModalities.length, b.inputModalities.length, "higher"),
    },
    {
      label: "Гарсан огноо",
      a: a.releasedAt ? fmtDate(a.releasedAt) : "—",
      b: b.releasedAt ? fmtDate(b.releasedAt) : "—",
      winner: better(a.releasedAt?.getTime() ?? null, b.releasedAt?.getTime() ?? null, "higher"),
    },
  ];

  const hasCategories = BENCH_CATEGORIES.some(
    (c) => a.mnByCategory[c] !== undefined || b.mnByCategory[c] !== undefined,
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-xl">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 pr-3 w-44 font-normal text-xs text-muted">Үзүүлэлт</th>
              <th className="py-2 px-3">
                <Link href={`/model/${a.slug}`} className="hover:text-accent">{a.name}</Link>
                <span className="block text-xs text-muted font-normal">{a.company}</span>
              </th>
              <th className="py-2 pl-3">
                <Link href={`/model/${b.slug}`} className="hover:text-accent">{b.name}</Link>
                <span className="block text-xs text-muted font-normal">{b.company}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <td className="py-2 pr-3 align-top">
                  <span className="text-xs text-muted">{r.label}</span>
                  {r.hint && <span className="block text-xs text-muted/70">{r.hint}</span>}
                </td>
                <td className={`py-2 px-3 tabular-nums ${r.winner === "a" ? "font-medium" : ""}`}>
                  {r.a}
                  <Mark on={r.winner === "a"} />
                </td>
                <td className={`py-2 pl-3 tabular-nums ${r.winner === "b" ? "font-medium" : ""}`}>
                  {r.b}
                  <Mark on={r.winner === "b"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasCategories && (
        <details className="rounded-lg border border-line p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Монгол хэлний оноог ангиллаар харах
          </summary>
          <table className="w-full text-sm mt-3">
            <tbody>
              {BENCH_CATEGORIES.map((c) => {
                const av = a.mnByCategory[c] ?? null;
                const bv = b.mnByCategory[c] ?? null;
                const w = better(av, bv, "higher");
                return (
                  <tr key={c} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-3 text-xs text-muted w-44">{BENCH_CATEGORY_LABEL[c]}</td>
                    <td className={`py-1.5 px-3 tabular-nums ${w === "a" ? "font-medium" : ""}`}>
                      {av === null ? "—" : av.toFixed(1)}
                      <Mark on={w === "a"} />
                    </td>
                    <td className={`py-1.5 pl-3 tabular-nums ${w === "b" ? "font-medium" : ""}`}>
                      {bv === null ? "—" : bv.toFixed(1)}
                      <Mark on={w === "b"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}

      <p className="text-xs text-muted">
        ✓ нь тухайн үзүүлэлтээр дээр гэдгийг заана. Аль нэгний өгөгдөл дутуу, эсвэл тэнцсэн үед
        тэмдэг тавихгүй. Байр, үнэ, хугацаанд бага нь дээр.
      </p>
    </div>
  );
}
