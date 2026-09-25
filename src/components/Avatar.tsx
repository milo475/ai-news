import { createHash } from "node:crypto";

/**
 * Хэрэглэгчийн зураг: OAuth-ийн зураг → Gravatar → нэрийн эхний үсэг.
 * Файл upload хийхгүй (0.2-т байхгүй).
 */
export function gravatarUrl(email: string, size = 96): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  // d=404 — Gravatar байхгүй бол зураг буцаахгүй, бид эхний үсгийг харуулна
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

export function Avatar({
  email,
  name,
  image,
  size = 40,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
  size?: number;
}) {
  const label = (name?.trim() || email).slice(0, 1).toUpperCase();
  const src = image ?? gravatarUrl(email, size * 2);

  return (
    <span
      className="relative inline-grid place-items-center rounded-full bg-accent text-white overflow-hidden"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      <span aria-hidden>{label}</span>
      {/* Зураг байвал үсгийг бүрхэнэ; 404 бол харагдахгүй */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
    </span>
  );
}
