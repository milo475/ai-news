import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BreadcrumbLd } from "@/components/Breadcrumbs";
import { siteUrl } from "@/lib/site";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { personas } from "@/studio/personas";
import { personaBySlug, personaDescription } from "@/studio/personas.api";
import { FORMAT_LABEL } from "@/studio/studio.api";

/** Статик — LLM дуудлагагүй, өгөгдөл нь JSON-д */
export const dynamic = "force-static";

export function generateStaticParams() {
  return personas().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = personaBySlug(slug, personas());
  if (!p) return { title: "Олдсонгүй" };

  const url = `${siteUrl()}/prompt/studio/m/${p.slug}`;
  return {
    title: p.title,
    description: clamp(personaDescription(p), MAX_META_DESCRIPTION),
    alternates: { canonical: url },
    openGraph: {
      title: p.title,
      description: clamp(p.intro, MAX_META_DESCRIPTION),
      url,
      type: "website",
    },
  };
}

export default async function PersonaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = personaBySlug(slug, personas());
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BreadcrumbLd
        crumbs={[
          { name: "Prompt сан", path: "/prompt" },
          { name: "Промпт студи", path: "/prompt/studio" },
          { name: p.name },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-xl font-semibold">{p.title}</h1>
        <p className="text-sm text-muted">{p.intro}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Жишээ дээр дарахад студи бөглөгдөнө</h2>
        {p.examples.map((e, i) => (
          <Link
            key={e.request}
            href={`/prompt/studio?m=${p.slug}&j=${i}`}
            className="block rounded-lg border border-line p-4 transition-colors hover:border-accent"
          >
            <p className="text-sm font-medium">{e.request}</p>
            <p className="mt-1 text-xs text-muted">
              {FORMAT_LABEL[e.format]} · {Object.keys(e.answers).length} асуулт урьдчилан бөглөгдсөн
            </p>
            <p className="mt-2 text-sm text-accent">Энэ жишээгээр эхлэх →</p>
          </Link>
        ))}
      </section>

      <section className="space-y-2 border-t border-line pt-4">
        <h2 className="text-sm font-medium">Өөр мэргэжил</h2>
        <div className="flex flex-wrap gap-2">
          {personas()
            .filter((x) => x.slug !== p.slug)
            .map((x) => (
              <Link
                key={x.slug}
                href={`/prompt/studio/m/${x.slug}`}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
              >
                {x.name}
              </Link>
            ))}
        </div>
      </section>

      <p className="text-xs text-muted">
        Өөрийн хүсэлтээ шууд бичих бол{" "}
        <Link href="/prompt/studio" className="text-accent underline">
          Промпт студи
        </Link>{" "}
        рүү орно уу.
      </p>
    </div>
  );
}
