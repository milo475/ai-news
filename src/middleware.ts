/**
 * Хамгаалалт ба хаягийн нормчлол:
 *   /admin/*   — HTTP Basic auth (хэрэглэгч "admin", нууц үг ADMIN_PASSWORD).
 *                ADMIN_PASSWORD тохируулаагүй бол хуудсыг огт нээхгүй (503).
 *   /profile/* — нэвтэрсэн байх шаардлагатай. Auth.js-ийн session cookie байгаа эсэхийг
 *                л шалгана (edge дээр DB, bcrypt ажиллуулахгүй); жинхэнэ шалгалтыг
 *                хуудас өөрөө `currentUser()`-ээр хийнэ.
 *   /harits/*  — харьцуулалтын хос нь цагаан толгойн эрэмбэтэй байх ёстой. Эсрэг
 *                дараалалтай хаягийг **301**-ээр canonical руу шилжүүлнэ (хуудсыг
 *                рендерлэхгүй). Хуудас дотор permanentRedirect() хийвэл 308 болох тул
 *                middleware-т барина.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isCanonicalPair, pairKey, parsePair } from "./compare/pair.api";

export const config = { matcher: ["/admin/:path*", "/profile/:path*", "/harits/:pair"] };

/** Auth.js-ийн session cookie (https дээр __Secure- угтвартай) */
function hasSession(req: NextRequest): boolean {
  return Boolean(
    req.cookies.get("authjs.session-token") ?? req.cookies.get("__Secure-authjs.session-token"),
  );
}

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
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/harits/")) {
    const raw = decodeURIComponent(pathname.slice("/harits/".length));
    const parsed = parsePair(raw);
    // Танигдахгүй хаягийг хуудас өөрөө 404 болгоно
    if (!parsed || isCanonicalPair(raw)) return NextResponse.next();
    const canonical = new URL(`/harits/${pairKey(parsed[0], parsed[1])}`, req.url);
    canonical.search = req.nextUrl.search;
    return NextResponse.redirect(canonical, 301);
  }

  if (pathname.startsWith("/profile")) {
    if (hasSession(req)) return NextResponse.next();
    const login = new URL("/nevtreh", req.url);
    login.searchParams.set("ur", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

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
