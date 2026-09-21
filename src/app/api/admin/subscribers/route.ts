/** Бүртгэлийн CSV — /admin доор тул middleware-ийн Basic auth хамаарна. */
import { exportCsv } from "@/app/admin/newsletter/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = await exportCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
