/**
 * Small drawings for the look editor, so options show what they look like
 * instead of a flat colour square: an eye with that iris colour and a boot
 * in that colour. (Skin and hair colours use player portraits instead.)
 */
import { shade } from './avatarRects';

/** An almond eye: white, coloured iris, pupil and a light glint. */
export function EyeIcon({ color, size = 40 }: { color: string; size?: number }) {
  const id = `eye-${color.replace('#', '')}`;
  return (
    <svg viewBox="0 0 40 24" width={size} height={(size * 24) / 40} aria-hidden>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M3 12 Q20 -1 37 12 Q20 25 3 12 Z" />
        </clipPath>
        <radialGradient id={`${id}-iris`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={shade(color, 0.35)} />
          <stop offset="65%" stopColor={color} />
          <stop offset="100%" stopColor={shade(color, -0.45)} />
        </radialGradient>
      </defs>
      <path d="M3 12 Q20 -1 37 12 Q20 25 3 12 Z" fill="#fdfcf9" />
      <g clipPath={`url(#${id}-clip)`}>
        <circle cx="20" cy="12" r="8" fill={`url(#${id}-iris)`} />
        <circle cx="20" cy="12" r="3.4" fill="#141414" />
        <circle cx="22.6" cy="9.4" r="1.7" fill="#fff" opacity="0.9" />
        {/* upper lid shadow */}
        <path d="M3 12 Q20 -1 37 12 L37 7 L3 7 Z" fill="#000" opacity="0.08" />
      </g>
      <path d="M3 12 Q20 -1 37 12" fill="none" stroke="#2b1d16" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 13 Q20 24 35 13" fill="none" stroke="#2b1d16" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/** A pixel football boot, side view, in the given colour. */
export function BootIcon({ color, size = 40 }: { color: string; size?: number }) {
  const dark = shade(color, -0.35);
  const light = shade(color, 0.3);
  const outline = '#1a2230';
  return (
    <svg viewBox="0 0 20 12" width={size} height={(size * 12) / 20} shapeRendering="crispEdges" aria-hidden>
      {/* outline */}
      <path d="M2 1h6v1h1v2h4v1h4v1h1v1h1v2H1V2h1z" fill={outline} />
      {/* upper */}
      <path d="M3 2h5v2h1v1h4v1h4v1h1v1H2V2h1z" fill={color} />
      {/* shine and stripe */}
      <rect x="3" y="3" width="3" height="1" fill={light} />
      <rect x="9" y="5" width="4" height="1" fill={light} />
      {/* laces */}
      <rect x="10" y="5" width="1" height="1" fill="#fff" opacity="0.85" />
      <rect x="12" y="6" width="1" height="1" fill="#fff" opacity="0.85" />
      {/* sole */}
      <rect x="1" y="8" width="18" height="1" fill={dark} />
      {/* studs */}
      <rect x="3" y="10" width="2" height="1" fill="#9aa3ad" />
      <rect x="8" y="10" width="2" height="1" fill="#9aa3ad" />
      <rect x="15" y="10" width="2" height="1" fill="#9aa3ad" />
    </svg>
  );
}
