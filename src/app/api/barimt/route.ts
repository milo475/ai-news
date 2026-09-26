/** GET /api/barimt?cursor=…&angilal=… → { items, next } — галерейн infinite scroll */
import { NextResponse } from "next/server";
import { CATEGORIES } from "@/agent/category";
import { parseCategory } from "@/gallery/card.api";
import { cardPage } from "@/gallery/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = await cardPage({
    cursor: url.searchParams.get("cursor"),
    category: parseCategory(url.searchParams.get("angilal") ?? undefined, CATEGORIES),
  });

  return NextResponse.json(page, {
    // Карт нь өдөрт 1–3 удаа нэмэгддэг — 5 минутын кэш хангалттай
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
