import { NextResponse } from "next/server";
import { rateLimit } from "@/newsletter/rate-limit";
import { subscribe } from "@/newsletter/subscribe";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  if (!rateLimit(`subscribe:${clientIp(req)}`)) {
    return NextResponse.json(
      { ok: false, message: "Хэт олон оролдлого. Дараа дахин оролдоно уу." },
      { status: 429 },
    );
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json({ ok: false, message: "Имэйл хаяг буруу байна." }, { status: 400 });
  }

  const result = await subscribe(email);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
