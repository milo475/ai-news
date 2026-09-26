import type { Metadata } from "next";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { JsonLd } from "@/components/JsonLd";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { SearchDialog } from "@/components/SearchDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Umami } from "@/components/Umami";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld.api";
// Side effect: алдаа бүртгэгчийг globalThis дээр тавина (instrumentation.ts уншина)
import "@/lib/errors";
import { CONTACT_EMAIL, sameAs, siteUrl, socialLinks } from "@/lib/site";
import { roboto } from "./fonts";
import "./globals.css";

const SITE = siteUrl();

export const metadata: Metadata = {
  // Бүх харьцангуй хаяг (canonical, OG image) үүнээс үнэмлэхүй болно
  metadataBase: new URL(SITE),
  title: { default: "AI News — Дэлхийн AI-ийн жагсаалт, монголоор", template: "%s · AI News" },
  description:
    "Дэлхийн хамгийн их хэрэглэгддэг AI моделиудын өдөр тутмын жагсаалт, өсөлт уналт, мэдээ — монгол хэлээр.",
  applicationName: "AI News",
  alternates: {
    canonical: "/",
    // Сайт нь зөвхөн монгол хэлтэй — x-default мөн өөрөө
    languages: { mn: "/", "x-default": "/" },
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: "AI News — бүх шинэ агуулга" },
        { url: "/feed/mongol.xml", title: "AI News — Монголын AI мэдээ" },
      ],
    },
  },
  // Зургийг Next өөрөө src/app/opengraph-image.png-ээс авна
  openGraph: { siteName: "AI News", locale: "mn_MN", type: "website" },
  twitter: { card: "summary_large_image" },
};

/** Хуудас зурагдахаас өмнө горимыг тавина — буруу өнгө анивчихгүй */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

/** Үндсэн цэс — сайтын гол 8 хэсэг */
const NAV = [
  { href: "/", label: "Нүүр" },
  { href: "/medee", label: "Мэдээ" },
  { href: "/zaavar", label: "Заавар" },
  { href: "/prompt", label: "Prompt" },
  { href: "/hereglel", label: "Хэрэгсэл" },
  { href: "/benchmark", label: "Бенчмарк" },
  { href: "/mongol", label: "Монгол" },
  { href: "/barimt", label: "Баримт" },
];

/** Цэсэнд багтаагүй ч чухал хуудсууд — хөлд */
const MORE = [
  { href: "/jagsaalt", label: "Моделийн жагсаалт" },
  { href: "/harits", label: "Харьцуулах" },
  { href: "/songolt", label: "Надад ямар AI тохирох вэ?" },
  { href: "/hereglee", label: "Хэрэглээний жишээ" },
  { href: "/hailt", label: "Хайлт" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const social = socialLinks();

  return (
    <html lang="mn" className={roboto.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <JsonLd
          data={[
            organizationJsonLd({ siteUrl: SITE, sameAs: sameAs(), email: CONTACT_EMAIL }),
            websiteJsonLd(SITE),
          ]}
        />
        <a
          href="#aguulga"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Агуулга руу шилжих
        </a>

        <header className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" title="AI News — нүүр хуудас">
              <Logo />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <nav aria-label="Үндсэн цэс" className="hidden md:flex gap-4 lg:gap-5 text-sm text-muted whitespace-nowrap">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
                ))}
              </nav>
              <SearchDialog />
              <ThemeToggle />
              <AuthNav />
              <MobileNav items={NAV} />
            </div>
          </div>
        </header>

        <main id="aguulga" className="mx-auto w-full max-w-6xl px-4 py-8 flex-1">{children}</main>

        <footer className="border-t border-line text-sm text-muted">
          <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="font-semibold text-ink">AI News</p>
              <p className="text-xs leading-relaxed">
                Дэлхийн хиймэл оюуны мэдээ, моделийн жагсаалт, хэрэгслийн каталогийг монгол хэлээр
                нэг дор. Хураангуйг AI agent бэлтгэж, хүн хянан нийтэлдэг — эх сурвалж бүрийн
                холбоосыг нийтлэл дээр заана.
              </p>
            </div>

            <nav aria-label="Нэмэлт холбоос" className="text-xs">
              <p className="mb-1 font-semibold text-ink text-sm">Бусад хуудас</p>
              {MORE.map((m) => (
                // py-1.5 — гар утсанд дарах талбайг 24px-ээс дээш болгоно
                <Link key={m.href} href={m.href} className="block py-1.5 hover:text-ink">
                  {m.label}
                </Link>
              ))}
            </nav>

            <div className="space-y-1.5 text-xs">
              <p className="font-semibold text-ink text-sm">Холбоо барих</p>
              <p>
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">{CONTACT_EMAIL}</a>
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 [&>a]:py-1.5">
                {social.facebook && (
                  <a href={social.facebook} rel="noopener me" target="_blank" className="hover:text-ink">Facebook</a>
                )}
                {social.instagram && (
                  <a href={social.instagram} rel="noopener me" target="_blank" className="hover:text-ink">Instagram</a>
                )}
                <a href="/feed.xml" className="hover:text-ink">RSS</a>
                <a href="/feed/mongol.xml" className="hover:text-ink">RSS (Монгол)</a>
              </div>
              <p>
                <Link href="/nuutslal" className="inline-block py-1.5 hover:text-ink">
                  Нууцлалын бодлого
                </Link>
              </p>
            </div>
          </div>

          <div className="border-t border-line">
            <div className="mx-auto max-w-6xl px-4 py-4 text-xs">
              © 2026 AI News. Жагсаалтын өгөгдөл: OpenRouter (CC BY 4.0).
            </div>
          </div>
        </footer>
        <Umami />
      </body>
    </html>
  );
}
