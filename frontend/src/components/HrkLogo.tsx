/**
 * HRK Logo – SVG component
 * Three circles: H (orange), R (orange), K (gray) – transparent background.
 * Props: size sets the height in px; the width scales proportionally (~3.2:1).
 */
interface HrkLogoProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function HrkLogo({ size = 32, className, style }: HrkLogoProps) {
  // viewBox is 192 × 60 – three 56-px circles with 12px gaps
  return (
    <svg
      viewBox="0 0 192 60"
      height={size}
      width={size * (192 / 60)}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="HRK"
      className={className}
      style={style}
    >
      {/* ── H circle ─────────────────────────────────── */}
      <circle cx="30" cy="30" r="30" fill="#e85c04" />
      {/* H glyph */}
      <text
        x="30"
        y="30"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fontSize="30"
        letterSpacing="-1"
      >H</text>

      {/* ── R circle ─────────────────────────────────── */}
      <circle cx="96" cy="30" r="30" fill="#e85c04" />
      {/* R glyph */}
      <text
        x="96"
        y="30"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fontSize="30"
        letterSpacing="-1"
      >R</text>

      {/* ── K circle ─────────────────────────────────── */}
      <circle cx="162" cy="30" r="30" fill="#6b6b6b" />
      {/* K glyph */}
      <text
        x="162"
        y="30"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fontSize="30"
        letterSpacing="-1"
      >K</text>
    </svg>
  )
}
