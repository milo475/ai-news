/** Токены тоог хүн уншихаар: 1 234 567 890 → "1.23 тэрбум" */
export function fmtTokens(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} их наяд`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} тэрбум`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} сая`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} мянга`;
  return String(n);
}

export function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" });
}

export function fmtPct(p: number | null): string {
  if (p === null) return "";
  return `${p > 0 ? "+" : ""}${p}%`;
}
