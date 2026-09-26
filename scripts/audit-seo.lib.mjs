/**
 * audit:seo-ийн цэвэр хэсэг — сүлжээгүй, файлгүй. Тестээс импортлоно.
 */
/** Metadata шалгахгүй зам: хүнд зориулаагүй, эсвэл өөр форматтай */
export const SKIP = [
  /^\/api\//, /^\/admin(\/|$)/, /^\/_not-found$/,
  /\.(png|svg|xml|txt|webmanifest|ico)$/,
  /\/embed$/,
];

/** Индексэд орохгүй боловч title-тай байх ёстой хуудсууд */
export const NOINDEX_OK = [/^\/profile/, /^\/nevtreh/, /^\/burtguuleh/, /^\/hailt/, /^\/batalgaajuulah/, /\/nemeh$/, /^\/newsletter\//];

export const MAX_TITLE = 60;
export const MAX_DESC = 160;
export const MIN_DESC = 70;

/** "/medee/[slug]" → /^\/medee\/[^/]+$/ */
export function patternToRegex(route) {
  const body = route
    .split("/")
    .map((seg) => {
      if (/^\[\.\.\..+\]$/.test(seg)) return "(?:.+)";
      if (/^\[.+\]$/.test(seg)) return "[^/]+";
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${body}$`);
}

/** Динамик route бүрд sitemap-аас нэг жишээ сонгоно */
export function resolve(route, paths) {
  if (!route.includes("[")) return route;
  const re = patternToRegex(route);
  return paths.find((p) => re.test(p)) ?? null;
}

