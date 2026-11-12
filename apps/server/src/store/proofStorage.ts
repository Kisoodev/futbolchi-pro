/**
 * Storage for uploaded payment receipts ("chek" images). They can contain
 * personal financial details: keep them out of db.json and out of git, and
 * serve them only to the admin.
 * TODO(privacy): delete proofs N days after a decision.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type ProofMime = 'image/png' | 'image/jpeg' | 'image/webp';
export const PROOF_MAX_BYTES = 4 * 1024 * 1024;

export interface ProofStorage {
  save(paymentId: string, mime: ProofMime, data: Buffer): void;
  read(paymentId: string, mime: ProofMime): Buffer | null;
}

const EXT: Record<ProofMime, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
/** Payment ids are server-generated, but never trust a path segment. */
const safe = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '');

export class DiskProofStorage implements ProofStorage {
  constructor(private readonly dir: string) {}
  save(paymentId: string, mime: ProofMime, data: Buffer): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, `${safe(paymentId)}.${EXT[mime]}`), data);
  }
  read(paymentId: string, mime: ProofMime): Buffer | null {
    const file = join(this.dir, `${safe(paymentId)}.${EXT[mime]}`);
    return existsSync(file) ? readFileSync(file) : null;
  }
}

export class MemoryProofStorage implements ProofStorage {
  private readonly files = new Map<string, Buffer>();
  save(paymentId: string, _mime: ProofMime, data: Buffer): void {
    this.files.set(paymentId, data);
  }
  read(paymentId: string): Buffer | null {
    return this.files.get(paymentId) ?? null;
  }
}

/** Parses a data URL and checks type, size and magic bytes. Returns null if not an acceptable image. */
export function parseProofDataUrl(dataUrl: unknown): { mime: ProofMime; data: Buffer } | null {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] as ProofMime;
  const data = Buffer.from(m[2], 'base64');
  if (data.length === 0 || data.length > PROOF_MAX_BYTES) return null;
  const hex = data.subarray(0, 12).toString('hex');
  const ok =
    (mime === 'image/png' && hex.startsWith('89504e470d0a1a0a')) ||
    (mime === 'image/jpeg' && hex.startsWith('ffd8ff')) ||
    (mime === 'image/webp' && hex.startsWith('52494646') && hex.slice(16, 24) === '57454250');
  return ok ? { mime, data } : null;
}
