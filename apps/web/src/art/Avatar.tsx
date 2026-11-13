import { useMemo } from 'react';
import type { Appearance } from '@futbolchi/engine';
import { AVATAR_H, AVATAR_W, avatarLayout, avatarRects, headBox, type Pose } from './avatarRects';

/** Where the "camera" looks in the full-size picture. */
export type AvatarFocus = 'full' | 'head' | 'face';

interface Props {
  appearance: Appearance;
  kit: string;
  /** Screen pixels per sprite pixel. */
  scale: number;
  pose?: Pose;
  /** 'bust' crops to the head and shoulders (small previews). */
  crop?: 'full' | 'bust';
  /**
   * Full-size picture only: zooms smoothly to the face or the head, or shows
   * the whole body. Used by the persona creator to follow the open tab.
   */
  focus?: AvatarFocus;
  className?: string;
}

/** Box around the face / head, in sprite pixels. */
function focusBox(a: Appearance, focus: AvatarFocus) {
  const L = avatarLayout(a);
  const headH = L.headRows.length;
  if (focus === 'face') return { x: L.cx - 10, y: L.headTop - 3, w: 20, h: headH + 6 };
  if (focus === 'head') return { x: L.cx - 14, y: L.headTop - 8, w: 28, h: headH + 16 };
  return { x: 0, y: 0, w: AVATAR_W, h: AVATAR_H };
}

export function Avatar({ appearance, kit, scale, pose = 'stand', crop = 'full', focus = 'full', className }: Props) {
  const key = JSON.stringify(appearance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rects = useMemo(() => avatarRects(appearance, kit, pose), [key, kit, pose]);
  const box = crop === 'bust' ? headBox(appearance) : { x: 0, y: 0, w: AVATAR_W, h: AVATAR_H };
  // Camera: scale the picture so the focus box fills the frame, centred on it.
  let transform: string | undefined;
  if (crop === 'full' && focus !== 'full') {
    const f = focusBox(appearance, focus);
    const z = Math.min(AVATAR_W / f.w, AVATAR_H / f.h);
    const tx = AVATAR_W / 2 - z * (f.x + f.w / 2);
    // Keep the focus in the upper part of the frame (room for the shoulders below).
    const ty = Math.min(0, AVATAR_H * 0.36 - z * (f.y + f.h / 2));
    transform = `translate(${tx}px, ${ty}px) scale(${z})`;
  }
  return (
    <svg
      className={className}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      width={box.w * scale}
      height={box.h * scale}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <g
        className="avatar-camera"
        style={crop === 'full' ? { transform: transform ?? 'translate(0px, 0px) scale(1)', transformOrigin: '0 0' } : undefined}
      >
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} />
        ))}
      </g>
    </svg>
  );
}
