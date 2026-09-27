import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbLd } from "@/components/Breadcrumbs";
import { getSession } from "@/studio/db";
import { studioLinks } from "@/studio/links";
import { warningsFor, type StudioOutput } from "@/studio/output.api";
import { aspectFor, toolById, type StudioFormat, type StudioTool } from "@/studio/studio.api";
import type { StudioBrief } from "@/studio/prompts.api";
import { StudioResult } from "../Result";

export const dynamic = "force-dynamic";

/** Хуваалцах холбоос — хайлтын системд индексжихгүй (хувийн ажил) */
export const metadata = {
  title: "Студийн ажил",
  robots: { index: false, follow: false },
};

export default async function StudioSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s || !s.outputs) notFound();

  const output = s.outputs as unknown as StudioOutput;
  const format = s.format as StudioFormat;
  const tools = s.tools.map((t) => toolById(t)).filter((t): t is StudioTool => Boolean(t));
  const links = await studioLinks(tools);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Prompt сан", path: "/prompt" }, { name: "Студийн ажил" }]} />

      <header className="space-y-2">
        <h1 className="text-xl font-semibold">{s.request}</h1>
        <p className="text-sm text-muted">
          Промпт студиэр бэлдсэн. Өөрийнхөө ажлыг хийх бол{" "}
          <Link href="/prompt/studio" className="text-accent underline">студи</Link> рүү орно уу.
        </p>
      </header>

      <StudioResult
        canRate={false}
        data={{
          output,
          tools: tools.map((t) => ({ id: t.id, name: t.name })),
          warnings: warningsFor({
            format, tools, request: s.request,
            brief: (s.brief as Partial<StudioBrief> | null) ?? {},
          }),
          links,
          aspect: aspectFor(format, s.placement),
        }}
      />
    </div>
  );
}
