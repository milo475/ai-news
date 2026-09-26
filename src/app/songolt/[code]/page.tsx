import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizResult } from "@/components/QuizResult";
import { resultFor } from "@/songolt/queries";
import {
  BUDGET_LABEL, decodeAnswers, DEVICE_LABEL, MONGOLIAN_LABEL, TASK_LABEL, WHO_LABEL,
} from "@/songolt/score.api";
import { clamp, MAX_META_DESCRIPTION, MAX_META_TITLE } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";

/** Ижил код → ижил үр дүн. Каталог өдөрт 1-2 удаа хувирдаг тул өдрийн кэш. */
export const revalidate = 86_400;

type Params = { code: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { code } = await params;
  const answers = decodeAnswers(code);
  if (!answers) return { title: "Үр дүн олдсонгүй" };

  const result = await resultFor(answers);
  const top = result[0]?.rec.tool.name;
  const site = siteUrl();
  const url = `${site}/songolt/${code}`;
  const title = top ? `Надад тохирох AI: ${top}` : "Надад ямар AI тохирох вэ?";
  const description = top
    ? `${WHO_LABEL[answers.who]}, ${answers.tasks.map((t) => TASK_LABEL[t].toLowerCase()).join(", ")} — ` +
      `${result.map((r) => r.rec.tool.name).join(", ")}. Та ч бас шалгаарай.`
    : "5 асуултад хариулбал танд ямар AI тохирохыг хэлнэ.";

  return {
    title: clamp(title, MAX_META_TITLE),
    description: clamp(description, MAX_META_DESCRIPTION),
    alternates: { canonical: url },
    openGraph: {
      type: "website", title, description, url,
      images: [{ url: `${site}/api/og/songolt?code=${code}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image", title, description,
      images: [`${site}/api/og/songolt?code=${code}`],
    },
  };
}

export default async function ResultPage({ params }: { params: Promise<Params> }) {
  const { code } = await params;
  const answers = decodeAnswers(code);
  if (!answers) notFound();

  const result = await resultFor(answers);
  if (result.length === 0) notFound();

  const summary = [
    answers.tasks.map((t) => TASK_LABEL[t]).join(", "),
    WHO_LABEL[answers.who],
    BUDGET_LABEL[answers.budget],
    MONGOLIAN_LABEL[answers.mongolian],
    DEVICE_LABEL[answers.device],
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <Link href="/songolt" className="text-sm text-muted hover:text-ink">← Асуулга</Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Танд тохирох AI: <span className="text-accent">{result[0]!.rec.tool.name}</span>
        </h1>
        <p className="text-sm text-muted">{summary.join(" · ")}</p>
      </div>

      <QuizResult
        code={code}
        items={result.map((r) => ({
          slug: r.rec.tool.slug,
          name: r.rec.tool.name,
          tagline: r.rec.tool.tagline,
          reason: r.rec.reason,
          score: r.rec.score.total,
          guide: r.guide,
          prompt: r.prompt,
        }))}
      />

      <p className="text-xs text-muted border-t border-line pt-4">
        Энэ хариултыг каталогийн өгөгдөл, монгол хэлний бенчмарк, үнээс{" "}
        <strong>дүрмээр</strong> тооцсон. Дэлгэрэнгүйг{" "}
        <Link href="/hereglel" className="text-accent hover:underline">хэрэгслийн каталогоос</Link>{" "}
        үзээрэй — тэнд шүүлтүүр, хэрэглэгчийн шүүмж бий.
      </p>
    </div>
  );
}
