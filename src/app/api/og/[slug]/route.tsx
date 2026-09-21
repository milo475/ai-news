/**
 * Нийтлэлийн og:image — 1200×630, гарчиг + огноо + AI News лого.
 *
 *   /api/og/<slug>
 */
import { ImageResponse } from "next/og";
import { prisma } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCENT = "#4f46e5";
const PAPER = "#f7f6f2";
const INK = "#1b1b23";

function fmt(d: Date | null): string {
  return d ? `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}` : "";
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await prisma.article.findUnique({
    where: { slug },
    select: { titleMn: true, sourceTitle: true, publishedAt: true, kind: true, status: true },
  });
  if (!a || a.status !== "PUBLISHED") return new Response("Not found", { status: 404 });

  const title = a.titleMn ?? a.sourceTitle;
  const label = a.kind === "DIGEST" ? "Долоо хоногийн тойм" : "Мэдээ";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: PAPER, padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="16" fill={ACCENT} />
            <rect x="13" y="38" width="9" height="13" rx="2" fill="#fff" fillOpacity="0.55" />
            <rect x="27.5" y="28" width="9" height="23" rx="2" fill="#fff" fillOpacity="0.8" />
            <rect x="42" y="18" width="9" height="33" rx="2" fill="#fff" />
            <path d="M46.5 8 L52.5 15 L40.5 15 Z" fill="#fff" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: INK }}>AI</span>
            <span style={{ color: ACCENT, marginLeft: 12 }}>News</span>
          </div>
        </div>

        <div
          style={{
            display: "flex", fontSize: title.length > 70 ? 54 : 66, fontWeight: 700,
            color: INK, lineHeight: 1.18, letterSpacing: -1.5,
          }}
        >
          {title.slice(0, 130)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#6b6b76" }}>
          <span style={{ background: ACCENT, color: "#fff", padding: "6px 16px", borderRadius: 999, fontSize: 24 }}>
            {label}
          </span>
          <span>{fmt(a.publishedAt)}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
