import type { Appearance } from '@futbolchi/engine';
import { AVATAR_H, AVATAR_W, avatarRects } from './avatarRects';

export function Avatar({ appearance, kit, scale, className }: { appearance: Appearance; kit: string; scale: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${AVATAR_W} ${AVATAR_H}`}
      width={AVATAR_W * scale}
      height={AVATAR_H * scale}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {avatarRects(appearance, kit).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} />
      ))}
    </svg>
  );
}
