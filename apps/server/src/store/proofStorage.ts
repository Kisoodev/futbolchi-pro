/**
 * Local storage for uploaded payment receipts ("chek" images). They can
 * contain personal financial details: keep them out of db.json and out of
 * git, and serve them only to the admin. (Production uses a private
 * Supabase Storage bucket instead, see supabaseDb.ts.)
 * TODO(privacy): delete proofs N days after a decision.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProofMime } from '../db';
import { IMAGE_EXT } from '../images';

export { PROOF_MAX_BYTES, parseProofDataUrl } from '../images';

export interface ProofStorage {
  save(paymentId: string, mime: ProofMime, data: Uint8Array): void;
  read(paymentId: string, mime: ProofMime): Uint8Array | null;
}

/** Payment ids are server-generated, but never trust a path segment. */
const safe = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '');

export class DiskProofStorage implements ProofStorage {
  constructor(private readonly dir: string) {}
  save(paymentId: string, mime: ProofMime, data: Uint8Array): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, `${safe(paymentId)}.${IMAGE_EXT[mime]}`), data);
  }
  read(paymentId: string, mime: ProofMime): Uint8Array | null {
    const file = join(this.dir, `${safe(paymentId)}.${IMAGE_EXT[mime]}`);
    return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
  }
}

export class MemoryProofStorage implements ProofStorage {
  private readonly files = new Map<string, Uint8Array>();
  save(paymentId: string, _mime: ProofMime, data: Uint8Array): void {
    this.files.set(paymentId, data);
  }
  read(paymentId: string): Uint8Array | null {
    return this.files.get(paymentId) ?? null;
  }
}
