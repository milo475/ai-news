/**
 * Хэрэгслийн лого — /api/tool-logo/<slug>
 */
import { prisma } from "@/db";
import { imageResponse } from "@/lib/image-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await prisma.tool.findUnique({
    where: { slug },
    select: { logoData: true, logoType: true, logoAt: true },
  });
  if (!t?.logoData) return new Response("Not found", { status: 404 });

  return imageResponse(req, {
    data: t.logoData,
    contentType: t.logoType ?? "image/png",
    updatedAt: t.logoAt,
    maxAge: 604_800,
    // SVG нь өөр origin-д ажиллахгүй байг
    extra: { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
  });
}
