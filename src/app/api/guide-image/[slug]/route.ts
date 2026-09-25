/**
 * Зааврын тексгүй суурь зураг — /api/guide-image/<slug>
 *
 * Slug-аар дууддаг нь OG/JSON-LD-д тогтвортой хаяг өгөхийн тулд.
 */
import { prisma } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await prisma.guide.findUnique({
    where: { slug },
    select: { heroImageData: true, heroImageAt: true },
  });
  if (!g?.heroImageData) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(g.heroImageData), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(g.heroImageData.length),
      "Cache-Control": "public, max-age=86400",
      "Last-Modified": (g.heroImageAt ?? new Date()).toUTCString(),
    },
  });
}
