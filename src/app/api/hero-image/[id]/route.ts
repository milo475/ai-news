/**
 * Нийтлэлийн тексгүй суурь зураг — /api/hero-image/<articleId>
 *
 * Карт (fbImageData) дээр headline бичигдсэн байдаг тул вэб нийтлэлийн дээр энэ
 * тексгүй хувилбарыг 16:9-өөр огтолж харуулна.
 */
import { prisma } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.article.findUnique({
    where: { id },
    select: { heroImageData: true, fbImageAt: true },
  });
  if (!a?.heroImageData) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(a.heroImageData), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(a.heroImageData.length),
      "Cache-Control": "public, max-age=3600",
      "Last-Modified": (a.fbImageAt ?? new Date()).toUTCString(),
    },
  });
}
