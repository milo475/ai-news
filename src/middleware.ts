/**
 * /admin — HTTP Basic auth. Хэрэглэгч "admin", нууц үг ADMIN_PASSWORD.
 * ADMIN_PASSWORD тохируулаагүй бол хуудсыг огт нээхгүй (503).
 */
import { NextResponse, type NextRequest } from "next/server";

export const config = { matcher: "/admin/:path*" };

const DENY = { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' };

/** Урт нь ялгаатай ч ижил хугацаа зарцуулна — нууц үгийг тэмдэгтээр таахаас сэргийлнэ */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i % x.length] ?? 0) ^ (y[i % y.length] ?? 0);
  }
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse("ADMIN_PASSWORD тохируулаагүй байна.", { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return new NextResponse("Нэвтрэх шаардлагатай.", { status: 401, headers: DENY });
  }

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return new NextResponse("Буруу гарчиг.", { status: 401, headers: DENY });
  }
  const i = decoded.indexOf(":");
  const user = i === -1 ? decoded : decoded.slice(0, i);
  const pass = i === -1 ? "" : decoded.slice(i + 1);

  // Хоёуланг нь үргэлж шалгана — богино замаар гарахгүй
  const ok = timingSafeEqual(user, "admin") && timingSafeEqual(pass, password);
  if (!ok) return new NextResponse("Нэр эсвэл нууц үг буруу.", { status: 401, headers: DENY });

  return NextResponse.next();
}
