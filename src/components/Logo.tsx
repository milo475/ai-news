/** Тэмдэг — өсөх багана + дээш заасан сум. Өнгө нь сэдвийн accent-ээс. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--color-accent)" />
      <rect x="13" y="38" width="9" height="13" rx="2" fill="#fff" fillOpacity="0.55" />
      <rect x="27.5" y="28" width="9" height="23" rx="2" fill="#fff" fillOpacity="0.8" />
      <rect x="42" y="18" width="9" height="33" rx="2" fill="#fff" />
      <path d="M46.5 8 L52.5 15 L40.5 15 Z" fill="#fff" />
    </svg>
  );
}

/** Тэмдэг + нэр. Header-т ашиглана. */
export function Logo() {
  return (
    <span className="inline-flex items-center" style={{ gap: 10 }}>
      <LogoMark />
      <span className="text-lg" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
        <span className="text-ink">AI</span>
        <span className="text-accent"> News</span>
      </span>
    </span>
  );
}
