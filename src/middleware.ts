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
import { isOldHost, siteUrl } from "./lib/site";
import { securityHeaders } from "./lib/headers";
import { clientIp, createLimiter, rateLimitHeaders } from "./lib/ratelimit.api";

export const config = {
  // Бүх хуудсанд security header ба хуучин домэйний шилжүүлэг хэрэгтэй тул
  // static файл, зургийн route-оос бусдыг бүгдийг барина.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|opengraph-image.png).*)"],
};

/**
 * /api/* дээрх IP-ийн хязгаар: минутад 60 хүсэлт.
 *
 * Зураг, OG, health-ийг оруулахгүй — тэдгээрийг Facebook, Google, Railway-ийн
 * сервер олноор дууддаг бөгөөд хямд (кэштэй) хариу өгдөг.
 */
const API_LIMIT = 60;
const apiLimiter = createLimiter({ limit: API_LIMIT, windowMs: 60_000 });

/** Хязгаараас чөлөөлөх /api дэд замууд */
const RATE_EXEMPT = /^\/api\/(og|fb-image|hero-image|guide-image|tool-logo|health|auth)\b/;

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

  // 1. Хуучин домэйноор ирсэн бол шинэ рүү 301. Домэйн солиход хуучин холбоосууд
  //    хайлтын системд зөв шилжинэ.
  const host = req.headers.get("host");
  if (isOldHost(host)) {
    const target = new URL(`${siteUrl()}${pathname}`);
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target, 301);
  }

  // embed route өөрийн CSP-тэй (frame-ancestors *) — дарж бичихгүй
  if (pathname.endsWith("/embed")) return NextResponse.next();

  // 2. /api хязгаар — нэг IP минутад 60 хүсэлт
  if (pathname.startsWith("/api/") && !RATE_EXEMPT.test(pathname)) {
    const r = apiLimiter.check(clientIp(req.headers));
    const limitHeaders = rateLimitHeaders(API_LIMIT, r);
    if (!r.ok) {
      return NextResponse.json(
        { error: "Хэт олон хүсэлт. Түр хүлээгээд дахин оролдоно уу." },
        { status: 429, headers: limitHeaders },
      );
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(limitHeaders)) res.headers.set(k, v);
    return res;
  }

  if (pathname.startsWith("/harits/")) {
    const raw = decodeURIComponent(pathname.slice("/harits/".length));
    const parsed = parsePair(raw);
    // Танигдахгүй хаягийг хуудас өөрөө 404 болгоно
    if (!parsed || isCanonicalPair(raw)) return withHeaders(NextResponse.next());
    const canonical = new URL(`/harits/${pairKey(parsed[0], parsed[1])}`, req.url);
    canonical.search = req.nextUrl.search;
    return NextResponse.redirect(canonical, 301);
  }

  if (pathname.startsWith("/profile")) {
    if (hasSession(req)) return withHeaders(NextResponse.next());
    const login = new URL("/nevtreh", req.url);
    login.searchParams.set("ur", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  // /admin биш бол цааш нь — зөвхөн header нэмээд явуулна
  if (!pathname.startsWith("/admin")) return withHeaders(NextResponse.next());

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

  return withHeaders(NextResponse.next());
}

/** Аюулгүй байдлын header-ууд — бүх хариунд */
function withHeaders(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  return res;
}
