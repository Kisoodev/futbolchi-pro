import type { CSSProperties } from 'react';
import { CLOUD, GRASS, spriteDataUri, spriteRuns, spriteSize, type Sprite } from './sprites';

export function PixelArt({ sprite, scale, className, style }: { sprite: Sprite; scale: number; className?: string; style?: CSSProperties }) {
  const { w, h } = spriteSize(sprite);
  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {spriteRuns(sprite).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />
      ))}
    </svg>
  );
}

const GRASS_TILE = spriteDataUri(GRASS);

/** Fixed sky behind every screen: gradient, drifting pixel clouds, grass strip. */
export function SkyBackdrop() {
  return (
    <div className="sky" aria-hidden>
      <PixelArt sprite={CLOUD} scale={9} className="cloud c1" />
      <PixelArt sprite={CLOUD} scale={6} className="cloud c2" />
      <PixelArt sprite={CLOUD} scale={5} className="cloud c3" />
      <PixelArt sprite={CLOUD} scale={7} className="cloud c4" />
      <div className="grass" style={{ backgroundImage: GRASS_TILE }} />
    </div>
  );
}
