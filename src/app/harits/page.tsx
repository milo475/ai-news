import Link from "next/link";
import { TrackEvent } from "@/components/Track";
import { comparableModels, topComparisons } from "@/compare/queries";
import {
  BUDGETS, BUDGET_LABEL, pairPath, parsePair, PICKER_TASKS, PICKER_TASK_LABEL, pickModels,
  type Budget, type PickerTask,
} from "@/compare/pair.api";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";
import { prisma } from "@/db";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Ямар AI модель танд тохирох вэ? Гурван асуултад хариулбал хэмжсэн өгөгдөл дээр тулгуурлан " +
  "3 модель санал болгоно — монгол хэлний оноо, үнэ, хурдыг харьцуулна.";

export const metadata = {
  title: "Модель сонгох",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/harits` },
};

type Search = { ajil?: string; tusuv?: string; mn?: string };

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function HaritsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const task = (PICKER_TASKS as readonly string[]).includes(sp.ajil ?? "")
    ? (sp.ajil as PickerTask)
    : undefined;
  const budget = (BUDGETS as readonly string[]).includes(sp.tusuv ?? "")
    ? (sp.tusuv as Budget)
    : undefined;
  const mongolian = sp.mn === undefined ? undefined : sp.mn === "1";

  const answered = task !== undefined && budget !== undefined && mongolian !== undefined;

  const [models, popular] = await Promise.all([comparableModels(), topComparisons(10)]);
  const picked = answered ? pickModels(models, { task, budget, mongolian }) : [];

  const withAnswer = (key: keyof Search, value: string) => {
    const next = new URLSearchParams();
    const current: Search = {
      ajil: task, tusuv: budget,
      mn: mongolian === undefined ? undefined : mongolian ? "1" : "0",
    };
    for (const [k, v] of Object.entries({ ...current, [key]: value })) if (v) next.set(k, v);
    return `/harits?${next.toString()}`;
  };

  const popularLabels = await labelsFor(popular.map((p) => p.pairKey));

  return (
    <div className="max-w-3xl space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Харьцуулах" }]} />
      {answered && (
        <TrackEvent event="compare_pick" data={{ task, budget, mongolian: mongolian ? 1 : 0 }} />
      )}

      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Ямар модель танд тохирох вэ?</h1>
        <p className="text-muted">{DESCRIPTION}</p>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">1. Юунд ашиглах вэ?</p>
          <div className="flex flex-wrap gap-1.5">
            {PICKER_TASKS.map((t) => (
              <Chip key={t} href={withAnswer("ajil", t)} active={task === t}>
                {PICKER_TASK_LABEL[t]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">2. Төсөв?</p>
          <div className="flex flex-wrap gap-1.5">
            {BUDGETS.map((b) => (
              <Chip key={b} href={withAnswer("tusuv", b)} active={budget === b}>
                {BUDGET_LABEL[b]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">3. Монгол хэл чухал уу?</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip href={withAnswer("mn", "1")} active={mongolian === true}>Тийм</Chip>
            <Chip href={withAnswer("mn", "0")} active={mongolian === false}>Үгүй</Chip>
          </div>
        </div>
      </section>

      {!answered ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
          Гурван асуултад хариулбал санал харагдана.
        </p>
      ) : picked.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
          Тохирох модель олдсонгүй. Хэмжилтийн өгөгдөл хараахан хүрэлцээгүй байна.
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Санал болгох 3 модель</h2>
          <ol className="divide-y divide-line rounded-lg border border-line">
            {picked.map((m, i) => (
              <li key={m.slug} className="p-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-muted tabular-nums text-sm w-5">{i + 1}.</span>
                <Link href={`/model/${m.slug}`} className="font-medium hover:text-accent">{m.name}</Link>
                <span className="text-xs text-muted">{m.company}</span>
                <span className="text-xs text-muted basis-full sm:basis-auto">
                  {m.mnScore !== null && `MN ${m.mnScore.toFixed(2)}`}
                  {m.arenaElo !== null && ` · Elo ${Math.round(m.arenaElo)}`}
                  {m.outputPricePerM !== null &&
                    ` · гаралт ${m.outputPricePerM === 0 ? "үнэгүй" : `$${m.outputPricePerM}/1M`}`}
                </span>
                {i === 0 && picked[1] && (
                  <Link
                    href={pairPath(m.slug, picked[1].slug)}
                    className="text-sm text-accent hover:underline sm:ml-auto"
                  >
                    {picked[1].name}-тай харьцуулах →
                  </Link>
                )}
              </li>
            ))}
          </ol>
          {picked.length >= 2 && (
            <p className="text-xs text-muted">
              Хосоор харьцуулах:{" "}
              {picked.flatMap((m, i) =>
                picked.slice(i + 1).map((o) => (
                  <span key={`${m.slug}-${o.slug}`}>
                    <Link href={pairPath(m.slug, o.slug)} className="text-accent hover:underline">
                      {m.name} vs {o.name}
                    </Link>
                    {" · "}
                  </span>
                )),
              )}
            </p>
          )}
          <p className="text-xs text-muted">
            Санал нь <strong>дүрмээр</strong> гардаг: төсвөөр шүүж, монгол хэл чухал бол бенчмаркийн
            онооны дарааллаар, эс тэгвээс тухайн ажилд тохирох үзүүлэлтээр эрэмбэлнэ.
          </p>
        </section>
      )}

      {popularLabels.length > 0 && (
        <section className="space-y-2 border-t border-line pt-6">
          <h2 className="text-xl font-semibold">Хамгийн их үзэгдсэн харьцуулалт</h2>
          <ol className="space-y-1 text-sm">
            {popularLabels.map((p, i) => (
              <li key={p.key} className="flex gap-2">
                <span className="text-muted tabular-nums w-5">{i + 1}.</span>
                <Link href={`/harits/${p.key}`} className="hover:text-accent flex-1">{p.label}</Link>
                <span className="text-xs text-muted tabular-nums">{p.views}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

async function labelsFor(keys: string[]): Promise<{ key: string; label: string; views: number }[]> {
  if (keys.length === 0) return [];
  const rows = await prisma.aiModelComparison.findMany({
    where: { pairKey: { in: keys } },
    select: { pairKey: true, views: true },
  });
  const views = new Map(rows.map((r) => [r.pairKey, r.views]));

  const slugs = new Set<string>();
  for (const k of keys) {
    const parsed = parsePair(k);
    if (parsed) {
      slugs.add(parsed[0]);
      slugs.add(parsed[1]);
    }
  }
  const models = await prisma.aiModel.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, name: true, nameMn: true },
  });
  const names = new Map(models.map((m) => [m.slug, m.nameMn ?? m.name]));

  return keys.flatMap((k) => {
    const parsed = parsePair(k);
    if (!parsed) return [];
    const a = names.get(parsed[0]);
    const b = names.get(parsed[1]);
    if (!a || !b) return [];
    return [{ key: k, label: `${a} vs ${b}`, views: views.get(k) ?? 0 }];
  });
}
