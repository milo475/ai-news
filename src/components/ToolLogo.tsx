import { letterAvatar } from "@/tools/tool.api";

/**
 * Хэрэгслийн лого. Лого татагдаагүй бол нэрнээс тогтвортой өнгөтэй үсгэн avatar.
 */
export function ToolLogo({
  name,
  slug,
  hasLogo,
  size = 48,
}: {
  name: string;
  slug: string;
  hasLogo: boolean;
  size?: number;
}) {
  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/tool-logo/${slug}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="rounded-lg border border-line bg-paper object-contain shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  const { letter, hue } = letterAvatar(name);
  return (
    <span
      aria-hidden
      className="rounded-lg border border-line flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: `oklch(0.9 0.05 ${hue})`,
        color: `oklch(0.35 0.12 ${hue})`,
      }}
    >
      {letter}
    </span>
  );
}
