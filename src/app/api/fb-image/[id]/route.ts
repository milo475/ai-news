/**
 * FB постын зургийг DB-ээс үзүүлнэ — /api/fb-image/<articleId>
 *
 * Зураг нь Article.fbImageData дотор байдаг (web ба cron тусдаа контейнер учир файлаар
 * дамжуулах боломжгүй). /admin дээрх урьдчилсан харалтад хэрэглэнэ.
 */
import { prisma } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.article.findUnique({
    where: { id },
    select: { fbImageData: true, fbImageAt: true },
  });
  if (!a?.fbImageData) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(a.fbImageData), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(a.fbImageData.length),
      // Зураг дахин үүсгэвэл шинэчлэгдэх тул богино кэш
      "Cache-Control": "private, max-age=60",
      "Last-Modified": (a.fbImageAt ?? new Date()).toUTCString(),
    },
  });
}
