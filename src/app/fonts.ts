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
  // swap — фонт ачаалж дуустал системийн фонтоор уншигдана (LCP-г саатуулахгүй)
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Noto Sans", "sans-serif"],
});
