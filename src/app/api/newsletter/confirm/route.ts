import { NextResponse } from "next/server";
import { confirm, siteUrl } from "@/newsletter/subscribe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = await confirm(token);
  return NextResponse.redirect(`${siteUrl()}/newsletter/batalgaajlaa${ok ? "" : "?aldaa=1"}`);
}
