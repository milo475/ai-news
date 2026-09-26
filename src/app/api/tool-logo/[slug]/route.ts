/**
 * Хэрэгслийн лого — /api/tool-logo/<slug>
 */
import { prisma } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await prisma.tool.findUnique({
    where: { slug },
    select: { logoData: true, logoType: true, logoAt: true },
  });
  if (!t?.logoData) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(t.logoData), {
    headers: {
      "Content-Type": t.logoType ?? "image/png",
      "Content-Length": String(t.logoData.length),
      "Cache-Control": "public, max-age=604800",
      // SVG нь өөр origin-д ажиллахгүй байг
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Last-Modified": (t.logoAt ?? new Date()).toUTCString(),
    },
  });
}
