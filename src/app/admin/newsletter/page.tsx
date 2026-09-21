import Link from "next/link";
import { prisma } from "@/db";
import { fmtDate } from "@/components/format";
import { sendTest } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Newsletter — админ" };

const STATUSES = ["PENDING", "ACTIVE", "UNSUBSCRIBED"] as const;

export default async function AdminNewsletter({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const msg = (await searchParams).msg;
  const [counts, sends, recent] = await Promise.all([
    prisma.subscriber.groupBy({ by: ["status"], _count: true }),
    prisma.newsletterSend.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.subscriber.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { email: true, status: true, createdAt: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  const digestTitles = new Map(
    (await prisma.article.findMany({
      where: { id: { in: sends.map((s) => s.digestArticleId) } },
      select: { id: true, titleMn: true, slug: true },
    })).map((a) => [a.id, a]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Админ</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Newsletter</h1>
        </div>
        {msg && <p className="text-xs text-accent">{msg}</p>}
      </div>

      <section className="grid grid-cols-3 gap-3">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-lg border border-line p-3">
            <p className="text-xs text-muted">{s}</p>
            <p className="text-2xl font-semibold tabular-nums">{countOf(s)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line p-4 space-y-3">
        <form action={sendTest} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-xs text-muted">Сүүлийн digest-ийг туршиж илгээх</span>
            <input
              name="email"
              type="email"
              required
              placeholder="ta@mail.mn"
              className="w-64 rounded border border-line bg-transparent px-3 py-1.5 text-sm"
            />
          </label>
          <button className="rounded border border-line px-3 py-1.5 text-sm hover:bg-line/40">Тест илгээх</button>
        </form>
        <a href="/api/admin/subscribers" className="inline-block text-sm text-accent hover:underline">
          CSV татаж авах →
        </a>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Илгээлтүүд</h2>
        {sends.length === 0 ? (
          <p className="text-sm text-muted">Хараахан илгээгээгүй.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {sends.map((s) => {
              const d = digestTitles.get(s.digestArticleId);
              return (
                <li key={s.id} className="p-3 flex flex-wrap justify-between gap-2">
                  <span>{d ? <Link href={`/medee/${d.slug}`} className="hover:text-accent">{d.titleMn}</Link> : s.digestArticleId}</span>
                  <span className="text-muted tabular-nums">
                    {fmtDate(s.createdAt)} · {s.sentCount} илгээв{s.failedCount > 0 && ` · ${s.failedCount} алдаа`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Сүүлийн бүртгэлүүд</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Бүртгэл алга.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {recent.map((r) => (
              <li key={r.email} className="p-3 flex flex-wrap justify-between gap-2">
                <span>{r.email}</span>
                <span className="text-muted tabular-nums">{r.status} · {fmtDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
