/**
 * Өөрийн сервер дээрх фонт — гадны хүсэлтгүй (Google Fonts руу холбогдохгүй),
 * next/font нь hash-тай нэрээр immutable кэштэй өгч, `<link rel=preload>` нэмнэ.
 *
 * Фонтыг кирилл + латин + тэмдэгтээр subset хийсэн (124 KB TTF → 41 KB woff2).
 * Эх файлууд нь төслийн `fonts/` дотор (картын зураг зурахад мөн хэрэглэгддэг).
 */
import localFont from "next/font/local";

export const roboto = localFont({
  src: [
    { path: "./fonts/Roboto-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Roboto-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-roboto",
  // preload: false — next/font нь анхдагчаар <link rel=preload> нэмдэг. Гар утасны
  // удаан сүлжээнд 2 × 42 KB нь LCP-ийн замтай зурвасын төлөө өрсөлдөж +1 с нэмдэг.
  // Preload-гүй үед фонт CSS-ийн дараа бага эрэмбээр ирнэ.
  preload: false,
  // optional — фонт ~100 мс дотор бэлэн биш бол хөтөч системийн фонтоор үлдээнэ.
  // swap нь фонт ирэхэд текстийг дахин зурдаг тул LCP тэр үед л бүртгэгддэг байсан
  // (гар утсанд +1 с). Core Web Vitals-д LCP чухал тул optional-ыг сонгов.
  display: "optional",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Noto Sans", "sans-serif"],
});
