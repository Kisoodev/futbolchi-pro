/**
 * Prepares a receipt image for upload so it reaches the admin fast, even on a
 * slow mobile connection: big phone photos are scaled down and re-encoded as
 * JPEG (a 6 MB camera photo becomes ~300 KB). Small screenshots are sent as
 * they are, so their text stays crisp.
 */

/** Largest file we accept from the picker (before shrinking). */
export const RAW_MAX_BYTES = 25 * 1024 * 1024;
/** Send as-is when already this small and in a format the server takes. */
const KEEP_BYTES = 700 * 1024;
/** Server limit is 4 MB of image data; stay well below it. */
const SEND_MAX_BYTES = 3 * 1024 * 1024;
/** Long side in pixels: still enough to read every digit on a receipt. */
const MAX_SIDE = 2000;
const SERVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export type ReceiptError = 'too_big' | 'bad';

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => (typeof r.result === 'string' ? resolve(r.result) : reject(new Error('read')));
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(blob);
  });

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });

/** Bytes of image data inside a base64 data URL. */
export const dataUrlBytes = (url: string) => Math.floor(((url.length - url.indexOf(',') - 1) * 3) / 4);

export async function prepareReceipt(file: File): Promise<{ dataUrl: string } | { error: ReceiptError }> {
  if (file.size > RAW_MAX_BYTES) return { error: 'too_big' };
  if (file.type && !file.type.startsWith('image/')) return { error: 'bad' };
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return { error: 'bad' };
    if (SERVER_TYPES.includes(file.type) && file.size <= KEEP_BYTES && Math.max(w, h) <= MAX_SIDE) {
      return { dataUrl: await readAsDataUrl(file) };
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'bad' };
    // JPEG has no transparency: put transparent screenshots on white.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.72, 0.6, 0.45]) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (dataUrlBytes(url) <= SEND_MAX_BYTES) return { dataUrl: url };
    }
    return { error: 'too_big' };
  } catch {
    return { error: 'bad' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
