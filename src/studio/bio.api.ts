/**
 * /ig — «link in bio» хуудасны тогтмолууд.
 *
 * IG нь постын комментод тавьсан холбоосыг ДАРДАГ тул bio-д ганц холбоос
 * тавьж, эндээс салаална. Гарах бүх холбоос `utm_source=instagram` дамжуулна.
 */
export const BIO_UTM = "utm_source=instagram&utm_campaign=bio";

export const BIO_LINKS = [
  { href: "/medee", label: "Бүх мэдээ" },
  { href: "/jagsaalt", label: "Моделийн жагсаалт" },
  { href: "/hereglel", label: "AI хэрэгслүүд" },
  { href: "/zaavar", label: "Заавар" },
] as const;

/** IG постын caption-д тавих CTA — холбоос БИШ */
export const BIO_CTA = "Дэлгэрэнгүй — bio-д";

/** Bio-д тавих ганц холбоос */
export function bioUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/ig`;
}
