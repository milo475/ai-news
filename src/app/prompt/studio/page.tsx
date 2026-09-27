import Link from "next/link";
import { siteUrl } from "@/lib/site";
import { clamp, MAX_META_DESCRIPTION } from "@/guides/seo.api";
import { BreadcrumbLd } from "@/components/Breadcrumbs";
import { StudioWizard } from "./Wizard";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Юу хийхээ монголоор бич — студи тодруулах асуулт асууж, ямар хэрэгсэл ашиглахыг " +
  "хэлж, бэлэн промпт, параметр, алхам бүрийн тайлбарыг гаргана.";

export const metadata = {
  title: "Промпт студи",
  description: clamp(DESCRIPTION, MAX_META_DESCRIPTION),
  alternates: { canonical: `${siteUrl()}/prompt/studio` },
};

export default function StudioPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BreadcrumbLd crumbs={[{ name: "Prompt сан", path: "/prompt" }, { name: "Промпт студи" }]} />

      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Промпт студи</h1>
        <p className="text-sm text-muted">
          Юу хийхээ монголоор бичихэд л хангалттай. Студи тодруулж асуугаад, ямар хэрэгсэл
          ашиглахыг хэлж, хуулаад тавихад бэлэн промпт, параметр, алхам бүрийн тайлбарыг гаргана.
        </p>
      </header>

      <StudioWizard />

      <p className="border-t border-line pt-4 text-xs text-muted">
        Бэлэн промпт хайж байна уу? <Link href="/prompt" className="text-accent underline">Prompt сан</Link>{" "}
        дээр 40+ бэлэн промпт бий.
      </p>
    </div>
  );
}
