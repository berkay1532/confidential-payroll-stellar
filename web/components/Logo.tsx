// Obscura mark: an aperture ring partially occluded by a disc — an eclipse.
// "You can verify the image without seeing the subject." (camera obscura)
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="obg" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#9c90f8" />
          <stop offset="1" stopColor="#7c6cf6" />
        </linearGradient>
        <mask id="omask">
          <rect width="32" height="32" fill="black" />
          <circle cx="16" cy="16" r="11" fill="white" />
          {/* occluding disc carves a crescent */}
          <circle cx="22" cy="13" r="9" fill="black" />
        </mask>
      </defs>
      <circle cx="16" cy="16" r="11" stroke="url(#obg)" strokeWidth="2.5" opacity="0.35" />
      <circle cx="16" cy="16" r="11" fill="url(#obg)" mask="url(#omask)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <Logo />
      <span>Obscura</span>
    </span>
  );
}
