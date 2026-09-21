import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AI Мэдээ — Дэлхийн AI-ийн жагсаалт, монголоор", template: "%s · AI Мэдээ" },
  description: "Дэлхийн хамгийн их хэрэглэгддэг AI моделиудын өдөр тутмын жагсаалт, өсөлт уналт, мэдээ — монгол хэлээр.",
};

const NAV = [
  { href: "/", label: "Нүүр" },
  { href: "/jagsaalt", label: "Жагсаалт" },
  { href: "/medee", label: "Мэдээ" },
  { href: "/argachlal", label: "Аргачлал" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body className="min-h-dvh flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              AI<span className="text-accent">Мэдээ</span>
            </Link>
            <nav className="flex gap-4 sm:gap-5 text-sm text-muted overflow-x-auto whitespace-nowrap">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 flex-1">{children}</main>
        <footer className="border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-6xl px-4 py-6 space-y-1">
            <p>© 2026 AI Мэдээ. Жагсаалтын өгөгдөл: OpenRouter (CC BY 4.0).</p>
            <p>Мэдээний хураангуйг AI agent бэлтгэж, хүн хянан нийтэлдэг. Эх сурвалж бүрийн холбоосыг нийтлэл дээр заана.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
