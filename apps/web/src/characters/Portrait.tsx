import { useEffect, useRef } from 'react';
import { CHARACTERS, characterSprite, type CharacterId } from './index';

/** A crisp pixel portrait (head and shoulders) of a story character. */
export function Portrait({ id, size = 64, className }: { id: CharacterId; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { x, y, size: s } = CHARACTERS[id].face;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(characterSprite(id), x, y, s, s, 0, 0, c.width, c.height);
  }, [id]);
  return <canvas ref={ref} width={size * 2} height={size * 2} className={className ?? 'portrait'} style={{ width: size, height: size }} aria-hidden />;
}
