import Link from "next/link";
import { requireUser } from "@/auth/session";
import { fmtDate } from "@/components/format";
import { mySessions } from "@/studio/db";
import { FORMAT_LABEL, toolById, type StudioFormat } from "@/studio/studio.api";

export const metadata = { title: "Миний промптууд" };

export default async function MyStudioPage() {
  const user = await requireUser();
  const rows = await mySessions(user.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold">Миний промптууд</h1>
          <p className="text-sm text-muted">Промпт студиэр бэлдсэн ажлууд.</p>
        </div>
        <Link href="/prompt/studio" className="whitespace-nowrap text-sm text-accent hover:underline">
          Шинээр бэлдэх →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
          Та одоохондоо студиэр юу ч бэлдээгүй байна.{" "}
          <Link href="/prompt/studio" className="text-accent underline">Эхлэх</Link>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {rows.map((r) => (
            <li key={r.id} className="p-4">
              <Link href={`/prompt/studio/${r.id}`} className="text-sm hover:text-accent">
                {r.request}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{FORMAT_LABEL[r.format as StudioFormat]}</span>
                <span>·</span>
                <span>{r.tools.map((t) => toolById(t)?.name ?? t).join(", ")}</span>
                <span>·</span>
                <span>{fmtDate(r.createdAt)}</span>
                {r.feedback === true && <span className="text-up">👍</span>}
                {r.feedback === false && <span className="text-down">👎</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
