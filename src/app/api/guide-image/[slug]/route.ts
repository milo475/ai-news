/**
 * Зааврын тексгүй суурь зураг — /api/guide-image/<slug>
 *
 * Slug-аар дууддаг нь OG/JSON-LD-д тогтвортой хаяг өгөхийн тулд.
 */
import { prisma } from "@/db";
import { imageResponse } from "@/lib/image-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await prisma.guide.findUnique({
    where: { slug },
    select: { heroImageData: true, heroImageAt: true },
  });
  if (!g?.heroImageData) return new Response("Not found", { status: 404 });

  return imageResponse(req, {
    data: g.heroImageData,
    contentType: "image/jpeg",
    updatedAt: g.heroImageAt,
    maxAge: 86_400,
  });
}
