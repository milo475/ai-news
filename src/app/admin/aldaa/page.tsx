import Link from "next/link";
import { recentErrors } from "@/lib/errors";
import { shortMessage } from "@/lib/errors.api";
import { clearErrorLog } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Алдаа — админ" };

const LIMIT = 50;

function fmt(d: Date): string {
  // УБ-ийн цагаар (UTC+8)
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().replace("T", " ").slice(0, 16);
}

const TONE: Record<string, string> = {
  cron: "text-warn",
  web: "text-down",
  api: "text-down",
  action: "text-down",
};

export default async function AdminAldaa() {
  const rows = await recentErrors(LIMIT);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Алдаа</h1>
        </div>
        {rows.length > 0 && (
          <form action={clearErrorLog}>
            <button
              type="submit"
              className="text-sm rounded border border-line px-3 py-1.5 text-muted hover:text-ink"
            >
              Бүртгэлийг цэвэрлэх
            </button>
          </form>
        )}
      </div>

      <p className="text-sm text-muted">
        Сүүлийн {LIMIT} алдаа. Ижил алдааг дахин мөр болгохгүй — давтагдсан тоог нь харуулна.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-sm text-muted">
          Алдаа бүртгэгдээгүй байна.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className="rounded-lg border border-line p-3 space-y-1">
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted">
                <span className={`font-medium ${TONE[e.source] ?? ""}`}>{e.source}</span>
                {e.path && <span className="font-mono">{e.path}</span>}
                <span className="ml-auto tabular-nums">{fmt(e.lastAt)}</span>
                {e.count > 1 && (
                  <span className="rounded bg-line/60 px-1.5 py-0.5 tabular-nums text-ink">
                    {e.count} удаа
                  </span>
                )}
              </div>
              <p className="text-sm">{shortMessage(e.message, 300)}</p>
              {e.stack && (
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer hover:text-ink">Stack</summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                    {e.stack}
                  </pre>
                </details>
              )}
              {e.count > 1 && (
                <p className="text-xs text-muted">Анх: {fmt(e.createdAt)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
