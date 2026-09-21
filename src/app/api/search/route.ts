/** GET /api/search?q=… → { articles, models, tools } */
import { NextResponse } from "next/server";
import { logSearch, MIN_QUERY, search } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Үүнээс удвал логд бичнэ */
const SLOW_MS = 300;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY) {
    return NextResponse.json({ q, articles: [], models: [], tools: [], total: 0 });
  }

  const t0 = Date.now();
  const results = await search(q, { limit: 8 });
  const ms = Date.now() - t0;
  if (ms > SLOW_MS) console.warn(`⚠ Удаан хайлт: "${q}" ${ms}ms, ${results.total} үр дүн`);

  void logSearch(q, results.total);

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
