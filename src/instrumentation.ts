/**
 * Next-ийн сервер талын алдаануудыг барьж DB-д бүртгэнэ.
 *
 * `onRequestError` нь App Router-ийн server component, route handler, server action
 * дотор гарсан аливаа барьж аваагүй алдаанд дуудагдана.
 *
 * Энэ файлыг Next нь Node ба Edge хоёуланд bundle хийдэг тул Prisma-г ЭНДЭЭС
 * импортлож болохгүй. Бүртгэгч функцийг `src/lib/errors.ts` (Node талд л ачаалагддаг)
 * globalThis дээр тавьдаг — доор зөвхөн тэндээс уншина.
 */
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Edge runtime дээр Prisma ажиллахгүй — зөвхөн Node дээр бүртгэнэ
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const log = globalThis.__aiNewsLogError;
  const where = `${request.method ?? "GET"} ${request.path}`;
  if (!log) {
    // errors.ts хараахан ачаалагдаагүй (жишээ нь эхний хүсэлт) — консолд үлдээнэ
    console.error(`✗ [web] ${where}`, err);
    return;
  }
  await log({
    source: context.routerKind === "App Router" ? "web" : "api",
    path: where,
    error: err,
  });
};
