/**
 * FB постын зургийг DB-ээс үзүүлнэ — /api/fb-image/<articleId>
 *
 * Зураг нь Article.fbImageData дотор байдаг (web ба cron тусдаа контейнер учир файлаар
 * дамжуулах боломжгүй). /admin дээрх урьдчилсан харалтад хэрэглэнэ.
 */
import { prisma } from "@/db";
import { imageResponse } from "@/lib/image-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.article.findUnique({
    where: { id },
    select: { fbImageData: true, fbImageAt: true },
  });
  if (!a?.fbImageData) return new Response("Not found", { status: 404 });

  // Нийтийн зураг: Instagram-ийн сервер энэ хаягаар татдаг тул public байх ёстой.
  // ?v=<fbImageAt> өгсөн бол immutable — карт дахин үүсэхэд шинэ хаяг болно.
  return imageResponse(req, {
    data: a.fbImageData,
    contentType: "image/jpeg",
    updatedAt: a.fbImageAt,
  });
}
