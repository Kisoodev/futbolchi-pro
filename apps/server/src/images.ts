/**
 * Receipt image checks. Runtime-neutral (Node and Deno): no Buffer, no node:*.
 */
import type { ProofMime } from './db';

export const PROOF_MAX_BYTES = 4 * 1024 * 1024;

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Parses a data URL and checks type, size and magic bytes. Returns null if not an acceptable image. */
export function parseProofDataUrl(dataUrl: unknown): { mime: ProofMime; data: Uint8Array } | null {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!m) return null;
  // Cheap size check before decoding.
  if ((m[2].length * 3) / 4 > PROOF_MAX_BYTES + 3) return null;
  const mime = m[1] as ProofMime;
  let data: Uint8Array;
  try {
    data = base64ToBytes(m[2]);
  } catch {
    return null;
  }
  if (data.length === 0 || data.length > PROOF_MAX_BYTES) return null;
  const head = hex(data.subarray(0, 12));
  const ok =
    (mime === 'image/png' && head.startsWith('89504e470d0a1a0a')) ||
    (mime === 'image/jpeg' && head.startsWith('ffd8ff')) ||
    (mime === 'image/webp' && head.startsWith('52494646') && head.slice(16, 24) === '57454250');
  return ok ? { mime, data } : null;
}

/** Image fingerprint, used to flag a screenshot that was sent before. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data); // plain ArrayBuffer for WebCrypto
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', copy)));
}

export const IMAGE_EXT: Record<ProofMime, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
