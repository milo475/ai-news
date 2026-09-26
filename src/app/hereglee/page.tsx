import Link from "next/link";
import { getUseCases } from "@/data";
import { UseCaseIcon } from "@/components/UseCaseIcon";
import { BreadcrumbLd } from "@/components/Breadcrumbs";

// Build үед DB байхгүй тул prerender хийхгүй (нүүр хуудастай адил)
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return {
    title: "Хэрэглээний жишээ",
    description:
      "Ямар ажилд аль AI-г ашиглах вэ — ангилал бүрээр санал болгох хэрэгслүүд, жишээ хэрэглээ, монголоор.",
    alternates: { canonical: "/hereglee" },
  };
}

export default async function Hereglee() {
  const cases = await getUseCases();

  return (
    <div className="space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Хэрэглээний жишээ" }]} />
      <div className="space-y-2 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Ямар ажилд аль AI-г ашиглах вэ?</h1>
        <p className="text-muted">
          Хийх гэж буй ажлаа сонгоод, түүнд хамгийн тохиромжтой хэрэгслүүдийг харна уу. Жагсаалтыг хүн
          бэлтгэж, тогтмол шинэчилдэг.
        </p>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-sm text-muted">
          Ангиллууд хараахан бэлэн болоогүй байна.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cases.map((c) => (
            <Link
              key={c.slug}
              href={`/hereglee/${c.slug}`}
              className="rounded-lg border border-line p-4 space-y-2 hover:bg-line/30"
            >
              <div className="flex items-center gap-2 text-accent">
                <UseCaseIcon name={c.icon} />
                <span className="font-medium text-ink">{c.nameMn}</span>
              </div>
              <p className="text-sm text-muted">{c.descriptionMn}</p>
              {c.topTools.length > 0 && (
                <p className="text-xs text-muted">{c.topTools.join(" · ")}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
