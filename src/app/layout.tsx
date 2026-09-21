import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI News — Дэлхийн AI-ийн жагсаалт, монголоор", template: "%s · AI News" },
  description: "Дэлхийн хамгийн их хэрэглэгддэг AI моделиудын өдөр тутмын жагсаалт, өсөлт уналт, мэдээ — монгол хэлээр.",
  // Зургийг Next өөрөө src/app/opengraph-image.png-ээс авна
  openGraph: { siteName: "AI News", locale: "mn_MN", type: "website" },
};

/** Хуудас зурагдахаас өмнө горимыг тавина — буруу өнгө анивчихгүй */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

const NAV = [
  { href: "/", label: "Нүүр" },
  { href: "/jagsaalt", label: "Жагсаалт" },
  { href: "/hereglee", label: "Хэрэглээ" },
  { href: "/medee", label: "Мэдээ" },
  { href: "/argachlal", label: "Аргачлал" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-6">
            <Link href="/" aria-label="AI News нүүр">
              <Logo />
            </Link>
            <div className="flex items-center gap-3 min-w-0">
              <nav className="flex gap-4 sm:gap-5 text-sm text-muted overflow-x-auto whitespace-nowrap">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
                ))}
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 flex-1">{children}</main>
        <footer className="border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-6xl px-4 py-6 space-y-1">
            <p>© 2026 AI News. Жагсаалтын өгөгдөл: OpenRouter (CC BY 4.0).</p>
            <p>Мэдээний хураангуйг AI agent бэлтгэж, хүн хянан нийтэлдэг. Эх сурвалж бүрийн холбоосыг нийтлэл дээр заана.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
