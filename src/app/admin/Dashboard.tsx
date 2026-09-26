import Link from "next/link";
import type { Dashboard as Data } from "@/admin/dashboard";
import { shortMessage } from "@/lib/errors.api";

/**
 * Өдрийн самбар — админ нэг харснаар «бүх юм хэвийн эсэх»-ийг мэднэ.
 * Анхаарал татах тоо (алдаа, хүлээгдэж байгаа) байвал өнгөөр тэмдэглэнэ.
 */
function Cell({
  label,
  value,
  hint,
  tone = "ink",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ink" | "warn" | "down" | "up";
  href?: string;
}) {
  const color =
    tone === "warn" ? "text-warn" : tone === "down" ? "text-down" : tone === "up" ? "text-up" : "";
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-line p-3 hover:border-accent">{body}</Link>
  ) : (
    <div className="rounded-lg border border-line p-3">{body}</div>
  );
}

function ago(d: Date, now = new Date()): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "дөнгөж";
  if (mins < 60) return `${mins} мин`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} цаг`;
  return `${Math.round(hours / 24)} хоног`;
}

export function Dashboard({ d, dailyLimit, igOn }: { d: Data; dailyLimit: number; igOn: boolean }) {
  const pendingTotal = d.pending.prompts + d.pending.tools + d.pending.reviews;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Өнөөдөр</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Cell
          label="Нийтэлсэн"
          value={`${d.publishedToday}/${dailyLimit}`}
          hint={d.localToday > 0 ? `${d.localToday} нь Монголын` : "дотоодын мэдээ алга"}
          tone={d.publishedToday === 0 ? "warn" : "ink"}
        />
        <Cell
          label="Facebook"
          value={d.fb.postedToday}
          hint={`дараалалд ${d.fb.queue}${d.fb.failed ? ` · ${d.fb.failed} унасан` : ""}`}
          tone={d.fb.failed > 0 ? "down" : "ink"}
        />
        <Cell
          label="Instagram"
          value={igOn ? d.ig.postedToday : "—"}
          hint={igOn ? `дараалалд ${d.ig.queue}${d.ig.failed ? ` · ${d.ig.failed} унасан` : ""}` : "IG_USER_ID алга"}
          tone={igOn && d.ig.failed > 0 ? "down" : "ink"}
        />
        <Cell
          label="LLM зардал"
          value={`$${d.cost.today.toFixed(2)}`}
          hint={`сард $${d.cost.month.toFixed(2)}`}
        />
        <Cell
          label="Шинэ хэрэглэгч"
          value={d.users.today}
          hint={`7 хоногт ${d.users.week} · бүгд ${d.users.total}`}
          href="/admin/hereglegch"
        />
        <Cell
          label="Хүлээгдэж байна"
          value={pendingTotal}
          hint={`prompt ${d.pending.prompts} · хэрэгсэл ${d.pending.tools} · үнэлгээ ${d.pending.reviews}`}
          tone={pendingTotal > 0 ? "warn" : "ink"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-3 space-y-0.5">
          <p className="text-xs text-muted">Сүүлийн ажиллалт</p>
          {d.lastRun ? (
            <p className="text-sm">
              <span className="font-medium">{d.lastRun.job}</span>{" "}
              <span className="text-muted">{ago(d.lastRun.startedAt)} өмнө</span>{" "}
              {d.lastRun.finishedAt === null ? (
                <span className="text-warn">ажиллаж байна</span>
              ) : d.lastRun.ok ? (
                <span className="text-up">OK</span>
              ) : (
                <span className="text-down">унасан</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted">Ажиллалт хараахан алга.</p>
          )}
          <p className="text-xs text-muted">RAW {d.rawCount} · нийтлэхэд бэлэн {d.readyCount}</p>
        </div>

        <Link href="/admin/aldaa" className="rounded-lg border border-line p-3 space-y-0.5 hover:border-accent">
          <p className="text-xs text-muted">Сүүлийн алдаа</p>
          {d.lastError ? (
            <>
              <p className="text-sm text-down">{shortMessage(d.lastError.message, 90)}</p>
              <p className="text-xs text-muted">
                {d.lastError.source}
                {d.lastError.path ? ` · ${d.lastError.path}` : ""} · {ago(d.lastError.lastAt)} өмнө
                {d.lastError.count > 1 ? ` · ${d.lastError.count} удаа` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-up">Алдаа бүртгэгдээгүй.</p>
          )}
        </Link>
      </div>
    </section>
  );
}
