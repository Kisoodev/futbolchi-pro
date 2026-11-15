/**
 * A club's own crest, drawn from its kit (docs/LEAGUE.md: no real badges or
 * logos). The shape comes from the club id, the colours and the pattern from
 * its kit, the letters from its name.
 */
import { useId } from 'react';
import { clubKit, hashSeed, type Club } from '@futbolchi/engine';

const SHAPES = [
  // classic shield
  'M3 3 H29 V15 C29 23 22 28 16 31 C10 28 3 23 3 15 Z',
  // round badge
  'M16 2 A14 14 0 1 1 15.99 2 Z',
  // pointed shield with a flat top
  'M4 3 H28 L28 18 L16 31 L4 18 Z',
  // shield with notched shoulders
  'M3 6 L9 3 H23 L29 6 V16 C29 24 22 28 16 31 C10 28 3 24 3 16 Z',
];

const SKIP = new Set(['akademiyasi', 'academy', 'akademie', 'fk', 'sport']);

/** One or two letters for the crest. */
export function crestLetters(name: string): string {
  const words = name.split(/\s+/).filter((w) => !SKIP.has(w.toLowerCase()));
  const parts = words.length ? words : name.split(/\s+/);
  return parts
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
};

export function Crest({ club, size = 18, className }: { club: Club; size?: number; className?: string }) {
  const clip = useId();
  const k = clubKit(club);
  const shape = SHAPES[hashSeed('crest', club.id) % SHAPES.length];
  const letters = crestLetters(club.name);
  const ink = light(k.shirt) ? '#14213d' : '#ffffff';
  const edge = k.secondary.toLowerCase() === k.shirt.toLowerCase() ? (light(k.shirt) ? '#14213d' : '#ffffff') : k.secondary;
  return (
    <svg className={className ?? 'crest'} width={size} height={size} viewBox="0 0 32 34" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d={shape} />
        </clipPath>
      </defs>
      <path d={shape} fill={k.shirt} />
      <g clipPath={`url(#${clip})`} fill={k.secondary} opacity={0.9}>
        {k.pattern === 'stripes' && [7, 15, 23].map((x) => <rect key={x} x={x} y={0} width={4} height={34} />)}
        {k.pattern === 'hoops' && [8, 18].map((y) => <rect key={y} x={0} y={y} width={32} height={4} />)}
        {k.pattern === 'band' && <rect x={0} y={20} width={32} height={5} />}
        {k.pattern === 'halves' && <rect x={16} y={0} width={16} height={34} />}
        {k.pattern === 'shoulders' && <rect x={0} y={0} width={32} height={8} />}
        {k.pattern === 'sleeves' && (
          <>
            <rect x={0} y={0} width={7} height={34} />
            <rect x={25} y={0} width={7} height={34} />
          </>
        )}
      </g>
      <path d={shape} fill="none" stroke={edge} strokeWidth={2.4} />
      <path d={shape} fill="none" stroke="#0b1324" strokeOpacity={0.55} strokeWidth={0.8} />
      <text x={16} y={letters.length > 1 ? 19.5 : 20.5} textAnchor="middle" fontSize={letters.length > 1 ? 10.5 : 13} fontWeight={800} fontFamily="'Pixelify Sans', system-ui, sans-serif" fill={ink} stroke={light(k.shirt) ? 'none' : '#0b1324'} strokeWidth={0.6} paintOrder="stroke">
        {letters}
      </text>
    </svg>
  );
}
