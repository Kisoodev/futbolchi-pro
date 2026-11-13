import { useMemo } from 'react';
import type { Appearance } from '@futbolchi/engine';
import { AVATAR_H, AVATAR_W, avatarRects, headBox, type Pose } from './avatarRects';

interface Props {
  appearance: Appearance;
  kit: string;
  /** Screen pixels per sprite pixel. */
  scale: number;
  pose?: Pose;
  /** 'bust' crops to the head and shoulders (small previews). */
  crop?: 'full' | 'bust';
  className?: string;
}

export function Avatar({ appearance, kit, scale, pose = 'stand', crop = 'full', className }: Props) {
  const key = JSON.stringify(appearance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rects = useMemo(() => avatarRects(appearance, kit, pose), [key, kit, pose]);
  const box = crop === 'bust' ? headBox(appearance) : { x: 0, y: 0, w: AVATAR_W, h: AVATAR_H };
  return (
    <svg
      className={className}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      width={box.w * scale}
      height={box.h * scale}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} />
      ))}
    </svg>
  );
}
