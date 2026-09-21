import { NextResponse } from "next/server";
import { siteUrl, unsubscribe } from "@/newsletter/subscribe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = await unsubscribe(token);
  return NextResponse.redirect(`${siteUrl()}/newsletter/hasagdlaa${ok ? "" : "?aldaa=1"}`);
}
