import Link from "next/link";
import { Quiz } from "@/components/Quiz";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "5 асуултад хариулбал танд ямар AI хэрэгсэл тохирохыг хэлнэ — үнэ, монгол хэлний " +
  "дэмжлэг, таны төхөөрөмжид тохируулж. 1 минут.";

export const metadata = {
  title: "Надад ямар AI тохирох вэ?",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/songolt` },
  openGraph: {
    type: "website",
    title: "Надад ямар AI тохирох вэ?",
    description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
    url: `${siteUrl()}/songolt`,
  },
};

export default function SongoltPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Надад ямар AI тохирох вэ?</h1>
        <p className="text-muted">{DESCRIPTION}</p>
      </div>

      <div className="rounded-lg border border-line p-4 sm:p-6">
        <Quiz />
      </div>

      <p className="text-xs text-muted">
        Хариултыг <strong>дүрмээр</strong> тооцно — хиймэл оюун биш. Каталогийн{" "}
        <Link href="/hereglel" className="text-accent hover:underline">хэрэгслүүд</Link>,{" "}
        <Link href="/benchmark" className="text-accent hover:underline">монгол хэлний бенчмарк</Link>,
        үнийн мэдээллээс оноо бодож эрэмбэлнэ. Тиймээс ижил хариултад үргэлж ижил үр дүн гарна.
      </p>
    </div>
  );
}
